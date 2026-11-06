import {
  upsertInvestorInvestmentClaim,
  confirmInvestorInvestmentRecord,
  rejectInvestorInvestmentRecord,
  getInvestorInvestmentById,
  listInvestmentsForInvestor,
  listInvestmentClaimsForStudio,
  selectVentureForFinancing,
  selectFinancingByMarker,
  insertInvestorFinancingEvent,
  enqueueOutbox,
  listPendingOutbox,
  markOutboxProcessed,
  markOutboxFailed,
  updateInvestmentFinancingEvent,
  insertInvestmentRejectedInvestorNotification,
} from "@/models/investor/investment";
import {
  addInvestmentToActiveCampaign,
  createInvestmentDecision,
  getInvestmentNotificationInfo,
  getRelationshipWorkspaceAssigneesForInvestment,
  getRelationshipWorkspaceIdForInvestment,
  insertInvestmentCommittedTimeline,
  insertInvestmentConfirmedAdminNotification,
  insertInvestmentConfirmedInvestorNotification,
  insertInvestmentConfirmedStaffNotification,
  listAdminAndStaffCids,
  markRelationshipWorkspaceActiveInvestment,
  upsertInvestmentPipeline,
  getInvestorProfileIdByUserId,
} from "@/models/investor";
import { emitInvestorEvent } from "@/services/investor/activity";
import { readInvestorFlags } from "@/services/investor/featureFlags";

/**
 * Side effects that fire ONLY after studio confirmation (or when the
 * confirmation flag is off and the investor sets Invested directly).
 */
export async function runInvestedSideEffects({
  pipelineId,
  ventureId,
  investorId,
  amount,
  currency = null,
  instrument = null,
  investedOn = null,
  investmentId = null,
  notes = null,
  session,
  enqueueFinancing = true,
}) {
  const investedAmount = Number(amount) || 0;

  await createInvestmentDecision({
    pipeline_id: pipelineId,
    investment_amount: investedAmount,
    notes,
  });

  if (investedAmount > 0) {
    try {
      await addInvestmentToActiveCampaign({ amount: investedAmount, venture_id: ventureId });
    } catch (_) {}
  }

  try {
    const relationshipWorkspaceResult =
      await getRelationshipWorkspaceIdForInvestment(pipelineId);
    if (relationshipWorkspaceResult.rows.length > 0) {
      await insertInvestmentCommittedTimeline({
        workspace_id: relationshipWorkspaceResult.rows[0].id,
        investment_amount: investedAmount,
      });
      await markRelationshipWorkspaceActiveInvestment(relationshipWorkspaceResult.rows[0].id);
    }
  } catch (_) {}

  try {
    const notificationInfo = await getInvestmentNotificationInfo({
      venture_id: ventureId,
      investor_id: investorId,
    });
    const investorInfo = notificationInfo.rows[0] || {};

    const admins = await listAdminAndStaffCids();
    for (const admin of admins.rows) {
      await insertInvestmentConfirmedAdminNotification({
        recipient_id: admin.cid,
        investor_name: investorInfo.investor_name,
        organization_name: investorInfo.organization_name,
        venture_name: investorInfo.venture_name,
        investment_amount: investedAmount,
        link: "/admin/investors/investments",
      });
    }

    if (investorInfo.user_id) {
      await insertInvestmentConfirmedInvestorNotification({
        recipient_id: investorInfo.user_id,
        venture_name: investorInfo.venture_name,
        investment_amount: investedAmount,
        link: "/investor/dashboard",
      });
    }

    const relationshipWorkspaceResult =
      await getRelationshipWorkspaceAssigneesForInvestment(pipelineId);
    if (relationshipWorkspaceResult.rows.length > 0) {
      const relationshipWorkspace = relationshipWorkspaceResult.rows[0];
      for (const cid of [
        relationshipWorkspace.relationship_manager_id,
        relationshipWorkspace.investment_manager_id,
      ]) {
        if (cid) {
          await insertInvestmentConfirmedStaffNotification({
            recipient_id: cid,
            investor_name: investorInfo.investor_name,
            venture_name: investorInfo.venture_name,
            investment_amount: investedAmount,
            link: "/admin/investors/relationships",
          });
        }
      }
    }
  } catch (_) {}

  if (enqueueFinancing) {
    await enqueueOutbox({
      kind: "financing_event",
      idempotencyKey: `investment:${pipelineId}`,
      payload: {
        investment_id: investmentId,
        pipeline_id: pipelineId,
        investor_id: investorId ?? null,
        venture_id: ventureId ?? null,
        amount: investedAmount,
        currency,
        instrument,
        invested_on: investedOn,
        recorded_by: session?.cid || session?.id || null,
        title: "Investor financing",
      },
    });
  }
}

/**
 * Investor claims an investment. Pipeline moves to Invested; nothing else
 * fires until the studio confirms (Decision §5.4 / Phase 5).
 */
export async function claimInvestment({
  ventureId,
  amount,
  currency,
  instrument = null,
  investedOn = null,
  session,
}) {
  if (!ventureId || amount == null || !currency) {
    return { ok: false, status: 400, error: "venture_id, amount and currency are required." };
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { ok: false, status: 400, error: "amount must be a positive number." };
  }

  const flags = await readInvestorFlags();
  if (!flags.investmentConfirmation) {
    return { ok: false, status: 403, error: "Investment confirmation is not enabled." };
  }

  const profileResult = await getInvestorProfileIdByUserId(session.cid || session.id);
  if (profileResult.rows.length === 0) {
    return { ok: false, status: 404, error: "Investor profile not found" };
  }
  const investorId = profileResult.rows[0].id;
  const actor = session?.cid || session?.id || null;

  const pipelineResult = await upsertInvestmentPipeline({
    investor_id: investorId,
    venture_id: ventureId,
    stage: "invested",
    notes: null,
  });
  const pipeline = pipelineResult.rows?.[0];
  if (!pipeline?.id) {
    return { ok: false, status: 500, error: "Could not update pipeline." };
  }

  const saved = await upsertInvestorInvestmentClaim({
    investorId,
    pipelineId: pipeline.id,
    ventureId,
    amount: numericAmount,
    currency: String(currency).trim().toUpperCase(),
    instrument: instrument ? String(instrument).trim() : null,
    investedOn: investedOn || null,
    recordedBy: actor,
    confirmationStatus: "pending",
  });
  const investment = saved.rows?.[0];

  // No investment_recorded, financing, decision, campaign or notifications yet.
  await emitInvestorEvent({
    session,
    eventType: "pipeline_stage_changed",
    investorId,
    ventureId: String(ventureId),
    relatedId: pipeline.id,
    metadata: { stage: "invested", confirmation_status: "pending" },
  }).catch(() => {});

  const { was_inserted: _inserted, ...pipelineRow } = pipeline;
  return { ok: true, investment, pipeline: pipelineRow };
}

/**
 * Studio confirms a pending claim (optionally correcting figures). Then the
 * existing invested side effects fire and investment_recorded is logged.
 */
export async function confirmInvestment({
  id,
  amount = null,
  currency = null,
  instrument = null,
  investedOn = null,
  session,
}) {
  const actor = session?.cid || session?.id || null;
  const confirmed = await confirmInvestorInvestmentRecord({
    id,
    amount: amount != null ? Number(amount) : null,
    currency: currency ? String(currency).trim().toUpperCase() : null,
    instrument: instrument != null ? String(instrument).trim() : null,
    investedOn,
    confirmedBy: actor,
  });
  const investment = confirmed.rows?.[0];
  if (!investment) {
    return { ok: false, status: 404, error: "Pending investment not found." };
  }

  await runInvestedSideEffects({
    pipelineId: investment.pipeline_id,
    ventureId: investment.venture_id,
    investorId: investment.investor_profile_id,
    amount: investment.amount,
    currency: investment.currency,
    instrument: investment.instrument,
    investedOn: investment.invested_on,
    investmentId: investment.id,
    session,
  });
  await processFinancingOutbox();

  await emitInvestorEvent({
    session,
    eventType: "investment_recorded",
    investorId: investment.investor_profile_id,
    ventureId: investment.venture_id ? String(investment.venture_id) : null,
    currency: investment.currency,
    amount: investment.amount,
    metadata: {
      pipeline_id: investment.pipeline_id,
      instrument: investment.instrument,
      invested_on: investment.invested_on,
      confirmation_status: "confirmed",
    },
  });

  return { ok: true, investment };
}

/** Studio rejects a pending claim with a required reason. Investor may resubmit. */
export async function rejectInvestment({ id, reason, session }) {
  const trimmed = String(reason || "").trim();
  if (!trimmed) {
    return { ok: false, status: 400, error: "A rejection reason is required." };
  }

  const actor = session?.cid || session?.id || null;
  const rejected = await rejectInvestorInvestmentRecord({
    id,
    reason: trimmed.slice(0, 500),
    rejectedBy: actor,
  });
  const investment = rejected.rows?.[0];
  if (!investment) {
    return { ok: false, status: 404, error: "Pending investment not found." };
  }

  try {
    const notificationInfo = await getInvestmentNotificationInfo({
      venture_id: investment.venture_id,
      investor_id: investment.investor_profile_id,
    });
    const investorInfo = notificationInfo.rows[0] || {};
    if (investorInfo.user_id) {
      await insertInvestmentRejectedInvestorNotification({
        recipient_id: investorInfo.user_id,
        venture_name: investorInfo.venture_name,
        reason: trimmed.slice(0, 200),
        link: "/investor/dashboard",
      });
    }
  } catch (_) {}

  return { ok: true, investment };
}

/**
 * Legacy studio-only immediate confirm (flag off / back-compat). Prefer
 * claimInvestment + confirmInvestment when the confirmation flag is on.
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
  const saved = await upsertInvestorInvestmentClaim({
    investorId,
    pipelineId,
    ventureId,
    amount,
    currency,
    instrument,
    investedOn,
    recordedBy: actor,
    confirmationStatus: "confirmed",
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

export async function listStudioInvestmentClaims({ status } = {}) {
  return { ok: true, claims: (await listInvestmentClaimsForStudio({ status })).rows };
}

export async function getInvestmentClaim(id) {
  const row = (await getInvestorInvestmentById(id)).rows?.[0];
  if (!row) return { ok: false, status: 404, error: "Investment not found." };
  return { ok: true, investment: row };
}
