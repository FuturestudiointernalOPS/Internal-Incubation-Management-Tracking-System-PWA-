/**
 * Venture activity, history and notifications — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/activity`: the activity-log and
 * history inserts, the notification dedupe probe and insert, and the founder
 * audience reads. The audience shaping and the templating live in the service.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Activity log + history ───────────────────────────────────────────────────

/** Append one venture_activity_log row. */
export function insertVentureActivity(ventureId, action, actorCid, actorName, detailsJson) {
  return db.execute({
    sql: `INSERT INTO venture_activity_log (venture_id, action, actor_cid, actor_name, details)
          VALUES (?, ?, ?, ?, ?::jsonb)`,
    args: [ventureId, action, actorCid, actorName, detailsJson],
  });
}

/** Append one venture_history row. */
export function insertVentureHistory(ventureId, eventType, description, metadataJson) {
  return db.execute({
    sql: `INSERT INTO venture_history (venture_id, event_type, description, metadata)
          VALUES (?, ?, ?, ?::jsonb)`,
    args: [ventureId, eventType, description, metadataJson],
  });
}

// ── Notifications ────────────────────────────────────────────────────────────

/** Whether a notification with this dedupe key already exists for the recipient. */
export function selectNotificationByDedupe(recipientId, dedupeKey) {
  return db.execute({
    sql: "SELECT 1 FROM v2_notifications WHERE recipient_id = ? AND dedupe_key = ? LIMIT 1",
    args: [recipientId, dedupeKey],
  });
}

/** Insert one v2_notifications row (columns/placeholders assembled by the service). */
export function insertVentureNotification(cols, placeholders, args) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`,
    args,
  });
}

// ── Founder audience ─────────────────────────────────────────────────────────

/** The VNT code of a Venture from its internal id. */
export function selectActivityVentureCode(dbId) {
  return db.execute({ sql: "SELECT venture_id FROM ventures WHERE id = ?", args: [dbId] });
}

/** A Venture's live founder contact ids (code-keyed). */
export function selectFounderContactIds(code) {
  return db.execute({
    sql: "SELECT contact_id FROM venture_members WHERE venture_id = ? AND member_type = 'founder' AND removed_at IS NULL",
    args: [code],
  });
}
