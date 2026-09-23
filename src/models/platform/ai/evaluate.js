/**
 * AI Evaluation Engine
 *
 * Evaluates a complete submission against an evaluation framework
 * in a single AI call. Returns per-dimension scores, reasoning,
 * evidence, confidence, strengths, weaknesses, and recommendations.
 *
 * Uses DeepSeek via the existing adapter.
 */

import { deepseekIntelligence } from "@/lib/deepseek";
import db, { initDb } from "@/lib/db";

/**
 * Format submission data for the AI prompt.
 * Extracts question-answer pairs, excluding internal metadata.
 */
function formatSubmissionForAI(submission, fields) {
  const data = submission.data || {};
  const lines = [];

  // Build a map of field_id → label for lookup
  const fieldMap = {};
  if (Array.isArray(fields)) {
    for (const field of fields) {
      fieldMap[String(field.id)] = field.label;
      fieldMap[field.label] = field.label;
    }
  }

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_")) continue; // skip internal keys like _scores, _evaluation
    const displayValue = typeof value === "string" && value.startsWith("{") && value.includes('"code"')
      ? (() => { try { const parsedValue = JSON.parse(value); return `${parsedValue.code} ${parsedValue.number}`; } catch { return String(value); } })()
      : String(value);
    // Use readable label if available, otherwise use raw key
    const label = fieldMap[key] || key;
    lines.push(`Q: ${label}\nA: ${displayValue}\n`);
  }

  return lines.join("\n");
}

/**
 * Get or fetch the evaluation framework for a form.
 */
async function getFramework(formId) {
  await initDb();
  const result = await db.execute({
    sql: "SELECT framework FROM platform_evaluation_frameworks WHERE form_id = ?",
    args: [formId],
  });
  if (result.rows.length === 0) return null;
  return result.rows[0].framework;
}

/**
 * Build the evaluation prompt for one submission.
 */
function buildEvaluationPrompt(framework, formattedSubmission, formName) {
  const dimensionsJson = JSON.stringify(
    (framework.dimensions || []).map((dimension) => ({
      name: dimension.name,
      criteria: dimension.criteria || [],
      ai_prompt: dimension.ai_prompt || `Evaluate ${dimension.name}.`,
      weight: dimension.weight || 0,
    })),
    null,
    2
  );

  return `${framework.global_prompt || "You are an experienced evaluator. Evaluate this application holistically based on the defined dimensions."}

FORM: ${formName || "Assessment"}

APPLICANT RESPONSES:
${formattedSubmission}

DIMENSIONS TO EVALUATE:
${dimensionsJson}

For each dimension, provide:
- score: number from 1 to 10
- reasoning: 2-4 sentences explaining exactly WHY you gave this score — reference specific things the applicant said
- evidence: array of direct quotes from the applicant in format "Q: [question label] — [quote from answer]" (max 3 per dimension)
- confidence: number from 0.0 to 1.0 indicating how confident you are in this evaluation
- strengths: array of strings identifying specific strengths observed in the responses
- weaknesses: array of strings identifying specific areas for improvement

Then provide:
- overall_score: weighted average of dimension scores (0-100 scale)
- recommendation: brief 2-3 sentence recommendation for the human reviewer

Return ONLY valid JSON. No markdown, no extra text. Format:
{
  "dimensions": [
    {
      "name": "Dimension Name",
      "score": 8.5,
      "reasoning": "...",
      "evidence": ["Q: Full Name — Ezi Baba", "Q: Describe your business — TrackFlow Technologies is building..."],
      "confidence": 0.92,
      "strengths": ["..."],
      "weaknesses": ["..."]
    }
  ],
  "overall_score": 82,
  "recommendation": "Brief recommendation..."
}`;
}



/**
 * Parse the AI response into structured evaluation data.
 */

function parseEvaluationResponse(raw, framework) {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    // Build ranking from framework thresholds
    let ranking = null;
    const rankings = framework.rankings || [];
    for (const rank of rankings) {
      if (parsed.overall_score >= rank.min && parsed.overall_score <= rank.max) {
        ranking = rank.label;
        break;
      }
    }

    // Add final_score and human_score defaults to each dimension
    const dimensions = (parsed.dimensions || []).map((dimension) => ({
      ...dimension,
      human_score: null,
      human_comment: null,
      final_score: dimension.score, // default to AI score until human overrides
    }));

    return {
      mode: "ai",
      evaluated_at: new Date().toISOString(),
      dimensions,
      overall_score: parsed.overall_score || 0,
      ranking: ranking || "Unranked",
      recommendation: parsed.recommendation || "",
    };
  } catch (error) {
    console.error("[AI Evaluation] Parse error:", error.message);
    return null;
  }
}

/**
 * Evaluate a submission against its form's evaluation framework.
 * This is the main entry point — called after submission or on demand.
 *
 * @param {number|string} submissionId
 * @returns {Promise<Object|null>} evaluation result or null if no framework
 */
export async function evaluateSubmission(submissionId) {
  try {
    await initDb();

    // Fetch submission
    const submissionResult = await db.execute({
      sql: "SELECT * FROM platform_form_submissions WHERE id = ?",
      args: [submissionId],
    });
    if (submissionResult.rows.length === 0) return null;
    const submission = submissionResult.rows[0];

    // Fetch run
    const run = await db.execute({
      sql: "SELECT * FROM platform_form_runs WHERE id = ?",
      args: [submission.run_id],
    });
    if (run.rows.length === 0) return null;
    const formId = run.rows[0].form_id;

    // Get evaluation framework
    const framework = await getFramework(formId);
    if (!framework) return null;

    // Fetch form fields for context
    const form = await db.execute({
      sql: "SELECT name FROM platform_forms WHERE id = ?",
      args: [formId],
    });
    const formName = form.rows[0]?.name || "Assessment";

    // Fetch fields for better evidence mapping
    const fields = await db.execute({
      sql: "SELECT id, label FROM platform_form_fields WHERE form_id = ?",
      args: [formId],
    });

    // Format submission for AI
    const formattedSubmission = formatSubmissionForAI(submission, fields.rows);

    // Build and send prompt
    const prompt = buildEvaluationPrompt(framework, formattedSubmission, formName);
    const raw = await deepseekIntelligence.chat(prompt);

    // Parse response
    const evaluation = parseEvaluationResponse(raw, framework);
    if (!evaluation) return null;

    // Get framework ID for foreign key
    let frameworkId = null;
    try {
      const fwRow = await db.execute({
        sql: "SELECT id FROM platform_evaluation_frameworks WHERE form_id = ?",
        args: [formId],
      });
      if (fwRow.rows.length > 0) frameworkId = fwRow.rows[0].id;
    } catch (_) {}

    // Store evaluation in SEPARATE table (not in submission data)
    const avgConfidence = evaluation.dimensions.length > 0
      ? evaluation.dimensions.reduce((sum, dimension) => sum + (dimension.confidence || 0), 0) / evaluation.dimensions.length
      : null;

    await db.execute({
      sql: `INSERT INTO platform_submission_evaluations
            (submission_id, framework_id, dimensions, overall_score, ranking, recommendation, confidence, evaluated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      args: [
        submissionId,
        frameworkId,
        JSON.stringify(evaluation.dimensions),
        evaluation.overall_score,
        evaluation.ranking,
        evaluation.recommendation || null,
        avgConfidence,
      ],
    });

    // Remove any old inline _evaluation from submission data (cleanup)
    const currentData = submission.data || {};
    if (currentData._evaluation) {
      const { _evaluation, ...cleanData } = currentData;
      await db.execute({
        sql: "UPDATE platform_form_submissions SET data = ? WHERE id = ?",
        args: [JSON.stringify(cleanData), submissionId],
      });
    }

    // Log timeline
    try {
      await db.execute({
        sql: `INSERT INTO platform_submission_timeline (submission_id, action, actor_id, metadata)
              VALUES (?, 'ai_evaluated', 'system', ?)`,
        args: [submissionId, JSON.stringify({ overall: evaluation.overall_score, ranking: evaluation.ranking })],
      });
    } catch (_) {}

    return evaluation;
  } catch (error) {
    console.error("[AI Evaluation] Error:", error.message);
    return null;
  }
}

/**
 * Get the latest evaluation for a submission.
 */
export async function getEvaluation(submissionId) {
  await initDb();
  const result = await db.execute({
    sql: "SELECT * FROM platform_submission_evaluations WHERE submission_id = ? ORDER BY evaluated_at DESC LIMIT 1",
    args: [submissionId],
  });
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

/**
 * Is AI evaluation *configured* for this form?
 *
 * This used to be called `hasEvaluation`, which reads like "has this submission
 * been evaluated?" — and two callers used it as if it meant that. It does not.
 * It answers a FORM-level question: is there a framework, and is the AI switch
 * on. Because the submit path treated that as "already evaluated", every
 * re-submission of an already-evaluated response ran the model again and
 * appended a fresh evaluation row — one wasted model call per save, and a new
 * row each time (the new row carries no human values, so it also hid whatever a
 * human had entered).
 *
 * The honest name is the point: for the per-submission question use
 * `submissionHasEvaluation`. Never let these two be confused again.
 */
export async function formHasAiEvaluation(formId) {
  await initDb();
  const fwResult = await db.execute({
    sql: "SELECT 1 FROM platform_evaluation_frameworks WHERE form_id = ?",
    args: [formId],
  });
  if (fwResult.rows.length === 0) return false;
  const formResult = await db.execute({
    sql: "SELECT settings FROM platform_forms WHERE id = ?",
    args: [formId],
  });
  if (formResult.rows.length === 0) return false;
  const settings = formResult.rows[0].settings || {};
  return settings.ai_evaluation === true;
}

/**
 * Has THIS submission already been evaluated?
 *
 * The question the submit path actually needed. Evaluating a response that
 * already has an evaluation is what produced duplicate rows and burned a model
 * call for an answer that existed; this is the guard that stops it.
 */
export async function submissionHasEvaluation(submissionId) {
  await initDb();
  const result = await db.execute({
    sql: "SELECT 1 FROM platform_submission_evaluations WHERE submission_id = ? LIMIT 1",
    args: [parseInt(submissionId)],
  });
  return result.rows.length > 0;
}

export default {
  evaluateSubmission,
  formHasAiEvaluation,
  submissionHasEvaluation,
  getFramework,
  getEvaluation,
};
