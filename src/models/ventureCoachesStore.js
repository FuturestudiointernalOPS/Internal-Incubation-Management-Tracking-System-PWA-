/**
 * Venture coach catalog + assignments — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/coaches`: the coach catalog rows,
 * the assignment rows (with their coach join), the primary/duplicate probes and
 * the coach-activity log writes.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 * (Distinct from `@/models/ventureCoachStore`, which backs the coach IDENTITY and
 * INVITATION layer.)
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Coach catalog ────────────────────────────────────────────────────────────

/** The coach catalog (optional type filter), by name. */
export function selectCoaches(coachType) {
  let sql = "SELECT * FROM venture_coaches WHERE 1=1";
  const args = [];
  if (coachType) { sql += " AND coach_type = ?"; args.push(coachType); }
  sql += " ORDER BY full_name ASC";
  return db.execute({ sql, args });
}

/** One coach row. */
export function selectCoachById(coachId) {
  return db.execute({ sql: "SELECT * FROM venture_coaches WHERE id = ?", args: [coachId] });
}

/** Insert one coach, returning its id. */
export function insertCoach({
  coachType, fullName, email, phone, organization, biography, yearsExperience,
  areasOfExpertiseJson, industriesJson, languagesJson, timezone, linkedinUrl, websiteUrl, createdBy,
}) {
  return db.execute({
    sql: `INSERT INTO venture_coaches (coach_type, full_name, email, phone, organization, biography, years_experience, areas_of_expertise, industries, languages, timezone, linkedin_url, website_url, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?, ?) RETURNING id`,
    args: [coachType, fullName, email, phone, organization, biography, yearsExperience, areasOfExpertiseJson, industriesJson, languagesJson, timezone, linkedinUrl, websiteUrl, createdBy],
  });
}

/** Apply a computed SET list to a coach. */
export function updateCoachColumns(sets, args) {
  return db.execute({ sql: `UPDATE venture_coaches SET ${sets.join(", ")} WHERE id = ?`, args });
}

/** Delete one coach. */
export function deleteCoachRow(coachId) {
  return db.execute({ sql: "DELETE FROM venture_coaches WHERE id = ?", args: [coachId] });
}

// ── Assignments ──────────────────────────────────────────────────────────────

/** A Venture's active coach assignments (with the coach join). */
export function selectVentureAssignments(ventureId) {
  return db.execute({
    sql: `SELECT vca.*, vc.coach_type, vc.full_name, vc.email, vc.photo_url, vc.organization, vc.biography, vc.years_experience,
       vc.areas_of_expertise, vc.industries, vc.availability, vc.timezone, vc.linkedin_url, vc.status as coach_status
       FROM venture_coach_assignments vca
       JOIN venture_coaches vc ON vca.coach_id = vc.id
       WHERE vca.venture_id = ? AND vca.status = 'active'
       ORDER BY vca.is_primary DESC, vca.assignment_date ASC`,
    args: [ventureId],
  });
}

/** The active assignment id for a coach on a Venture, if any. */
export function selectActiveCoachAssignment(ventureId, coachId) {
  return db.execute({
    sql: "SELECT id FROM venture_coach_assignments WHERE venture_id = ? AND coach_id = ? AND status = 'active'",
    args: [ventureId, coachId],
  });
}

/** Clear the primary flag for a coach type on a Venture. */
export function clearPrimaryCoachAssignments(ventureId, coachType) {
  return db.execute({
    sql: "UPDATE venture_coach_assignments SET is_primary = FALSE WHERE venture_id = ? AND coach_type = ?",
    args: [ventureId, coachType],
  });
}

/** Insert one coach assignment, returning its id. */
export function insertCoachAssignment(ventureId, coachId, coachType, isPrimary, assignedBy, notes) {
  return db.execute({
    sql: `INSERT INTO venture_coach_assignments (venture_id, coach_id, coach_type, is_primary, assigned_by, notes)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [ventureId, coachId, coachType, isPrimary, assignedBy, notes],
  });
}

/** Append a coach-activity row (assign / remove). */
export function insertCoachActivity(coachId, ventureId, action, actorCid, detailsJson) {
  return db.execute({
    sql: `INSERT INTO venture_coach_activity (coach_id, venture_id, action, actor_cid, details)
          VALUES (?, ?, ?, ?, ?::jsonb)`,
    args: [coachId, ventureId, action, actorCid, detailsJson],
  });
}

/** Mark one assignment removed, scoped by a caller-built venture predicate. */
export function markAssignmentRemoved(scopeSql, assignmentId, ids) {
  return db.execute({
    sql: `UPDATE venture_coach_assignments SET status = 'removed' WHERE id = ? AND (${scopeSql})`,
    args: [assignmentId, ...ids],
  });
}

/** Read one assignment scoped by a caller-built venture predicate. */
export function selectScopedAssignment(scopeSql, assignmentId, ids) {
  return db.execute({
    sql: `SELECT * FROM venture_coach_assignments WHERE id = ? AND (${scopeSql})`,
    args: [assignmentId, ...ids],
  });
}

/** Append a COACH_REMOVED activity row. */
export function insertCoachRemovedActivity(coachId, ventureId, removedBy, detailsJson) {
  return db.execute({
    sql: `INSERT INTO venture_coach_activity (coach_id, venture_id, action, actor_cid, details)
          VALUES (?, ?, 'COACH_REMOVED', ?, ?::jsonb)`,
    args: [coachId, ventureId, removedBy, detailsJson],
  });
}
