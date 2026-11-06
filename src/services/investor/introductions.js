import {
  insertIntroductionRequest,
  listIntroductionRequests,
  listInvestorIntroductionRequests,
  getIntroductionRequestById,
  markIntroductionReviewStarted,
  updateIntroductionDecision,
  findActiveIntroductionRequest,
  withdrawIntroductionRequest,
} from "@/models/investor/introductions";
import { findLiveDealFlowEntryForVenture } from "@/models/investor/dealFlow";
import {
  upsertRelationshipWorkspace,
  getPipelineById,
  insertWorkspaceCreatedTimeline,
  getInvestorUserIdByProfileId,
  notifyIntroductionApproved,
} from "@/models/investorRelations";
import {
  findInvestmentPipelineForInvestorVenture,
  upsertInvestmentPipeline,
} from "@/models/investor/diligenceAndPipeline/pipeline";
import { findVisibleInvestorVenture } from "@/models/investor/venturesAndUpdates";
import { emitInvestorEvent } from "@/services/investor/activity";
import { sendIntroductionEmail } from "@/services/investor/introductionEmails";
import { logger } from "@/lib/logger";

const isValidRequestId = (id) => {
  const value = String(id ?? "");
  if (!/^[1-9]\d*$/.test(value)) return false;
  return BigInt(value) <= 9223372036854775807n;
};

async function notifyInvestor({ investorProfileId, ventureId, status, declineReason = null }) {
  try {
    const result = await sendIntroductionEmail({ investorProfileId, ventureId, status, declineReason });
    if (!result.sent) logger.error("investor_introduction_email_failed", { status, reason: result.reason });
  } catch (_error) {
    logger.error("investor_introduction_email_failed", { status });
  }
}

/**
 * The investor asks for an introduction. The venture never sees this; it lands
 * in the studio's review queue as `submitted`.
 */
export async function requestIntroduction({
  investorId,
  ventureId,
  dealFlowEntryId = null,
  message = null,
  session,
}) {
  if (!investorId || !ventureId || typeof ventureId !== "string"
    || ventureId.length > 100 || (message !== null
      && (typeof message !== "string" || message.length > 1000))) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }

  const context = await findVisibleInvestorVenture(ventureId, "deal_flow_only");
  const venture = context.rows?.[0];
  if (!venture) return { ok: false, status: 404, error: "errors.notFound" };
  const liveEntry = await findLiveDealFlowEntryForVenture(venture.id, dealFlowEntryId);
  const dealFlowEntry = liveEntry.rows?.[0];
  if (!dealFlowEntry) return { ok: false, status: 404, error: "errors.notFound" };

  const existing = await findActiveIntroductionRequest({
    investorProfileId: investorId,
    dealFlowEntryId: dealFlowEntry.id,
  });
  if (existing.rows?.length) {
    return { ok: false, status: 409, error: "dashboardV2.errors.introductionAlreadyExists" };
  }

  const existingPipeline = await findInvestmentPipelineForInvestorVenture(investorId, venture.id);
  const pipelineId = existingPipeline.rows?.[0]?.id ?? (await upsertInvestmentPipeline({
    investor_id: investorId,
    venture_id: venture.id,
    stage: "interested",
  })).rows?.[0]?.id;
  if (!pipelineId) return { ok: false, status: 500, error: "errors.somethingWrong" };

  let result;
  try {
    result = await insertIntroductionRequest({
      investorProfileId: investorId,
      ventureId: venture.id,
      dealFlowEntryId: dealFlowEntry.id,
      pipelineId,
      message: message?.trim() || null,
    });
  } catch (error) {
    if (error?.code === "23505") {
      return { ok: false, status: 409, error: "dashboardV2.errors.introductionAlreadyExists" };
    }
    throw error;
  }
  const request = result.rows?.[0];

  await notifyInvestor({
    investorProfileId: investorId,
    ventureId: venture.id,
    status: "submitted",
  });
  await emitInvestorEvent({
    session,
    eventType: "intro_requested",
    ventureId: String(ventureId),
    relatedId: request?.id ?? null,
    metadata: { deal_flow_entry_id: dealFlowEntry.id },
  });

  return { ok: true, request };
}

/** The studio opens a request: it moves from `submitted` to `under_review`. */
export async function startReview({ id, session }) {
  if (!isValidRequestId(id)) return { ok: false, status: 400, error: "errors.invalidRequest" };
  const found = await getIntroductionRequestById(id);
  const request = found.rows?.[0];
  if (!request) return { ok: false, status: 404, error: "Request not found." };
  if (!["submitted", "under_review"].includes(request.status)) {
    return { ok: false, status: 409, error: "errors.invalidRequest" };
  }

  if (request.status === "submitted") {
    const updated = await markIntroductionReviewStarted(id);
    if (!updated.rows?.[0]) return { ok: false, status: 409, error: "errors.invalidRequest" };
    Object.assign(request, updated.rows[0]);
  }

  await emitInvestorEvent({
    session,
    investorId: request.investor_profile_id,
    eventType: "intro_review_started",
    ventureId: request.venture_id,
    relatedId: id,
    actorType: "studio",
  });

  return { ok: true, request };
}

/**
 * Approve or decline. Approval REQUIRES a pipeline row: it is what the
 * relationship workspace is keyed on. The workspace creation is idempotent
 * (`upsertRelationshipWorkspace`), and the investor is notified.
 */
export async function decideIntroduction({
  id,
  decision,
  reason = null,
  internalNote = null,
  relationshipManagerId = null,
  session,
}) {
  if (!["approved", "declined"].includes(decision)) {
    return { ok: false, status: 400, error: "decision must be 'approved' or 'declined'." };
  }
  if (!isValidRequestId(id)) return { ok: false, status: 400, error: "errors.invalidRequest" };
  if (internalNote !== null && (typeof internalNote !== "string" || internalNote.length > 2000)) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }

  const found = await getIntroductionRequestById(id);
  const request = found.rows?.[0];
  if (!request) return { ok: false, status: 404, error: "Request not found." };
  if (["approved", "declined"].includes(request.status)) {
    if (request.status !== decision) {
      return {
        ok: false,
        status: 409,
        error: "investorAdmin.introductions.alreadyDecided",
      };
    }
    return { ok: true, request, alreadyDecided: true };
  }
  if (!["submitted", "under_review"].includes(request.status)) {
    return { ok: false, status: 409, error: "errors.invalidRequest" };
  }

  const actor = session?.cid || session?.id || null;

  if (decision === "declined") {
    if (typeof reason !== "string" || !reason.trim() || reason.length > 500) {
      return { ok: false, status: 400, error: "errors.invalidRequest" };
    }
    const updated = await updateIntroductionDecision({
      id,
      status: "declined",
      decidedBy: actor,
      declineReason: reason.trim(),
      internalNote: internalNote?.trim() || null,
    });
    if (!updated.rows?.[0]) return { ok: false, status: 409, error: "errors.invalidRequest" };
    await emitInvestorEvent({
      session,
      investorId: request.investor_profile_id,
      eventType: "intro_declined",
      ventureId: request.venture_id,
      relatedId: id,
      actorType: "studio",
      metadata: {},
    });
    await notifyInvestor({
      investorProfileId: request.investor_profile_id,
      ventureId: request.venture_id,
      status: "declined",
      declineReason: reason.trim(),
    });
    return { ok: true, request: updated.rows[0] };
  }

  if (!request.pipeline_id) {
    return {
      ok: false,
      status: 400,
      error: "Add the venture to the pipeline before approving the introduction.",
    };
  }

  const pipeline = await getPipelineById(request.pipeline_id);
  if (pipeline.rows.length === 0) {
    return { ok: false, status: 404, error: "Pipeline not found." };
  }

  const workspaceResult = await upsertRelationshipWorkspace(
    request.pipeline_id,
    request.investor_profile_id,
    request.venture_id,
    relationshipManagerId || actor,
    null,
  );
  const workspace = workspaceResult.rows?.[0];

  const decided = await updateIntroductionDecision({
    id,
    status: "approved",
    decidedBy: actor,
    internalNote: internalNote?.trim() || null,
    workspaceId: workspace?.id ?? null,
  });
  if (!decided.rows?.[0]) return { ok: false, status: 409, error: "errors.invalidRequest" };

  if (workspace?.id) {
    await insertWorkspaceCreatedTimeline(workspace.id, actor).catch(() => {});
    try {
      const investorUser = await getInvestorUserIdByProfileId(request.investor_profile_id);
      const userId = investorUser.rows?.[0]?.user_id;
      if (userId) await notifyIntroductionApproved(userId);
    } catch (_) {}
  }
  await notifyInvestor({
    investorProfileId: request.investor_profile_id,
    ventureId: request.venture_id,
    status: "approved",
  });

  await emitInvestorEvent({
    session,
    investorId: request.investor_profile_id,
    eventType: "intro_approved",
    ventureId: request.venture_id,
    relatedId: id,
    actorType: "studio",
    metadata: { workspace_id: workspace?.id ?? null },
  });

  const refreshed = await getIntroductionRequestById(id);
  return { ok: true, request: refreshed.rows?.[0], workspace };
}

export async function listIntroductionsForStudio({ status } = {}) {
  if (status && !["submitted", "under_review", "approved", "declined", "withdrawn"].includes(status)) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }
  return { ok: true, requests: (await listIntroductionRequests({ status })).rows };
}

export async function listMyIntroductions({ investorId }) {
  return { ok: true, requests: (await listInvestorIntroductionRequests(investorId)).rows };
}

export async function withdrawMyIntroduction({ id, investorId, session }) {
  if (!isValidRequestId(id) || !investorId) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }
  const updated = await withdrawIntroductionRequest({ id, investorProfileId: investorId });
  const request = updated.rows?.[0];
  if (!request) return { ok: false, status: 404, error: "errors.notFound" };
  await emitInvestorEvent({
    session,
    eventType: "intro_withdrawn",
    ventureId: request.venture_id,
    relatedId: request.id,
  });
  return { ok: true, request };
}
