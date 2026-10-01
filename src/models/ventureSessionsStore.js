/**
 * Venture mentoring sessions & scheduling — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/sessions`: the session list and
 * row (with notes / attendance / action items), the booking-conflict probes, the
 * session writes (with the legacy-column fallbacks), the session-activity log,
 * the notes, the attendance upsert and the action items.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Reads ────────────────────────────────────────────────────────────────────

/** A Venture's sessions (optional filters), newest first. */
export function selectSessions(ventureId, filters = {}) {
  let sql = "SELECT * FROM venture_sessions WHERE venture_id = ?";
  const args = [ventureId];
  if (filters.startDate) { sql += " AND start_time >= ?"; args.push(filters.startDate); }
  if (filters.endDate) { sql += " AND end_time <= ?"; args.push(filters.endDate); }
  if (filters.status) { sql += " AND status = ?"; args.push(filters.status); }
  if (filters.coachId) { sql += " AND coach_id = ?"; args.push(parseInt(filters.coachId)); }
  sql += " ORDER BY start_time DESC";
  if (filters.limit) { sql += " LIMIT ?"; args.push(parseInt(filters.limit)); }
  return db.execute({ sql, args });
}

/** One session row. */
export function selectSessionById(sessionId) {
  return db.execute({ sql: "SELECT * FROM venture_sessions WHERE id = ?", args: [sessionId] });
}

/** A session's notes, oldest first. */
export function selectSessionNotes(sessionId) {
  return db.execute({ sql: "SELECT * FROM venture_session_notes WHERE session_id = ? ORDER BY created_at ASC", args: [sessionId] });
}

/** A session's attendance rows. */
export function selectSessionAttendance(sessionId) {
  return db.execute({ sql: "SELECT * FROM venture_session_attendance WHERE session_id = ?", args: [sessionId] });
}

/** A session's action items, newest first. */
export function selectSessionActionItems(sessionId) {
  return db.execute({ sql: "SELECT * FROM venture_session_action_items WHERE session_id = ? ORDER BY created_at DESC", args: [sessionId] });
}

/** Sessions of a Venture that overlap a window (optional excluded id). */
export function selectVentureSessionConflicts(ventureId, endTime, startTime, excludeSessionId) {
  let sql = `SELECT id FROM venture_sessions WHERE venture_id = ? AND status NOT IN ('cancelled','no_show') AND start_time < ? AND end_time > ?`;
  const args = [ventureId, endTime, startTime];
  if (excludeSessionId) { sql += " AND id != ?"; args.push(parseInt(excludeSessionId)); }
  return db.execute({ sql, args });
}

/** Sessions of a coach that overlap a window. */
export function selectCoachSessionConflicts(coachId, endTime, startTime) {
  return db.execute({
    sql: `SELECT id FROM venture_sessions WHERE coach_id = ? AND status NOT IN ('cancelled','no_show') AND start_time < ? AND end_time > ?`,
    args: [parseInt(coachId), endTime, startTime],
  });
}

// ── Session writes ───────────────────────────────────────────────────────────

/** Insert a session with every current column (materials included). */
export function insertSessionFull(args) {
  return db.execute({
    sql: `INSERT INTO venture_sessions (venture_id, title, description, session_type, coach_id, coach_name, founder_cid, founder_name, start_time, end_time, timezone, location, meeting_link, agenda, created_by, venture_facing, preparation_notes, journey_stage_id, milestone_ref, task_id, coach_contact_id, deliverable_id, materials)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args,
  });
}

/** Insert a session on a database without the `materials` column. */
export function insertSessionWithoutMaterials(args) {
  return db.execute({
    sql: `INSERT INTO venture_sessions (venture_id, title, description, session_type, coach_id, coach_name, founder_cid, founder_name, start_time, end_time, timezone, location, meeting_link, agenda, created_by, venture_facing, preparation_notes, journey_stage_id, milestone_ref, task_id, coach_contact_id, deliverable_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args,
  });
}

/** Insert a session on a database without the `deliverable_id`/`materials` columns. */
export function insertSessionWithoutDeliverable(args) {
  return db.execute({
    sql: `INSERT INTO venture_sessions (venture_id, title, description, session_type, coach_id, coach_name, founder_cid, founder_name, start_time, end_time, timezone, location, meeting_link, agenda, created_by, venture_facing, preparation_notes, journey_stage_id, milestone_ref, task_id, coach_contact_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args,
  });
}

/** Append the SESSION_CREATED activity row. */
export function insertSessionActivityCreated(sessionId, ventureId, actorCid, detailsJson) {
  return db.execute({
    sql: `INSERT INTO venture_session_activity (session_id, venture_id, action, actor_cid, details) VALUES (?, ?, 'SESSION_CREATED', ?, ?::jsonb)`,
    args: [sessionId, ventureId, actorCid, detailsJson],
  });
}

/** Append the SESSION_CANCELLED activity row. */
export function insertSessionActivityCancelled(sessionId, detailsJson) {
  return db.execute({
    sql: `INSERT INTO venture_session_activity (session_id, action, details) VALUES (?, 'SESSION_CANCELLED', ?::jsonb)`,
    args: [sessionId, detailsJson],
  });
}

/** Append the SESSION_COMPLETED activity row. */
export function insertSessionActivityCompleted(sessionId, detailsJson) {
  return db.execute({
    sql: `INSERT INTO venture_session_activity (session_id, action, details) VALUES (?, 'SESSION_COMPLETED', ?::jsonb)`,
    args: [sessionId, detailsJson],
  });
}

/** Append the SESSION_RESCHEDULED activity row. */
export function insertSessionActivityRescheduled(sessionId, detailsJson) {
  return db.execute({
    sql: `INSERT INTO venture_session_activity (session_id, action, details) VALUES (?, 'SESSION_RESCHEDULED', ?::jsonb)`,
    args: [sessionId, detailsJson],
  });
}

/** Apply a computed SET list to a session. */
export function updateSessionColumns(sets, args) {
  return db.execute({ sql: `UPDATE venture_sessions SET ${sets.join(", ")} WHERE id = ?`, args });
}

/** Move a session to a new window and mark it rescheduled. */
export function updateSessionWindow(sessionId, newStartTime, newEndTime) {
  return db.execute({ sql: "UPDATE venture_sessions SET start_time = ?, end_time = ?, status = 'rescheduled', updated_at = NOW() WHERE id = ?", args: [newStartTime, newEndTime, sessionId] });
}

/** Delete one session. */
export function deleteSessionRow(sessionId) {
  return db.execute({ sql: "DELETE FROM venture_sessions WHERE id = ?", args: [sessionId] });
}

/** Insert one session note, returning its id. */
export function insertSessionNote(sessionId, noteType, content, authorCid, authorName, attachmentsJson) {
  return db.execute({
    sql: `INSERT INTO venture_session_notes (session_id, note_type, content, author_cid, author_name, attachments) VALUES (?, ?, ?, ?, ?, ?::jsonb) RETURNING id`,
    args: [sessionId, noteType, content, authorCid, authorName, attachmentsJson],
  });
}

/** Upsert one attendance row. */
export function upsertSessionAttendance(sessionId, participantCid, participantName, participantType, status) {
  return db.execute({
    sql: `INSERT INTO venture_session_attendance (session_id, participant_cid, participant_name, participant_type, status) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (session_id, participant_cid) DO UPDATE SET status = ?, timestamp = NOW()`,
    args: [sessionId, participantCid, participantName, participantType, status, status],
  });
}

/** Insert one action item, returning its id. */
export function insertActionItem(sessionId, title, description, ownerCid, ownerName, priority, dueDate) {
  return db.execute({
    sql: `INSERT INTO venture_session_action_items (session_id, title, description, owner_cid, owner_name, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [sessionId, title, description, ownerCid, ownerName, priority, dueDate],
  });
}

/** Apply a computed SET list to an action item, scoped to the Venture's sessions. */
export function updateActionItemScoped(sets, args, scopeSql, ids) {
  return db.execute({
    sql: `UPDATE venture_session_action_items SET ${sets.join(", ")}
          WHERE id = ? AND session_id IN (SELECT id FROM venture_sessions WHERE ${scopeSql})`,
    args: [...args, ...ids],
  });
}
