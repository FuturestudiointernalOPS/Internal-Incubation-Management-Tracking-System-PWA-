/**
 * Investor service — the diligence read side.
 *
 * Whether the caller may read a pipeline's diligence, and the one bundle the
 * workspace view renders (workspace, requests, notes, pipeline). Every statement
 * lives in `@/models/investor`; the scope comes from
 * `@/models/authorization/investorScope`. No SQL, no HTTP.
 */

import {
  getDiligenceWorkspaceByPipelineId,
  getPipelineWithVentureById,
  listDdInformationRequestsByWorkspaceId,
  listInvestorNotesByPipelineId,
} from "@/models/investor";
import { investorOwnsPipeline, resolveInvestorScope } from "@/models/authorization/investorScope";

/** Whether the caller may read this pipeline's diligence. */
export async function canViewDiligencePipeline(scope, pipelineId) {
  if (scope.management) return true;
  return investorOwnsPipeline(pipelineId, scope.profileId);
}

/** Read the diligence workspace, its requests, notes and pipeline. */
export async function loadDiligence(pipelineId) {
  let workspace = null;
  const workspaceResult = await getDiligenceWorkspaceByPipelineId(pipelineId);
  if (workspaceResult.rows.length > 0) workspace = workspaceResult.rows[0];

  let requests = [];
  if (workspace) {
    const requestsResult = await listDdInformationRequestsByWorkspaceId(workspace.id);
    requests = requestsResult.rows;
  }

  const notesResult = await listInvestorNotesByPipelineId(pipelineId);
  const pipelineResult = await getPipelineWithVentureById(pipelineId);

  return {
    workspace,
    requests,
    notes: notesResult.rows,
    pipeline: pipelineResult.rows[0] || null,
  };
}

/** Whether the caller may read the diligence of a pipeline. */
export async function buildDiligenceForViewer({ pipelineId, session }) {
  const scope = await resolveInvestorScope(session);
  if (!(await canViewDiligencePipeline(scope, pipelineId))) {
    return { ok: false, error: "errors.notFound", status: 404 };
  }
  return { ok: true, ...(await loadDiligence(pipelineId)) };
}