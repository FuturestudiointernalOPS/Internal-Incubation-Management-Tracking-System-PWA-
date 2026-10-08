import db from "@/lib/db";

import { ensureCheckoutSchema } from "./schema";

/**
 * CHECKOUT REGISTRATIONS — the payment-event journal.
 *
 * Split verbatim out of `models/lms/registrations.js` — see docs/LAYER_SPLIT.md.
 */

/**
 * Append a provider notification to the journal. A repeat of the same event is
 * IGNORED, not raised: Kkiapay retries, and a 500 here would only trigger more
 * retries. Unknown references and refused amounts land here too — a refused
 * notification is never dropped silently.
 */
export async function recordPaymentEvent({
  registrationId = null,
  reference = null,
  runId = null,
  provider = null,
  eventType = "notification",
  transactionId = null,
  partnerId = null,
  amount = null,
  status = "received",
  message = null,
  payload = null,
} = {}) {
  await ensureCheckoutSchema();
  return db.execute({
    sql: `INSERT INTO lms_payment_events
            (registration_id, reference, run_id, provider, event_type, provider_transaction_id,
             partner_id, amount, status, message, payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON CONFLICT (provider, provider_transaction_id, event_type)
            WHERE provider_transaction_id IS NOT NULL AND event_type IS NOT NULL
          DO NOTHING`,
    args: [
      registrationId,
      reference,
      runId,
      provider,
      eventType,
      transactionId,
      partnerId,
      amount,
      status,
      message,
      payload ? JSON.stringify(payload) : null,
    ],
  });
}

/** The most recent journal line for one registration (shown in the team view). */
export async function getLatestPaymentEventByRegistrationId(registrationId) {
  const res = await db.execute({
    sql: `SELECT status, message, created_at FROM lms_payment_events
          WHERE registration_id = ? ORDER BY created_at DESC`,
    args: [registrationId],
  });
  return res.rows[0] || null;
}

/** The journal, newest intent first — including orphan lines (no registration). */
export async function listPaymentEvents({ status } = {}) {
  await ensureCheckoutSchema();
  const clauses = [];
  const args = [];
  if (status) {
    clauses.push("status = ?");
    args.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const res = await db.execute({
    sql: `SELECT id, registration_id, reference, run_id, provider, event_type,
                 provider_transaction_id, partner_id, amount, status, message, created_at
          FROM lms_payment_events ${where} ORDER BY created_at DESC`,
    args,
  });
  return res.rows;
}

/**
 * The newest journal line of each registration in the list — ONE query, so the
 * team view never runs per-row lookups.
 */
export async function listPaymentEventsByRegistrationIds(ids) {
  const list = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
  if (list.length === 0) return [];
  const res = await db.execute({
    sql: `SELECT registration_id, status, message, created_at FROM lms_payment_events
          WHERE registration_id IN (${list.map(() => "?").join(",")})
          ORDER BY created_at DESC`,
    args: list,
  });
  return res.rows;
}
