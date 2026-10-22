/**
 * Authorization — context assignment reads (REPOSITORY layer).
 *
 * The per-resource membership lookups behind `requireScopedAccess`. Each
 * function wraps exactly one statement and returns rows; the "capability AND
 * assignment" decision lives in `@/services/authorization/scopedAccess`.
 *
 * SQL is byte-identical to what used to sit inline in the context-access module.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per query, no
 * decisions.
 */

import db from "@/lib/db";

/**
 * Any v2_program_staff row for this program (facilitator, program_manager,
 * assistant, …), matched by cid — or by email when one is supplied (staff_id
 * may hold either). The email branch keeps its original SQL verbatim.
 *
 * `role` narrows the answer to one staff role. The single assignment resolver
 * uses it when a caller asks a role-specific question ("is this person a
 * FACILITATOR here?"), so one read serves both the role-specific and the
 * generic question instead of two duplicated queries.
 */
export async function getProgramStaffAssignmentRows(contextId, userCid, userEmail, role = null) {
  const hasEmail = !!(userEmail && String(userEmail).trim());
  const roleClause = role ? " AND role = ?" : "";
  const roleArgs = role ? [String(role)] : [];
  const result = await db.execute({
    sql: hasEmail
      ? `SELECT * FROM v2_program_staff
           WHERE CAST(program_id AS TEXT) = ?
             AND (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?))${roleClause}
           ORDER BY role LIMIT 1`
      : `SELECT * FROM v2_program_staff
           WHERE CAST(program_id AS TEXT) = ? AND staff_id = ?${roleClause}
           ORDER BY role LIMIT 1`,
    args: hasEmail
      ? [String(contextId), userCid, String(userEmail).trim(), ...roleArgs]
      : [String(contextId), userCid, ...roleArgs],
  });
  return result.rows;
}

/** A current contact_roles 'program' assignment for this person. */
export async function getContactRoleAssignmentRows(contextId, userCid) {
  const result = await db.execute({
    sql: `SELECT * FROM contact_roles
            WHERE context_type = 'program' AND CAST(context_id AS TEXT) = ?
              AND is_current = true AND contact_cid = ?
            ORDER BY started_at DESC LIMIT 1`,
    args: [String(contextId), userCid],
  });
  return result.rows;
}

/** Project membership row for this person (1 row when a member, else none). */
export async function getProjectMembershipRows(contextId, userCid) {
  const result = await db.execute({
    sql: "SELECT 1 FROM project_members WHERE project_id::text = ? AND user_cid = ? LIMIT 1",
    args: [String(contextId), userCid],
  });
  return result.rows;
}

/** Active (not removed) venture membership row for this person. */
export async function getVentureMembershipRows(contextId, userCid) {
  const result = await db.execute({
    sql: `SELECT 1 FROM venture_members
            WHERE venture_id = ? AND (user_cid = ? OR contact_id = ?)
              AND removed_at IS NULL LIMIT 1`,
    args: [String(contextId), userCid, userCid],
  });
  return result.rows;
}
