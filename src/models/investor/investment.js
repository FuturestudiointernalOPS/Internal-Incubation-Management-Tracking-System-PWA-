import db from "@/lib/db";

// ── Phase 5 — investment confirmation + financing outbox ─────────────────────

/** Investor claim or studio rewrite of figures (pending or upsert). */
export async function upsertInvestorInvestmentClaim({
  investorId,
  pipelineId,
  ventureId,
  amount,
  currency,
  instrument = null,
  investedOn = null,
  recordedBy = null,
  confirmationStatus = "pending",
}) {
  return db.execute({
    sql: `INSERT INTO investor_investment_records
            (investor_profile_id, pipeline_id, venture_id, amount, currency, instrument, invested_on, recorded_by, confirmation_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (pipeline_id) DO UPDATE
            SET investor_profile_id = COALESCE(EXCLUDED.investor_profile_id, investor_investment_records.investor_profile_id),
                venture_id = COALESCE(EXCLUDED.venture_id, investor_investment_records.venture_id),
                amount = EXCLUDED.amount,
                currency = EXCLUDED.currency,
                instrument = EXCLUDED.instrument,
                invested_on = EXCLUDED.invested_on,
                recorded_by = COALESCE(EXCLUDED.recorded_by, investor_investment_records.recorded_by),
                confirmation_status = EXCLUDED.confirmation_status,
                reject_reason = NULL,
                rejected_at = NULL,
                rejected_by = NULL,
                confirmed_by = CASE WHEN EXCLUDED.confirmation_status = 'confirmed' THEN investor_investment_records.confirmed_by ELSE NULL END,
                confirmed_at = CASE WHEN EXCLUDED.confirmation_status = 'confirmed' THEN investor_investment_records.confirmed_at ELSE NULL END,
                updated_at = NOW()
          RETURNING *`,
    args: [
      investorId ?? null,
      pipelineId,
      ventureId ? String(ventureId) : null,
      amount,
      currency,
      instrument,
      investedOn ?? null,
      recordedBy,
      confirmationStatus,
    ],
  });
}

/** Studio confirm — may correct amount/currency/instrument/date. */
export async function confirmInvestorInvestmentRecord({
  id,
  amount,
  currency,
  instrument,
  investedOn,
  confirmedBy,
}) {
  return db.execute({
    sql: `UPDATE investor_investment_records
             SET amount = COALESCE(?, amount),
                 currency = COALESCE(?, currency),
                 instrument = COALESCE(?, instrument),
                 invested_on = COALESCE(?, invested_on),
                 confirmation_status = 'confirmed',
                 confirmed_by = ?,
                 confirmed_at = NOW(),
                 reject_reason = NULL,
                 rejected_at = NULL,
                 rejected_by = NULL,
                 updated_at = NOW()
           WHERE id = ? AND confirmation_status = 'pending'
           RETURNING *`,
    args: [
      amount ?? null,
      currency ?? null,
      instrument ?? null,
      investedOn ?? null,
      confirmedBy ?? null,
      id,
    ],
  });
}

export async function rejectInvestorInvestmentRecord({ id, reason, rejectedBy }) {
  return db.execute({
    sql: `UPDATE investor_investment_records
             SET confirmation_status = 'rejected',
                 reject_reason = ?,
                 rejected_at = NOW(),
                 rejected_by = ?,
                 updated_at = NOW()
           WHERE id = ? AND confirmation_status = 'pending'
           RETURNING *`,
    args: [reason, rejectedBy ?? null, id],
  });
}

export async function getInvestorInvestmentById(id) {
  return db.execute({
    sql: "SELECT * FROM investor_investment_records WHERE id = ?",
    args: [id],
  });
}

export async function listInvestmentsForInvestor(investorId) {
  return db.execute({
    sql: `SELECT * FROM investor_investment_records
           WHERE investor_profile_id = ?
           ORDER BY invested_on DESC NULLS LAST, created_at DESC`,
    args: [investorId],
  });
}

export async function getInvestorInvestmentByPipeline(pipelineId) {
  return db.execute({
    sql: "SELECT * FROM investor_investment_records WHERE pipeline_id = ?",
    args: [pipelineId],
  });
}

/** Studio confirmation queue. */
export async function listInvestmentClaimsForStudio({ status = "pending" } = {}) {
  const args = [];
  let statusClause = "";
  if (status && status !== "all") {
    statusClause = "AND r.confirmation_status = ?";
    args.push(status);
  }
  return db.execute({
    sql: `SELECT r.*,
                 ip.organization_name,
                 c.name AS investor_name,
                 c.email AS investor_email,
                 COALESCE(p.name, v.name, v.company_name) AS venture_name
            FROM investor_investment_records r
            JOIN investor_profiles ip ON ip.id = r.investor_profile_id
            LEFT JOIN contacts c ON c.cid = ip.user_id
            LEFT JOIN v2_programs p ON p.id = r.venture_id
            LEFT JOIN ventures v ON v.id::text = r.venture_id OR v.venture_id = r.venture_id
           WHERE 1=1 ${statusClause}
           ORDER BY r.created_at DESC
           LIMIT 200`,
    args,
  });
}

export async function countPendingInvestmentsForInvestor(investorId) {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS count
            FROM investor_investment_records
           WHERE investor_profile_id = ? AND confirmation_status = 'pending'`,
    args: [investorId],
  });
}

/** Resolve the venture UUID + code used by `venture_event_log`. */
export async function selectVentureForFinancing(ref) {
  const value = String(ref ?? "").trim();
  return db.execute({
    sql: `SELECT id::text AS uuid, venture_id AS code
            FROM ventures
           WHERE id::text = ? OR venture_id = ? LIMIT 1`,
    args: [value, value],
  });
}

export async function selectFinancingByMarker(marker) {
  return db.execute({
    sql: `SELECT id FROM venture_event_log
           WHERE evidence_name = ? AND event_type = 'financing_received' AND deleted_at IS NULL
           LIMIT 1`,
    args: [marker],
  });
}

/** One outside financing event on the venture (idempotent via the marker). */
export async function insertInvestorFinancingEvent({
  ventureUuid,
  ventureCode,
  amount,
  currency,
  financingType,
  eventDate,
  marker,
  actorCid,
  title,
}) {
  return db.execute({
    sql: `INSERT INTO venture_event_log
            (venture_uuid, venture_code, event_type, event_date, title,
             amount_mode, amount_value, financing_type, source, evidence_name, currency, created_by)
          VALUES (?::uuid, ?, 'financing_received', ?, ?, 'exact', ?, ?, 'investor', ?, ?, ?)
          RETURNING id`,
    args: [
      ventureUuid,
      ventureCode,
      eventDate,
      title,
      amount,
      financingType ?? null,
      marker,
      currency ?? null,
      actorCid ?? null,
    ],
  });
}

export async function enqueueOutbox({ kind, payload, idempotencyKey }) {
  return db.execute({
    sql: `INSERT INTO investor_outbox (kind, payload, idempotency_key)
          VALUES (?, ?::jsonb, ?)
          ON CONFLICT (idempotency_key) DO NOTHING
          RETURNING id`,
    args: [kind, JSON.stringify(payload || {}), idempotencyKey],
  });
}

export async function listPendingOutbox(limit = 50) {
  return db.execute({
    sql: "SELECT * FROM investor_outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?",
    args: [limit],
  });
}

export async function markOutboxProcessed(id) {
  return db.execute({
    sql: "UPDATE investor_outbox SET status = 'processed', processed_at = NOW() WHERE id = ?",
    args: [id],
  });
}

export async function markOutboxFailed({ id, error }) {
  return db.execute({
    sql: `UPDATE investor_outbox
             SET attempts = attempts + 1,
                 last_error = ?,
                 status = CASE WHEN attempts >= 4 THEN 'failed' ELSE 'pending' END
           WHERE id = ?`,
    args: [String(error).slice(0, 500), id],
  });
}

export async function updateInvestmentFinancingEvent({ id, financingEventId }) {
  return db.execute({
    sql: `UPDATE investor_investment_records
             SET financing_event_id = ?, updated_at = NOW()
           WHERE id = ?`,
    args: [financingEventId, id],
  });
}

export async function insertInvestmentRejectedInvestorNotification({
  recipient_id,
  venture_name,
  reason,
  link,
}) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
          VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
    args: [
      recipient_id,
      `Investment not confirmed: ${venture_name || "Venture"}`,
      `Future Studio could not confirm your investment${reason ? `: ${reason}` : "."}`,
      link,
    ],
  });
}
