/**
 * Investor service — the investment pipeline.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — the list scope, the
 * valid stages, the invested-amount parsing, and the two best-effort side
 * effects (the meeting request, and the "invested" cascade). Every statement
 * lives in `@/models/investor`. No SQL, no HTTP.
 */

import {
  getInvestorProfileIdByUserId,
  getInvestorProfileIdByUserIdForPipelineList,
  getMeetingRequestInfo,
  insertInvestorMeetingPlaceholderEvent,
  insertInvestorMeetingRequestNotification,
  listInvestmentPipeline,
  listSuperAdminCids,
  upsertInvestmentPipeline,
} from "@/models/investor";
import { emitInvestorEvent, recordInvestorInteraction } from "@/services/investor/activity";
import { readInvestorFlags } from "@/services/investor/featureFlags";
import { runInvestedSideEffects } from "@/services/investor/investment";

// The internal roles that see every pipeline row.
const MANAGEMENT_ROLES = ["super_admin", "staff", "program_manager"];

export const PIPELINE_STAGES = [
  "interested",
  "watching",
  "meeting_requested",
  "due_diligence",
  "negotiation",
  "invested",
  "declined",
];

/** The stage to store, defaulting to "interested". */
export function normalizePipelineStage(stage) {
  return stage || "interested";
}

/** The invested amount, read from the amount field or, failing that, the notes. */
export function parseInvestedAmount({ amount, notes }) {
  return parseFloat(amount || notes) || 0;
}

/**
 * Whether the caller's investor profile must be resolved to scope the list.
 *
 * Every non-management session is OWN-SCOPED — the profile is resolved and bound
 * regardless of filters, so a venture id can no longer expose other investors'
 * rows. Management keeps its historical branches: with no venture id and no
 * super-admin/staff stage filter, it too falls back to its own profile.
 */
export function shouldResolvePipelineProfile({ management, ventureId, stage, role }) {
  if (!management) return true;
  return !ventureId && !(stage && (role === "super_admin" || role === "staff"));
}

/** The pipeline rows a caller may list. */
export async function listPipelineForViewer({ ventureId, stage, session }) {
  const management = MANAGEMENT_ROLES.includes(session?.role);
  let investorId = null;

  if (shouldResolvePipelineProfile({ management, ventureId, stage, role: session?.role })) {
    const profileResult = await getInvestorProfileIdByUserIdForPipelineList(
      session.cid || session.id,
    );
    if (profileResult.rows.length === 0) return { ok: true, pipeline: [] };
    investorId = profileResult.rows[0].id;
  }

  const result = await listInvestmentPipeline({
    ventureId,
    stage,
    role: session.role,
    investorId,
  });
  return { ok: true, pipeline: result.rows };
}

/**
 * Add a venture to the caller's pipeline, or move its stage — then run the two
 * best-effort cascades: a meeting request notifies the super admins and drops a
 * calendar placeholder; "invested" records the decision, updates the campaign,
 * marks the relationship workspace and notifies everyone — UNLESS the Phase 5
 * confirmation flag is on, in which case those side effects wait for studio
 * confirmation via claimInvestment / confirmInvestment.
 */
export async function addOrUpdatePipeline({
  ventureId,
  stage,
  notes,
  amount,
  currency,
  instrument,
  investedOn,
  declineReason,
  session,
}) {
  const profileResult = await getInvestorProfileIdByUserId(session.cid || session.id);
  if (profileResult.rows.length === 0) {
    return { ok: false, status: 404, error: "Investor profile not found" };
  }
  const investorId = profileResult.rows[0].id;

  const newStage = normalizePipelineStage(stage);
  if (!PIPELINE_STAGES.includes(newStage)) {
    return { ok: false, status: 400, error: "Invalid stage" };
  }

  const flags = await readInvestorFlags();

  // Phase 5: when confirmation is on, Invested must go through claimInvestment
  // (amount + currency). A bare stage flip must not fire side effects.
  if (newStage === "invested" && flags.investmentConfirmation) {
    return {
      ok: false,
      status: 400,
      error: "Use the investment claim form (amount and currency required).",
    };
  }

  if ((newStage === "declined") && flags.investmentConfirmation) {
    const reason = String(declineReason || notes || "").trim();
    if (!reason) {
      return { ok: false, status: 400, error: "A reason is required when leaving without investment." };
    }
  }

  const result = await upsertInvestmentPipeline({
    investor_id: investorId,
    venture_id: ventureId,
    stage: newStage,
    notes,
  });

  if (result.rows?.[0]?.was_inserted === true) {
    await recordInvestorInteraction({ session, investorId, eventType: "pipeline_added",
      ventureId: String(ventureId), relatedId: result.rows[0].id });
  }

  // Phase 2 interest button = pipeline add at Interested.
  if (newStage === "interested") {
    await emitInvestorEvent({
      session,
      eventType: "interest_expressed",
      investorId,
      ventureId: ventureId ? String(ventureId) : null,
      relatedId: result.rows?.[0]?.id ?? null,
    });
  }

  // Every stage move is recorded for the metrics (E2/E3). `emitInvestorEvent`
  // never throws, so logging cannot break the pipeline write.
  await emitInvestorEvent({
    session,
    eventType: "pipeline_stage_changed",
    ventureId: ventureId ? String(ventureId) : null,
    relatedId: result.rows?.[0]?.id ?? null,
    metadata: { stage: newStage },
  });

  if (newStage === "declined" && flags.investmentConfirmation) {
    await emitInvestorEvent({
      session,
      eventType: "pipeline_declined",
      investorId,
      ventureId: ventureId ? String(ventureId) : null,
      relatedId: result.rows?.[0]?.id ?? null,
      metadata: { reason: String(declineReason || notes || "").trim().slice(0, 500) },
    });
  }

  // Meeting requested → notify super admins and drop a calendar placeholder.
  if (newStage === "meeting_requested") {
    try {
      const meetingRequestInfo = await getMeetingRequestInfo({
        venture_id: ventureId,
        investor_id: investorId,
      });
      const investorInfo = meetingRequestInfo.rows[0] || {};

      const admins = await listSuperAdminCids();
      for (const admin of admins.rows) {
        await insertInvestorMeetingRequestNotification({
          recipient_id: admin.cid,
          investor_name: investorInfo.investor_name,
          organization_name: investorInfo.organization_name,
          venture_name: investorInfo.venture_name,
          notes,
          link: "/admin/investors/dashboard",
        });
      }

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      await insertInvestorMeetingPlaceholderEvent({
        program_id: ventureId,
        venture_name: investorInfo.venture_name,
        investor_name: investorInfo.investor_name,
        organization_name: investorInfo.organization_name,
        start_time: nextWeek.toISOString(),
        end_time: nextWeek.toISOString(),
        created_by: session.cid || session.id,
      });
    } catch (_) {}
  }

  // Invested (flag OFF) → legacy immediate side effects.
  if (newStage === "invested" && !flags.investmentConfirmation) {
    const pipelineId = result.rows[0].id;
    const investedAmount = parseInvestedAmount({ amount, notes });
    await runInvestedSideEffects({
      pipelineId,
      ventureId,
      investorId,
      amount: investedAmount,
      currency: currency || null,
      instrument: instrument || null,
      investedOn: investedOn || null,
      notes,
      session,
    });
  }

  const { was_inserted: _inserted, ...pipeline } = result.rows[0];
  return { ok: true, pipeline };
}
