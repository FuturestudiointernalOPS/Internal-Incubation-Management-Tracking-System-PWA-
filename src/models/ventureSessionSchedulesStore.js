/**
 * Recurring schedules — statements (REPOSITORY layer).
 *
 * One function per statement, no decisions. The table is read by the same
 * venture reference `venture_sessions` is read by, so a schedule and the
 * sessions it will later produce always agree on which venture they belong to.
 */

import db from "@/lib/db";
import { resolveVentureInternalId } from "@/models/ventureIdentityStore";

const SELECT_COLUMNS = `id, venture_id, title, description, session_type, timezone,
  frequency, interval_count, slots, valid_from, valid_until, max_occurrences,
  status, staff_cid, staff_name, milestone_ref, version, supersedes_id,
  created_by, created_at, updated_at`;

/** Every version of every schedule of a Venture, newest version first. */
export async function selectSchedulesByVenture(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `SELECT ${SELECT_COLUMNS} FROM venture_session_schedules
           WHERE venture_id = ?
           ORDER BY id DESC`,
    args: [ventureId],
  });
}

/** One schedule, by id. */
export async function selectScheduleById(scheduleId) {
  return db.execute({
    sql: `SELECT ${SELECT_COLUMNS} FROM venture_session_schedules WHERE id = ?`,
    args: [scheduleId],
  });
}

/** Insert one schedule row, returning it. */
export async function insertScheduleRow({ ventureId, schedule, status = "draft", version = 1, supersedesId = null, actorCid = null }) {
  return db.execute({
    sql: `INSERT INTO venture_session_schedules
            (venture_id, title, description, session_type, timezone,
             frequency, interval_count, slots, valid_from, valid_until,
             max_occurrences, status, staff_cid, staff_name, milestone_ref,
             version, supersedes_id, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING ${SELECT_COLUMNS}`,
    args: [
      ventureId,
      schedule.title,
      schedule.description,
      schedule.session_type,
      schedule.timezone,
      schedule.frequency,
      schedule.interval_count,
      JSON.stringify(schedule.slots),
      schedule.valid_from,
      schedule.valid_until,
      schedule.max_occurrences,
      status,
      schedule.staff_cid,
      schedule.staff_name,
      schedule.milestone_ref,
      version,
      supersedesId,
      actorCid,
    ],
  });
}

/** Close a schedule: it stops producing occurrences after `validUntil`. */
export async function closeScheduleRow(scheduleId, validUntil) {
  return db.execute({
    sql: `UPDATE venture_session_schedules
             SET status = 'ended', valid_until = COALESCE(?, valid_until), updated_at = NOW()
           WHERE id = ?
           RETURNING ${SELECT_COLUMNS}`,
    args: [validUntil, scheduleId],
  });
}

/** Pause, resume or move a schedule back to draft — never deletes it. */
export async function setScheduleStatusRow(scheduleId, status) {
  return db.execute({
    sql: `UPDATE venture_session_schedules
             SET status = ?, updated_at = NOW()
           WHERE id = ?
           RETURNING ${SELECT_COLUMNS}`,
    args: [status, scheduleId],
  });
}

/** The exceptions recorded against a schedule (P2 will write them). */
export async function selectScheduleExceptions(scheduleId) {
  return db.execute({
    sql: `SELECT id, schedule_id, occurrence_key, kind, moved_to, reason, created_by, created_at
            FROM venture_session_schedule_exceptions
           WHERE schedule_id = ?
           ORDER BY occurrence_key ASC`,
    args: [scheduleId],
  });
}

/**
 * The version chain a schedule belongs to: every row reachable through
 * `supersedes_id`, oldest first.
 */
export async function selectScheduleChain(scheduleId) {
  return db.execute({
    sql: `WITH RECURSIVE chain AS (
            SELECT * FROM venture_session_schedules WHERE id = ?
            UNION
            SELECT s.* FROM venture_session_schedules s
              JOIN chain c ON s.id = c.supersedes_id
          )
          SELECT ${SELECT_COLUMNS} FROM chain ORDER BY version ASC`,
    args: [scheduleId],
  });
}
