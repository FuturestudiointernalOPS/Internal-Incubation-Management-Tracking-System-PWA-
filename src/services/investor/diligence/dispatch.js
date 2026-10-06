/**
 * Investor service — the diligence POST dispatch.
 *
 * Own-scope binding (every action below keys on this pipeline, or on a request
 * that resolves to it), then the action table: workspace + request + note writes
 * (`./workspaceActions`), the request status transition (`./requestActions`) and
 * the follow-up questions (`./followUpActions`). A refusal is a value
 * (`{ ok: false, error, status }`) the HTTP boundary turns into a response.
 * No SQL, no HTTP.
 */

import { completeDiligenceWorkspace } from "@/models/investor";
import {
  investorOwnsDdRequest,
  investorOwnsPipeline,
  resolveInvestorScope,
} from "@/models/authorization/investorScope";
import {
  addDiligenceNote,
  addDiligenceRequest,
  createDiligenceWorkspace,
} from "./workspaceActions";
import { updateDiligenceRequest } from "./requestActions";
import { addFollowUpQuestion, respondToFollowUpQuestion } from "./followUpActions";

/** Close the workspace. */
async function completeWorkspace({ pipelineId }) {
  await completeDiligenceWorkspace(pipelineId);
  return { ok: true };
}

/**
 * Run one POST action on the diligence workspace. Returns `{ ok: true, ...data }`
 * or a refusal `{ ok: false, error, status }`.
 */
export async function runDiligenceAction({ action, payload, session, pipelineId }) {
  const scope = await resolveInvestorScope(session);

  // Own-scope: every action below keys on this pipeline (or on a request that
  // resolves to it), so bind it to the caller's investor profile first.
  const ownsPipeline =
    scope.management || (await investorOwnsPipeline(pipelineId, scope.profileId));
  if (!ownsPipeline) return { ok: false, error: "errors.notFound", status: 404 };

  const ctx = {
    pipelineId,
    payload,
    session,
    scope,
    actor: session?.cid || session?.id,
    ownsRequest: async (requestId) =>
      scope.management || (await investorOwnsDdRequest(requestId, scope.profileId)),
  };

  switch (action) {
    case "create_workspace":
      return createDiligenceWorkspace(ctx);
    case "add_request":
      return addDiligenceRequest(ctx);
    case "update_request":
      return updateDiligenceRequest(ctx);
    case "add_note":
      return addDiligenceNote(ctx);
    case "complete":
      return completeWorkspace(ctx);
    case "add_followup":
      return addFollowUpQuestion(ctx);
    case "respond_followup":
      return respondToFollowUpQuestion(ctx);
    default:
      return { ok: false, error: "Unknown action", status: 400 };
  }
}