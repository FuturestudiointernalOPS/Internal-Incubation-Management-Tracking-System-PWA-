/**
 * Investor service — the founder evaluations and risk assessments.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — the own-scope
 * binding of a pipeline (the id comes from the request, so a non-management
 * caller is pinned to their own pipeline) and the write dispatch by `type`
 * (founder vs risk). Every statement lives in `@/models/investor`. No SQL, no
 * HTTP: a refusal is a value ({ ok: false, status, error }) the HTTP boundary
 * turns into a response.
 */

import {
  createFounderEvaluation,
  listFounderEvaluationsByPipelineId,
  listRiskAssessmentsByPipelineId,
  upsertRiskAssessment,
} from "@/models/investor";
import {
  resolveInvestorScope,
  investorOwnsPipeline,
} from "@/models/authorization/investorScope";

/**
 * The founder evaluations and risk assessments of a pipeline. The pipeline id
 * comes from the request, so a non-management caller is bound to their own
 * pipeline first; a pipeline that is not the caller's own is a 404.
 */
export async function listEvaluationsForViewer({ pipelineId, session }) {
  if (!pipelineId) return { ok: false, status: 400, error: "pipeline_id required" };

  const scope = await resolveInvestorScope(session);
  if (!scope.management && !(await investorOwnsPipeline(pipelineId, scope.profileId))) {
    return { ok: false, status: 404, error: "errors.notFound" };
  }

  const [founders, risks] = await Promise.all([
    listFounderEvaluationsByPipelineId(pipelineId),
    listRiskAssessmentsByPipelineId(pipelineId),
  ]);

  return {
    ok: true,
    founder_evaluations: founders.rows,
    risk_assessments: risks.rows,
  };
}

/**
 * Record an evaluation on the caller's own pipeline: a founder evaluation or a
 * risk assessment, chosen by `type`. The scope binding is applied before the
 * write, so a pipeline id from the request can no longer reach another
 * investor's data.
 */
export async function createEvaluation({ pipelineId, type, fields, session }) {
  if (!pipelineId || !type) {
    return { ok: false, status: 400, error: "pipeline_id and type required" };
  }

  const scope = await resolveInvestorScope(session);
  if (!scope.management && !(await investorOwnsPipeline(pipelineId, scope.profileId))) {
    return { ok: false, status: 404, error: "errors.notFound" };
  }

  if (type === "founder") {
    const {
      founder_name,
      role,
      experience_score,
      leadership_score,
      domain_expertise_score,
      overall_rating,
      notes,
    } = fields;
    if (!founder_name) return { ok: false, status: 400, error: "founder_name required" };

    const result = await createFounderEvaluation({
      pipeline_id: pipelineId,
      founder_name,
      role,
      experience_score,
      leadership_score,
      domain_expertise_score,
      overall_rating,
      notes,
      created_by: session.cid || session.id,
    });
    return { ok: true, evaluation: result.rows[0] };
  }

  if (type === "risk") {
    const { risk_category, risk_description, severity, mitigation, status } = fields;
    if (!risk_category || !risk_description) {
      return { ok: false, status: 400, error: "risk_category and risk_description required" };
    }

    const result = await upsertRiskAssessment({
      pipeline_id: pipelineId,
      risk_category,
      risk_description,
      severity,
      mitigation,
      status,
      created_by: session.cid || session.id,
    });
    return { ok: true, evaluation: result.rows[0] };
  }

  return { ok: false, status: 400, error: "Invalid type. Use 'founder' or 'risk'" };
}
