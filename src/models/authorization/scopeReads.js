/**
 * Authorization — scope reads (REPOSITORY layer).
 *
 * The record-id lookups behind the scope engine. Each function wraps exactly
 * one statement and returns ids (or a boolean); the fail-closed rules — "an
 * unresolvable scope is a denial" — live in the service
 * (`@/services/authorization/scope`).
 *
 * SQL is byte-identical to what used to sit inline in the scope engine.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per query, no
 * decisions.
 */

import db from "@/lib/db";

/** Ventures the person owns or is delegated to (the `venture_own` policy). */
export async function getVentureOwnScopeIds(userCid) {
  const result = await db.execute({
    sql: `SELECT DISTINCT CAST(venture_id AS TEXT) AS id
                FROM venture_members
                WHERE (user_cid = ? OR contact_id = ?) AND removed_at IS NULL
                UNION
                SELECT DISTINCT CAST(venture_id AS TEXT) AS id
                FROM venture_staff_assignments
                WHERE staff_contact_id = ? AND status = 'active'`,
    args: [userCid, userCid, userCid],
  });
  return result.rows.map((row) => String(row.id));
}

/** Programs the person is staffed on OR enrolled in (the `program_assigned` policy). */
export async function getProgramAssignedScopeIds(userCid, email) {
  const result = await db.execute({
    sql: `SELECT DISTINCT CAST(program_id AS TEXT) AS id
                FROM v2_program_staff
                WHERE staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?)
                UNION
                SELECT DISTINCT CAST(program_id AS TEXT) AS id
                FROM participant_programs
                WHERE participant_id = ?`,
    args: [userCid, email || userCid, userCid],
  });
  return result.rows.map((row) => String(row.id));
}

/** Programs the person STAFFS only — the write side (the `program_staffed` policy). */
export async function getProgramStaffedScopeIds(userCid, email) {
  const result = await db.execute({
    sql: `SELECT DISTINCT CAST(program_id AS TEXT) AS id
                FROM v2_program_staff
                WHERE staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?)
                UNION
                SELECT DISTINCT CAST(id AS TEXT) AS id
                FROM v2_programs
                WHERE CAST(assigned_pm_id AS TEXT) = ?`,
    args: [userCid, email || userCid, userCid],
  });
  return result.rows.map((row) => String(row.id));
}

/** Courses the person is enrolled in and not suspended from (the `learning_own` policy). */
export async function getLearningOwnScopeIds(userCid) {
  const result = await db.execute({
    sql: `SELECT DISTINCT CAST(course_id AS TEXT) AS id
                FROM lms_enrollments
                WHERE user_cid = ? AND status <> 'suspended'`,
    args: [userCid],
  });
  return result.rows.map((row) => String(row.id));
}

/** The canonical VNT code for a venture UUID, or null when there is no row. */
export async function getVentureIdByUuid(value) {
  const result = await db.execute({
    sql: "SELECT venture_id FROM ventures WHERE id::text = ?",
    args: [value],
  });
  return result.rows?.[0]?.venture_id ?? null;
}

/** True when the target is a participant of a program the staff member serves. */
export async function contactSharesStaffedProgram(targetCid, staffCid, email) {
  const result = await db.execute({
    sql: `SELECT 1
            FROM participant_programs pp
            JOIN v2_program_staff ps ON ps.program_id = pp.program_id
            WHERE pp.participant_id = ?
              AND (ps.staff_id = ? OR LOWER(TRIM(ps.staff_id)) = LOWER(?))
            LIMIT 1`,
    args: [String(targetCid), String(staffCid), String(email || staffCid)],
  });
  return result.rows.length > 0;
}
