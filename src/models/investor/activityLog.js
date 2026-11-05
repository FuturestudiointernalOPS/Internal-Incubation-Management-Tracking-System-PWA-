import db from "@/lib/db";

/**
 * Append-only investor event store (Phase 1).
 *
 * A row is immutable and self-contained: the facts a report needs later
 * (visibility mode, currency + rate, timezone) are SNAPSHOTTED here, so history
 * never depends on a mutable table. `dedupe_key` collapses repeat views.
 */
export async function insertActivityEvent(event) {
  const eventId =
    event.event_id ||
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const result = await db.execute({
    sql: `INSERT INTO investor_activity_log
            (event_id, occurred_at, event_type, investor_id, venture_id, related_id,
             actor_type, actor_id, visibility_mode, currency, amount, fx_rate,
             fx_rate_date, timezone, metadata, dedupe_key, session_id)
          VALUES (?, COALESCE(?, NOW()), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)
          ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
          RETURNING event_id`,
    args: [
      eventId,
      event.occurred_at || null,
      event.event_type,
      event.investor_id ?? null,
      event.venture_id ?? null,
      event.related_id ?? null,
      event.actor_type || "system",
      event.actor_id ?? null,
      event.visibility_mode ?? null,
      event.currency ?? null,
      event.amount ?? null,
      event.fx_rate ?? null,
      event.fx_rate_date ?? null,
      event.timezone ?? null,
      JSON.stringify(event.metadata || {}),
      event.dedupe_key ?? null,
      event.session_id ?? null,
    ],
  });

  return result.rows?.[0]?.event_id || eventId;
}

/** Profile id + visibility mode for a session's user (read-only). */
export async function selectInvestorContext(userId) {
  return db.execute({
    sql: "SELECT id, user_id, visibility_mode, is_test FROM investor_profiles WHERE user_id = ? LIMIT 1",
    args: [userId],
  });
}

export async function listActivityForInvestor(investorId, limit = 200) {
  return db.execute({
    sql: "SELECT * FROM investor_activity_log WHERE investor_id = ? ORDER BY occurred_at DESC LIMIT ?",
    args: [investorId, limit],
  });
}

export async function listActivityForVenture(ventureId, limit = 200) {
  return db.execute({
    sql: "SELECT * FROM investor_activity_log WHERE venture_id = ? ORDER BY occurred_at DESC LIMIT ?",
    args: [ventureId, limit],
  });
}
