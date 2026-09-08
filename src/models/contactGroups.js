import db from "@/lib/db";

/**
 * CONTACT GROUP AUTHORIZATION
 *
 * Determines whether user A can collaborate with user B
 * (e.g., assign a task to them) based on shared Contact Group membership.
 *
 * Rules:
 *   1. Same authorized Contact Group = eligible for collaboration.
 *   2. In a venture context, both must be venture_members of that venture.
 *   3. Super Admin can always override.
 *   4. Falls back to legacy contacts.group_name if user_groups is empty.
 */

/**
 * Check if two users share at least one Contact Group.
 * Returns { allowed: boolean, sharedGroups: string[], reason?: string }
 */
export async function areUsersInSameGroup(userCidA, userCidB) {
  if (!userCidA || !userCidB) {
    return { allowed: false, sharedGroups: [], reason: "Missing user IDs" };
  }

  if (userCidA === userCidB) {
    return { allowed: true, sharedGroups: ["self"] };
  }

  // Try user_groups (modern)
  try {
    const res = await db.execute({
      sql: `SELECT ug1.group_name
            FROM user_groups ug1
            JOIN user_groups ug2 ON ug1.group_name = ug2.group_name
            WHERE ug1.user_cid = ? AND ug2.user_cid = ?`,
      args: [userCidA, userCidB],
    });
    if (res.rows.length > 0) {
      return {
        allowed: true,
        sharedGroups: res.rows.map((r) => r.group_name),
      };
    }
  } catch (_) {
    // user_groups table may not exist
  }

  // Fallback: legacy contacts.group_name
  try {
    const res = await db.execute({
      sql: `SELECT c1.group_name
            FROM contacts c1
            JOIN contacts c2 ON c1.group_name = c2.group_name
            WHERE c1.cid = ? AND c2.cid = ? AND c1.group_name IS NOT NULL AND c1.group_name != ''`,
      args: [userCidA, userCidB],
    });
    if (res.rows.length > 0) {
      return {
        allowed: true,
        sharedGroups: res.rows.map((r) => r.group_name),
      };
    }
  } catch (_) {
    // contacts table missing group_name
  }

  return {
    allowed: false,
    sharedGroups: [],
    reason: `Users do not share any Contact Group`,
  };
}

/**
 * Check if both users are members of a specific venture.
 */
export async function areUsersInSameVenture(userCidA, userCidB, ventureId) {
  if (!ventureId) {
    return { allowed: false, reason: "No venture specified" };
  }

  try {
    const res = await db.execute({
      sql: `SELECT 1 FROM venture_members vm1
            JOIN venture_members vm2 ON vm1.venture_id = vm2.venture_id
            WHERE vm1.contact_id = ? AND vm2.contact_id = ?
            AND vm1.venture_id = ? AND vm1.removed_at IS NULL AND vm2.removed_at IS NULL
            LIMIT 1`,
      args: [userCidA, userCidB, ventureId],
    });
    if (res.rows.length > 0) {
      return { allowed: true, ventureId };
    }
    return {
      allowed: false,
      reason: `Users do not share venture membership for ${ventureId}`,
    };
  } catch (err) {
    return {
      allowed: false,
      reason: `Venture membership check failed: ${err.message}`,
    };
  }
}

/**
 * Validate that a task assignment is allowed between assigner and assignee.
 * Considers context_type (staff/venture) to determine which check to use.
 *
 * @param {string} assignerCid - The user doing the assigning
 * @param {string} assigneeCid - The user being assigned
 * @param {object} taskContext - Optional: { context_type, context_id } from the task
 * @returns {{ allowed: boolean, reason?: string }}
 */
export async function validateTaskAssignment(
  assignerCid,
  assigneeCid,
  taskContext = {},
) {
  if (!assigneeCid) return { allowed: true }; // Unassigning is always allowed

  // Super Admin can assign to anyone
  // (called from route which should check session.role first)

  // Venture context: check venture_members
  if (taskContext.context_type === "venture" && taskContext.context_id) {
    return await areUsersInSameVenture(
      assignerCid,
      assigneeCid,
      taskContext.context_id,
    );
  }

  // Staff context (default): check user_groups
  return await areUsersInSameGroup(assignerCid, assigneeCid);
}
