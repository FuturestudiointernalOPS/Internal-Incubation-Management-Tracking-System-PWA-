/**
 * models/authorization — access queries.
 *
 * Data access for authorization questions, one function per query:
 *
 *   - ownership and membership: project existence and membership, is this user
 *     the program's assigned PM, is this person a supervisor;
 *   - assignment sources: the legacy program-staff table, then the generalized
 *     contact roles, plus a person's assignment status;
 *   - scope: which teams a facilitator handles;
 *   - capability input: access-profile capabilities, per-program defaults;
 *   - integrity: the same-program participant/facilitator conflict probe;
 *   - the permission audit write.
 *
 * Each function keeps the try/catch behaviour it had while it lived inline in
 * src/lib/auth.js. Those fallbacks are deliberate and security-relevant: some
 * fail open so a lookup error cannot block enrolment, some fail closed so a
 * broken profile or an unreachable table denies instead of grants, and the
 * audit write never breaks the action it records.
 */

import db, { initDb } from "@/lib/db";


/**
 * Returns the facilitator assignment row for (program, user) or null.
 * Matches by contact cid or email so legacy rows that stored the email
 * still resolve correctly.
 */
export async function getProgramFacilitatorAssignment(programId, userCid, userEmail = null) {
  try {
    await initDb();
    const hasEmail = !!(userEmail && String(userEmail).trim());
    const sql = hasEmail
      ? "SELECT * FROM v2_program_staff WHERE CAST(program_id AS TEXT) = ? AND role = 'facilitator' AND (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?))"
      : "SELECT * FROM v2_program_staff WHERE CAST(program_id AS TEXT) = ? AND role = 'facilitator' AND staff_id = ?";
    const args = hasEmail
      ? [String(programId), userCid, String(userEmail).trim()]
      : [String(programId), userCid];
    const res = await db.execute({ sql, args });
    return res.rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * Generalized program assignment lookup via contact_roles (any title: facilitator,
 * coach, mentor, advisor, ...). Returns a row normalized to the same shape as
 * v2_program_staff so existing guards can consume it unchanged.
 * Returns null when no current assignment exists (or the table is missing).
 */
export async function getProgramAssignment(programId, userCid, userEmail = null) {
  try {
    await initDb();
    const hasEmail = !!(userEmail && String(userEmail).trim());
    const sql = hasEmail
      ? `SELECT * FROM contact_roles
         WHERE context_type = 'program' AND CAST(context_id AS TEXT) = ?
           AND is_current = true
           AND (contact_cid = ? OR LOWER(TRIM(contact_cid)) = LOWER(?))
         ORDER BY started_at DESC LIMIT 1`
      : `SELECT * FROM contact_roles
         WHERE context_type = 'program' AND CAST(context_id AS TEXT) = ?
           AND is_current = true AND contact_cid = ?
         ORDER BY started_at DESC LIMIT 1`;
    const args = hasEmail
      ? [String(programId), userCid, String(userEmail).trim()]
      : [String(programId), userCid];
    const res = await db.execute({ sql, args });
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      program_id: row.context_id,
      staff_id: row.contact_cid,
      role: row.role || row.title || "assignment",
      title: row.title || row.role || "assignment",
      permissions: row.capability_overrides || row.permissions || {},
      access_profile_id: row.access_profile_id || null,
      scope: row.scope || { type: "program" },
      status: row.status || "active",
      assigned_by: row.assigned_by || null,
    };
  } catch {
    return null;
  }
}

/**
 * Returns the current status of a person's assignment within a resource.
 * Defaults to "active" when no explicit assignment record exists, so this
 * never introduces a new denial for legacy rows.
 */
export async function getAssignmentStatus(resource, contextId, userCid) {
  try {
    await initDb();
    const res = await db.execute({
      sql: `SELECT status FROM contact_roles
            WHERE contact_cid = ? AND context_type = ? AND context_id = ?
              AND is_current = true
            ORDER BY started_at DESC
            LIMIT 1`,
      args: [userCid, String(resource), String(contextId)],
    });
    return res.rows[0]?.status || "active";
  } catch {
    return "active";
  }
}

export async function getUserGroups(userCid) {
  try {
    await initDb();
    const groupsResult = await db.execute({
      sql: "SELECT group_name FROM user_groups WHERE user_cid = ?",
      args: [userCid],
    });
    if (groupsResult.rows.length > 0) return groupsResult.rows.map((group) => group.group_name);
    const contactResult = await db.execute({
      sql: "SELECT group_name FROM contacts WHERE cid = ?",
      args: [userCid],
    });
    if (contactResult.rows.length > 0 && contactResult.rows[0].group_name)
      return [contactResult.rows[0].group_name];
    return [];
  } catch {
    return [];
  }
}

export async function logPermissionAudit({
  actorCid,
  actorName,
  targetCid,
  targetName,
  action,
  module,
  capability,
  previousValue,
  newValue,
  details,
}) {
  try {
    await initDb();
    await db.execute({
      sql: `INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, module, capability, previous_value, new_value, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        actorCid,
        actorName || null,
        targetCid,
        targetName || null,
        action,
        module || null,
        capability || null,
        previousValue || null,
        newValue || null,
        details || null,
      ],
    });
  } catch (error) {
    console.error("logPermissionAudit error:", error.message);
  }
}

/**
 * Returns true when the user is the explicitly assigned PM of a specific
 * program (v2_programs.assigned_pm_id = userCid). Used to grant staff members
 * who hold a PM role on a program the same bypass as a program_manager role.
 */
export async function isAssignedPmForProgram(programId, userCid) {
  if (!programId || !userCid) return false;
  try {
    await initDb();
    const res = await db.execute({
      sql: "SELECT 1 FROM v2_programs WHERE CAST(id AS TEXT) = ? AND CAST(assigned_pm_id AS TEXT) = ? LIMIT 1",
      args: [String(programId), String(userCid)],
    });
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Returns true when the user holds at least one facilitator assignment
 * (program-scoped), matched by cid or email. Used to gate the facilitator
 * area so only system-assigned facilitators (or super admins) can enter it.
 */
export async function hasAnyFacilitatorAssignment(userCid, userEmail = null) {
  try {
    await initDb();
    const hasEmail = !!(userEmail && String(userEmail).trim());
    const sql = hasEmail
      ? "SELECT 1 FROM v2_program_staff WHERE role = 'facilitator' AND (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?)) LIMIT 1"
      : "SELECT 1 FROM v2_program_staff WHERE role = 'facilitator' AND staff_id = ? LIMIT 1";
    const args = hasEmail ? [userCid, String(userEmail).trim()] : [userCid];
    const res = await db.execute({ sql, args });
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Returns a facilitator's management-group scope for a program using the
 * existing v2_teams structure (handler_id = facilitator). This is the
 * cohort-management scope: a facilitator sees only participants assigned to
 * the v2_teams where they are the handler.
 *
 * { scope: 'all' }   — program facilitator_scope is 'all'
 * { scope: 'teams' } — restricted to the returned teamIds
 * { scope: 'none' }  — facilitator has no assigned teams
 */
export async function getFacilitatorTeamScope(programId, facilitatorCid) {
  try {
    await initDb();
    const prog = await db.execute({
      sql: "SELECT facilitator_scope FROM v2_programs WHERE id = ?",
      args: [programId],
    });
    if (prog.rows[0]?.facilitator_scope === "all") {
      return { scope: "all", teamIds: [] };
    }
    const teams = await db.execute({
      sql: "SELECT CAST(id AS TEXT) AS id FROM v2_teams WHERE CAST(program_id AS TEXT) = ? AND handler_id = ?",
      args: [String(programId), facilitatorCid],
    });
    return {
      scope: teams.rows.length ? "teams" : "none",
      teamIds: teams.rows.map((row) => row.id),
    };
  } catch {
    return { scope: "none", teamIds: [] };
  }
}

/**
 * Returns true when `supervisorCid` is the CURRENT supervisor of
 * `superviseeCid` (a `contact_roles` relationship persisted in Phase 2A).
 * Used for read-only supervisor visibility into a supervisee's standup/retro/
 * blockers. This grants NO write access — it only widens read scoping.
 */
export async function isSupervisorOf(supervisorCid, superviseeCid) {
  try {
    await initDb();
    if (!supervisorCid || !superviseeCid) return false;
    const res = await db.execute({
      sql: `SELECT 1 FROM contact_roles
            WHERE contact_cid = ? AND context_type = 'supervision'
              AND context_id = ? AND is_current = true
            LIMIT 1`,
      args: [superviseeCid, supervisorCid],
    });
    return res.rows.length > 0;
  } catch (error) {
    console.error("isSupervisorOf error:", error.message);
    return false;
  }
}

/** True when the project exists at all — this is what separates 404 from 403. */
export async function projectExists(projectId) {
  await initDb();
  const res = await db.execute({
    sql: "SELECT id FROM v2_projects WHERE id::text = ?",
    args: [projectId],
  });
  return res.rows.length > 0;
}

/** True when the user is on the project, as owner or collaborator. */
export async function isProjectMember(projectId, userCid) {
  await initDb();
  const res = await db.execute({
    sql: "SELECT 1 FROM project_members WHERE project_id::text = ? AND user_cid = ?",
    args: [projectId, userCid],
  });
  return res.rows.length > 0;
}

/**
 * Capability rows of an Access Profile template.
 *
 * A failure here returns an empty list ON PURPOSE: the caller then falls back to
 * the program default, which is what it did while this query was inline. Throwing
 * would deny a facilitator whose profile merely failed to load.
 */
export async function listProfileCapabilities(profileId) {
  try {
    await initDb();
    const res = await db.execute({
      sql: "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = ?",
      args: [profileId],
    });
    return res.rows || [];
  } catch {
    return [];
  }
}

/**
 * Per-program default capability levels.
 *
 * Deliberately NOT caught: a failure must reach the caller's catch, which denies
 * with level 0 rather than granting from a guess.
 */
export async function getFacilitatorDefaultPermissions(programId) {
  await initDb();
  const prog = await db.execute({
    sql: "SELECT facilitator_default_permissions FROM v2_programs WHERE id = ?",
    args: [programId],
  });
  return prog.rows[0]?.facilitator_default_permissions;
}

/**
 * Same-program conflict probe: does this person already facilitate this program?
 * Matches the cid or the email, because legacy rows stored either. Read errors
 * are left to the caller — the guard fails open on purpose so an enrolment is
 * never blocked by a transient lookup failure.
 */
export async function findParticipantFacilitatorConflict(programId, contactCid, contactEmail = null) {
  const hasEmail = !!(contactEmail && String(contactEmail).trim());
  const sql = hasEmail
    ? `SELECT 1 FROM v2_program_staff
       WHERE CAST(program_id AS TEXT) = ? AND role = 'facilitator'
         AND (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?))
       LIMIT 1`
    : `SELECT 1 FROM v2_program_staff
       WHERE CAST(program_id AS TEXT) = ? AND role = 'facilitator' AND staff_id = ?
       LIMIT 1`;
  const args = hasEmail
    ? [String(programId), String(contactCid), String(contactEmail).trim()]
    : [String(programId), String(contactCid)];
  const res = await db.execute({ sql, args });
  return res.rows.length > 0;
}
