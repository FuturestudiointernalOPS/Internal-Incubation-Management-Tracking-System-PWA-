import {
  upsertInvestorInvestment,
  listInvestmentsForInvestor,
  selectVentureForFinancing,
  selectFinancingByMarker,
  insertInvestorFinancingEvent,
  enqueueOutbox,
  listPendingOutbox,
  markOutboxProcessed,
  markOutboxFailed,
  updateInvestmentFinancingEvent,
} from "@/models/investor/investment";
import { emitInvestorEvent } from "@/services/investor/activity";

/**
 * The studio confirms an investment. The confirmation is stored, then a
 * financing event is written to the Ventures module through the outbox —
 * idempotently, keyed on the pipeline — so the founder is never asked twice and
 * a retry cannot double-count capital.
 */
export async function recordInvestment({
  investorId,
  pipelineId,
  ventureId,
  amount,
  currency,
  instrument = null,
  investedOn = null,
  session,
}) {
  if (!pipelineId || amount == null || !currency) {
    return { ok: false, status: 400, error: "pipeline_id, amount and currency are required." };
  }

  const actor = session?.cid || session?.id || null;

  const saved = await upsertInvestorInvestment({
    investorId,
    pipelineId,
    ventureId,
    amount,
    currency,
    instrument,
    investedOn,
    recordedBy: actor,
  });
  const investment = saved.rows?.[0];

  await enqueueOutbox({
    kind: "financing_event",
    idempotencyKey: `investment:${pipelineId}`,
    payload: {
      investment_id: investment?.id ?? null,
      pipeline_id: pipelineId,
      investor_id: investorId ?? null,
      venture_id: ventureId ?? null,
      amount,
      currency,
      instrument,
      invested_on: investedOn,
      recorded_by: actor,
      title: "Investor financing",
    },
  });

  await processFinancingOutbox();

  await emitInvestorEvent({
    session,
    eventType: "investment_recorded",
    investorId,
    ventureId: ventureId ? String(ventureId) : null,
    currency,
    amount,
    metadata: { pipeline_id: pipelineId, instrument, invested_on: investedOn },
  });

  return { ok: true, investment };
}

/** Apply pending outbox rows. Never throws per row; failures are retried. */
export async function processFinancingOutbox() {
  const pending = await listPendingOutbox(50);
  let processed = 0;

  for (const row of pending.rows || []) {
    try {
      if (row.kind === "financing_event") {
        const payload = row.payload || {};
        const existing = await selectFinancingByMarker(row.idempotency_key);

        if ((existing.rows || []).length === 0) {
          const venture = await selectVentureForFinancing(payload.venture_id);
          const resolved = venture.rows?.[0];

          if (resolved?.uuid) {
            const inserted = await insertInvestorFinancingEvent({
              ventureUuid: resolved.uuid,
              ventureCode: resolved.code,
              amount: payload.amount,
              currency: payload.currency,
              financingType: payload.instrument,
              eventDate: payload.invested_on || new Date().toISOString().slice(0, 10),
              marker: row.idempotency_key,
              actorCid: payload.recorded_by,
              title: payload.title || "Investor financing",
            });
            const financingEventId = inserted.rows?.[0]?.id;
            if (financingEventId && payload.investment_id) {
              await updateInvestmentFinancingEvent({
                id: payload.investment_id,
                financingEventId,
              });
            }
          }
        }
      }

      await markOutboxProcessed(row.id);
      processed += 1;
    } catch (error) {
      await markOutboxFailed({ id: row.id, error: error?.message || error }).catch(() => {});
    }
  }

  return { ok: true, processed };
}

export async function listMyInvestments({ investorId }) {
  return { ok: true, investments: (await listInvestmentsForInvestor(investorId)).rows };
}
