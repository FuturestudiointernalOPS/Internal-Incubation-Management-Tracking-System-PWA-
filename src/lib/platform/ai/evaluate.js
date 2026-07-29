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
    for (const f of fields) {
      fieldMap[f.id] = f.label;
      // Also map by label for direct lookup
      fieldMap[f.label] = f.label;
    }
  }

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_")) continue; // skip internal keys like _scores, _evaluation
    const displayValue = typeof value === "string" && value.startsWith("{") && value.includes('"code"')
      ? (() => { try { const p = JSON.parse(value); return `${p.code} ${p.number}`; } catch { return String(value); } })()
      : String(value);
    lines.push(`Q: ${key}\nA: ${displayValue}\n`);
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
    (framework.dimensions || []).map((d) => ({
      name: d.name,
      criteria: d.criteria || [],
      ai_prompt: d.ai_prompt || `Evaluate ${d.name}.`,
      weight: d.weight || 0,
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
- reasoning: 2-4 sentences explaining the score
- evidence: array of specific quotes from the applicant's responses that support your evaluation
- confidence: number from 0.0 to 1.0 indicating how confident you are in this evaluation
- strengths: array of strings identifying specific strengths
- weaknesses: array of strings identifying areas for improvement

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
      "evidence": ["Q1: ...", "Q5: ..."],
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
    const dimensions = (parsed.dimensions || []).map((d) => ({
      ...d,
      human_score: null,
      human_comment: null,
      final_score: d.score, // default to AI score until human overrides
    }));

    return {
      mode: "ai",
      evaluated_at: new Date().toISOString(),
      dimensions,
      overall_score: parsed.overall_score || 0,
      ranking: ranking || "Unranked",
      recommendation: parsed.recommendation || "",
    };
  } catch (e) {
    console.error("[AI Evaluation] Parse error:", e.message);
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
    const sub = await db.execute({
      sql: "SELECT * FROM platform_form_submissions WHERE id = ?",
      args: [submissionId],
    });
    if (sub.rows.length === 0) return null;
    const submission = sub.rows[0];

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
      ? evaluation.dimensions.reduce((s, d) => s + (d.confidence || 0), 0) / evaluation.dimensions.length
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
  } catch (e) {
    console.error("[AI Evaluation] Error:", e.message);
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
 * Check if a form has AI evaluation enabled.
 */
export async function hasEvaluation(formId) {
  await initDb();
  const result = await db.execute({
    sql: "SELECT 1 FROM platform_evaluation_frameworks WHERE form_id = ?",
    args: [formId],
  });
  return result.rows.length > 0;
}

export default { evaluateSubmission, hasEvaluation, getFramework };
