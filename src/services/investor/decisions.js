/**
 * Investor service — the investment decisions.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — the profile
 * resolution (no profile = an empty page), the valid decision types, the
 * own-scope binding of the pipeline, and the stage the pipeline moves to after
 * each decision. Every statement lives in `@/models/investorRelations`. No SQL,
 * no HTTP: a refusal is a value ({ ok: false, status, error }) the HTTP
 * boundary turns into a response.
 */

import {
  getInvestorDecisionStats,
  getInvestorProfileIdForDecisions,
  listInvestorDecisions,
  listInvestorHistoryTimeline,
  recordInvestmentDecision,
  updatePipelineStageAfterDecision,
} from "@/models/investorRelations";
import {
  resolveInvestorScope,
  investorOwnsPipeline,
} from "@/models/authorization/investorScope";

/** The decision types the API accepts. */
export const INVESTOR_DECISION_TYPES = [
  "invest",
  "decline",
  "continue_discussions",
  "revisit_later",
];

/** The pipeline stage each decision leads to. */
export const INVESTOR_DECISION_STAGE_MAP = {
  invest: "invested",
  decline: "declined",
  continue_discussions: "negotiation",
  revisit_later: "watching",
};

const EMPTY_DECISION_STATS = {
  total_invested: 0,
  total_capital: 0,
  total_declined: 0,
  total_decisions: 0,
};

/**
 * A caller's decisions, history and stats. A caller with no investor profile
 * sees empty lists rather than an error.
 */
export async function listDecisionsForViewer({ session }) {
  const profileResult = await getInvestorProfileIdForDecisions(session.cid || session.id);
  if (profileResult.rows.length === 0) {
    return { ok: true, decisions: [], history: [], stats: EMPTY_DECISION_STATS };
  }

  const investorId = profileResult.rows[0].id;
  const decisions = await listInvestorDecisions(investorId);
  const history = await listInvestorHistoryTimeline(investorId);
  const stats = await getInvestorDecisionStats(investorId);

  return {
    ok: true,
    decisions: decisions.rows,
    history: history.rows,
    stats: stats.rows[0] || EMPTY_DECISION_STATS,
  };
}

/**
 * Record a decision on the caller's own pipeline and move that pipeline to the
 * matching stage. The pipeline id comes from the request, so the own-scope
 * binding is applied before the write.
 */
export async function recordDecision({
  pipelineId,
  decisionType,
  investmentAmount,
  decisionNotes,
  session,
}) {
  if (!pipelineId || !decisionType) {
    return { ok: false, status: 400, error: "pipeline_id and decision_type required" };
  }
  if (!INVESTOR_DECISION_TYPES.includes(decisionType)) {
    return { ok: false, status: 400, error: "Invalid decision_type" };
  }

  const scope = await resolveInvestorScope(session);
  if (!scope.management && !(await investorOwnsPipeline(pipelineId, scope.profileId))) {
    return { ok: false, status: 404, error: "errors.notFound" };
  }

  await recordInvestmentDecision(
    pipelineId,
    decisionType,
    investmentAmount || null,
    decisionNotes || null,
  );
  await updatePipelineStageAfterDecision(INVESTOR_DECISION_STAGE_MAP[decisionType], pipelineId);

  return { ok: true };
}
