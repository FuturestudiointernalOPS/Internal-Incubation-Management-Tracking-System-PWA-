import db from "@/lib/db";

// Keep legacy BIGINT columns intact. Canonical UUID references are snapshotted
// in server-owned JSON metadata rather than incorrectly cast to numbers.
function legacyInteger(value) {
  const text = String(value ?? "");
  if (!/^\d+$/.test(text)) return null;
  return BigInt(text) <= 9223372036854775807n ? text : null;
}

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

  const statement = {
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
      legacyInteger(event.investor_id),
      event.venture_id ?? null,
      legacyInteger(event.related_id),
      event.actor_type || "system",
      event.actor_id ?? null,
      event.visibility_mode ?? null,
      event.currency ?? null,
      event.amount ?? null,
      event.fx_rate ?? null,
      event.fx_rate_date ?? null,
      event.timezone ?? null,
      JSON.stringify({
        ...event.metadata,
        investor_ref: event.investor_id == null ? null : String(event.investor_id),
        related_ref: event.related_id == null ? null : String(event.related_id),
        is_test: event.is_test === true,
      }),
      event.dedupe_key ? `${event.dedupe_key}:${eventId}` : null,
      event.session_id ?? null,
    ],
  };
  if (!event.dedupe_key) {
    const result = await db.execute(statement);
    return result.rows?.[0]?.event_id || null;
  }
  // Serialize concurrent views on the same actor/venture. The SELECT executes
  // after the lock in a READ COMMITTED transaction, so it sees a waited-on insert.
  return db.transaction(async query => {
    await query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [event.dedupe_key]);
    const previous = await query(
      `SELECT event_id FROM investor_activity_log
        WHERE event_type = ? AND actor_id IS NOT DISTINCT FROM ?
          AND venture_id IS NOT DISTINCT FROM ?
          AND occurred_at > clock_timestamp() - INTERVAL '30 minutes'
        ORDER BY occurred_at DESC LIMIT 1`,
      [event.event_type, event.actor_id ?? null, event.venture_id ?? null],
    );
    if (previous.rows.length) return null;
    const result = await query(statement.sql, statement.args);
    return result.rows?.[0]?.event_id || null;
  });
}

/** Profile id + visibility mode for a session's user (read-only). */
export async function selectInvestorContext(userId) {
  return db.execute({
    sql: `SELECT ip.id, ip.user_id, ip.visibility_mode, ip.is_test, ip.approval_status,
                 ip.nda_accepted_at, ip.nda_version,
                 CASE WHEN c.language IN ('en', 'fr') THEN c.language ELSE NULL END AS preferred_language,
                 CASE WHEN c.language IN ('en', 'fr') THEN c.language ELSE NULL END AS language
            FROM investor_profiles ip
            LEFT JOIN contacts c ON c.cid = ip.user_id
           WHERE ip.user_id = ?
           LIMIT 1`,
    args: [userId],
  });
}

export async function listActivityForInvestor(investorId, limit = 200) {
  return db.execute({
    sql: "SELECT * FROM investor_activity_log WHERE COALESCE(metadata->>'investor_ref', investor_id::text) = ? ORDER BY occurred_at DESC LIMIT ?",
    args: [String(investorId), limit],
  });
}

export async function listActivityForVenture(ventureId, limit = 200) {
  return db.execute({
    sql: "SELECT * FROM investor_activity_log WHERE venture_id = ? ORDER BY occurred_at DESC LIMIT ?",
    args: [ventureId, limit],
  });
}

/** Own aggregates for the dashboard, never the studio's raw activity register. */
export async function listInvestorWeeklyActivity(investorId) {
  return db.execute({
    sql: `SELECT to_char(date_trunc('week', occurred_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS week,
            COUNT(*) FILTER (WHERE event_type = 'venture_viewed')::int AS views,
            COUNT(*) FILTER (WHERE event_type = 'interest_expressed')::int AS interests,
            COUNT(*) FILTER (WHERE event_type = 'intro_requested')::int AS introductions
          FROM investor_activity_log
          WHERE COALESCE(metadata->>'investor_ref', investor_id::text) = ?
            AND actor_type = 'investor' AND COALESCE(metadata->>'is_test', 'false') <> 'true'
            AND occurred_at >= date_trunc('week', NOW()) - INTERVAL '11 weeks'
            AND event_type IN ('venture_viewed', 'interest_expressed', 'intro_requested')
          GROUP BY 1 ORDER BY 1`, args: [String(investorId)],
  });
}
