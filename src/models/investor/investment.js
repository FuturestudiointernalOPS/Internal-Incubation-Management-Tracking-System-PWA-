import db from "@/lib/db";

// ── Phase 7 — investment confirmation + financing outbox ─────────────────────

export async function upsertInvestorInvestment({
  investorId,
  pipelineId,
  ventureId,
  amount,
  currency,
  instrument = null,
  investedOn = null,
  recordedBy = null,
}) {
  return db.execute({
    sql: `INSERT INTO investor_investments
            (investor_id, pipeline_id, venture_id, amount, currency, instrument, invested_on, recorded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (pipeline_id) DO UPDATE
            SET investor_id = COALESCE(EXCLUDED.investor_id, investor_investments.investor_id),
                venture_id = COALESCE(EXCLUDED.venture_id, investor_investments.venture_id),
                amount = EXCLUDED.amount,
                currency = EXCLUDED.currency,
                instrument = EXCLUDED.instrument,
                invested_on = EXCLUDED.invested_on,
                recorded_by = EXCLUDED.recorded_by,
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
    ],
  });
}

export async function listInvestmentsForInvestor(investorId) {
  return db.execute({
    sql: `SELECT * FROM investor_investments
           WHERE investor_id = ?
           ORDER BY invested_on DESC NULLS LAST, created_at DESC`,
    args: [investorId],
  });
}

export async function getInvestorInvestmentByPipeline(pipelineId) {
  return db.execute({
    sql: "SELECT * FROM investor_investments WHERE pipeline_id = ?",
    args: [pipelineId],
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
    sql: "UPDATE investor_investments SET financing_event_id = ?, updated_at = NOW() WHERE id = ?",
    args: [financingEventId, id],
  });
}
