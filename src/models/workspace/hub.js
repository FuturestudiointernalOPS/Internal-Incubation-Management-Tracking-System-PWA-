import db from "@/lib/db";

/**
 * Workspace model — the neutral post-login hub data (REPOSITORY layer).
 *
 * The memberships, roles and program scopes the workspaces hub assembles, split
 * verbatim out of `models/workspace.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Program staff assignments (role + program name) for a user. */
export async function getStaffAssignmentsForUser(cid, emailOrCid) {
  return db.execute({
    sql: `SELECT ps.role, CAST(ps.program_id AS TEXT) AS program_id, p.name AS program_name
            FROM v2_program_staff ps
            JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
            WHERE (ps.staff_id = ? OR LOWER(ps.staff_id) = LOWER(?))
            ORDER BY p.name ASC`,
    args: [cid, emailOrCid],
  });
}

/**
 * ACTIVE program enrollments — active membership AND a program still running.
 *
 * BOTH halves are required, and for different reasons:
 *
 *   pp.status — the person's own membership. A participant whose membership is
 *     closed (`completed`) is an alumnus of that program even while the program
 *     itself runs on.
 *   p.status  — the program. A program that is no longer `active` is view-only,
 *     so nobody may act inside it — including a participant whose own membership
 *     row was never closed.
 *
 * Either one ending is enough to end the entitlement. This mirrors the rule the
 * submissions route already enforces via `getSubmissionProgramStatus` ("a
 * program that is no longer active is view-only"), so uploads and submissions
 * cannot disagree about who is still taking part.
 *
 * Sole caller: POST /api/upload — the gate that decides whether a participant
 * may attach a file. Alumni must not, in the programs they have finished.
 */
export async function getActiveParticipantEnrollments(cid) {
  return db.execute({
    sql: `SELECT CAST(pp.program_id AS TEXT) AS program_id, p.name AS program_name
            FROM participant_programs pp
            JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(pp.program_id AS TEXT)
            WHERE pp.participant_id = ?
              AND (pp.status IS NULL OR pp.status = 'active')
              AND (p.status IS NULL OR LOWER(p.status) = 'active')
            ORDER BY p.name ASC`,
    args: [cid],
  });
}

/** Raw stored baseline role (contacts.role) — identity-chip truth. */
export async function getContactStoredRole(cid) {
  return db.execute({
    sql: `SELECT role FROM contacts WHERE cid = ? LIMIT 1`,
    args: [cid],
  });
}

/** Generalized program assignments from contact_roles (dedup source). */
export async function getProgramAssignmentsFromContactRoles(cid) {
  return db.execute({
    sql: `SELECT cr.contact_cid, cr.role, cr.title, cr.context_id AS program_id,
                     cr.is_current, cr.status, cr.scope, cr.started_at, cr.ended_at,
                     p.name AS program_name
              FROM contact_roles cr
              LEFT JOIN v2_programs p ON p.id::text = cr.context_id::text
              WHERE cr.contact_cid = ? AND cr.context_type = 'program'
              ORDER BY cr.is_current DESC, cr.started_at DESC`,
    args: [cid],
  });
}

/**
 * All participant memberships with lifecycle status (incl. completed).
 *
 * The two extra columns exist so the hub can answer a SECOND question from these
 * same rows instead of sending the same table again: `program_exists` is the
 * INNER-join test the active-enrollment query made, and `program_id_text` is the
 * cast it returned (the id spaces differ, so the text form is what a comparison
 * against an assignment is made in).
 */
export async function getParticipantProgramMemberships(cid) {
  return db.execute({
    sql: `SELECT pp.participant_id, pp.program_id, pp.status, pp.screening_status,
                     pp.accepted_at, pp.completed_at, pp.outcome, pp.certificate_issued,
                     p.name AS program_name, p.status AS program_status,
                     (p.id IS NOT NULL) AS program_exists,
                     CAST(pp.program_id AS TEXT) AS program_id_text
              FROM participant_programs pp
              LEFT JOIN v2_programs p ON p.id::text = pp.program_id::text
              WHERE pp.participant_id = ?
              ORDER BY pp.assigned_at DESC`,
    args: [cid],
  });
}

/** Active responsibilities assigned to a user, ordered by name. */
export async function getActiveResponsibilitiesForUser(userCid) {
  return db.execute({
    sql: `SELECT r.id, r.name, r.key, r.description, r.icon
              FROM user_responsibilities ur
              JOIN responsibilities r ON r.id = ur.responsibility_id
              WHERE ur.user_cid = ? AND r.is_active = 1
              ORDER BY r.name`,
    args: [userCid],
  });
}

/** Non-removed venture memberships for a contact, newest first. */
export async function getActiveVentureMembershipsForContact(contactCid) {
  return db.execute({
    sql: `SELECT vm.*, COALESCE(v.company_name, v.name) AS venture_name, v.status AS venture_status
              FROM venture_members vm
              LEFT JOIN ventures v ON v.venture_id = vm.venture_id
              WHERE vm.contact_id = ? AND vm.removed_at IS NULL
              ORDER BY vm.joined_at DESC`,
    args: [contactCid],
  });
}
