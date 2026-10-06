import db from "@/lib/db";

/**
 * Communications — calendar-event reads and writes (REPOSITORY layer).
 *
 * Split verbatim out of `models/communications.js` — see docs/LAYER_SPLIT.md.
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Event rows, optionally filtered by program_id. */
export async function listEvents({ programId }) {
  let sql = "SELECT * FROM v2_events";
  let args = [];

  if (programId) {
    sql += " WHERE program_id = ?";
    args.push(programId);
  }

  return db.execute({ sql, args });
}

/** Create an event and return the full row. */
export async function insertEvent({
  programId,
  title,
  description,
  eventType,
  startTime,
  endTime,
  location,
  createdBy,
}) {
  return db.execute({
    sql: `INSERT INTO v2_events (program_id, title, description, event_type, start_time, end_time, location, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [
      programId,
      title,
      description,
      eventType || "meeting",
      startTime,
      endTime || null,
      location || null,
      createdBy,
    ],
  });
}

/** Notify a participant that a meeting event was scheduled. */
export async function insertEventNotification(recipientId, title, message) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, 'event', 0, NOW())`,
    args: [recipientId, title, message],
  });
}
