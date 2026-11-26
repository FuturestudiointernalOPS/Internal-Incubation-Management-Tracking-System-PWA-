import {
  insertIntroductionRequest,
  listIntroductionRequests,
  getIntroductionRequestById,
  markIntroductionReviewStarted,
  updateIntroductionDecision,
} from "@/models/investor/introductions";
import {
  upsertRelationshipWorkspace,
  getPipelineById,
  insertWorkspaceCreatedTimeline,
  getInvestorUserIdByProfileId,
  notifyIntroductionApproved,
} from "@/models/investorRelations";
import { emitInvestorEvent } from "@/services/investor/activity";

/**
 * The investor asks for an introduction. The venture never sees this; it lands
 * in the studio's review queue as `submitted`.
 */
export async function requestIntroduction({
  investorId,
  ventureId,
  dealFlowEntryId = null,
  pipelineId = null,
  message = null,
  session,
}) {
  if (!investorId || !ventureId) {
    return { ok: false, status: 400, error: "investor_id and venture_id required." };
  }

  const result = await insertIntroductionRequest({
    investorId,
    ventureId,
    dealFlowEntryId,
    pipelineId,
    message: message ? String(message).slice(0, 1000) : null,
  });
  const request = result.rows?.[0];

  await emitInvestorEvent({
    session,
    eventType: "intro_requested",
    ventureId: String(ventureId),
    relatedId: request?.id ?? null,
    metadata: { message: request?.message ?? null },
  });

  return { ok: true, request };
}

/** The studio opens a request: it moves from `submitted` to `under_review`. */
export async function startReview({ id, session }) {
  const found = await getIntroductionRequestById(id);
  const request = found.rows?.[0];
  if (!request) return { ok: false, status: 404, error: "Request not found." };

  if (request.status === "submitted") {
    await markIntroductionReviewStarted(id);
  }

  await emitInvestorEvent({
    session,
    investorId: request.investor_id,
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
  relationshipManagerId = null,
  session,
}) {
  if (!["approved", "declined"].includes(decision)) {
    return { ok: false, status: 400, error: "decision must be 'approved' or 'declined'." };
  }

  const found = await getIntroductionRequestById(id);
  const request = found.rows?.[0];
  if (!request) return { ok: false, status: 404, error: "Request not found." };
  if (["approved", "declined"].includes(request.status)) {
    return { ok: true, request, alreadyDecided: true };
  }

  const actor = session?.cid || session?.id || null;

  if (decision === "declined") {
    if (!reason) return { ok: false, status: 400, error: "A decline reason is required." };
    const updated = await updateIntroductionDecision({
      id,
      status: "declined",
      decidedBy: actor,
      declineReason: reason,
    });
    await emitInvestorEvent({
      session,
      investorId: request.investor_id,
      eventType: "intro_declined",
      ventureId: request.venture_id,
      relatedId: id,
      actorType: "studio",
      metadata: { reason },
    });
    return { ok: true, request: updated.rows?.[0] };
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
    request.investor_id,
    request.venture_id,
    relationshipManagerId || actor,
    null,
  );
  const workspace = workspaceResult.rows?.[0];

  await updateIntroductionDecision({
    id,
    status: "approved",
    decidedBy: actor,
    workspaceId: workspace?.id ?? null,
  });

  if (workspace?.id) {
    await insertWorkspaceCreatedTimeline(workspace.id, actor).catch(() => {});
    try {
      const investorUser = await getInvestorUserIdByProfileId(request.investor_id);
      const userId = investorUser.rows?.[0]?.user_id;
      if (userId) await notifyIntroductionApproved(userId);
    } catch (_) {}
  }

  await emitInvestorEvent({
    session,
    investorId: request.investor_id,
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
  return { ok: true, requests: (await listIntroductionRequests({ status })).rows };
}

export async function listMyIntroductions({ investorId }) {
  return { ok: true, requests: (await listIntroductionRequests({ investorId })).rows };
}
