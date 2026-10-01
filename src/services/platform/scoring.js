/**
 * Platform — assessment scoring (SERVICE layer).
 *
 * The domain work behind the Run scoring config: per-section percentage scores
 * (run-level config first, then the form's), the weighted overall score and the
 * ranking label. Used by the form-runs submit and manual-add actions.
 *
 * Layer (see docs/LAYER_SPLIT.md): a pure decision over repository reads, no
 * SQL, no HTTP. It reads through `@/models/**`.
 */

import { getFormScoringSettingsById, getRunScoringSettingsById } from "@/models/formRuns";

/**
 * Calculate assessment scores for a submission.
 * Expects submissionData to contain rating field values keyed by field label.
 * Returns { sections, overall, ranking } or null if scoring is not configured.
 */
export async function calculateSubmissionScores(runId, submissionData) {
  try {
    const run = await getRunScoringSettingsById(runId);
    if (run.rows.length === 0) return null;

    // Check run-level scoring config first, then fall back to form-level
    const runSettings = run.rows[0].settings || {};
    let scoring = runSettings.scoring;

    if (!scoring || !scoring.enabled) {
      const form = await getFormScoringSettingsById(run.rows[0].form_id);
      if (form.rows.length === 0) return null;
      const formSettings = form.rows[0].settings || {};
      scoring = formSettings.scoring;
    }

    if (!scoring || !scoring.enabled || !scoring.sections) return null;

    const { sections, rankings } = scoring;
    const maxPerQuestion = scoring.max_per_question || 5; // configurable scale (default 5 for Likert)
    const sectionResults = {};

    for (const [sectionName, sectionConfig] of Object.entries(sections)) {
      const { weight, field_labels, max_per_question: sectionMax } = sectionConfig;
      const effectiveMax = sectionMax || maxPerQuestion;
      let sectionTotal = 0;
      let sectionCount = 0;

      if (Array.isArray(field_labels)) {
        for (const label of field_labels) {
          const value = submissionData[label];
          if (value !== undefined && value !== null && value !== "") {
            const numVal = parseFloat(value);
            if (!isNaN(numVal)) {
              sectionTotal += numVal;
              sectionCount++;
            }
          }
        }
      }

      const maxPossible = sectionCount * effectiveMax;
      const sectionScore = sectionCount > 0 ? Math.round((sectionTotal / maxPossible) * 1000) / 10 : 0;

      sectionResults[sectionName] = {
        score: sectionScore,
        maxPossible,
        total: sectionTotal,
        count: sectionCount,
        weight: weight || 0,
      };
    }

    // Overall weighted score
    let overallScore = 0;
    for (const [, data] of Object.entries(sectionResults)) {
      overallScore += data.score * (data.weight / 100);
    }
    overallScore = Math.round(overallScore * 10) / 10;

    // Ranking
    let ranking = null;
    if (Array.isArray(rankings)) {
      for (const rank of rankings) {
        if (overallScore >= rank.min && overallScore <= rank.max) {
          ranking = rank.label;
          break;
        }
      }
    }

    return { sections: sectionResults, overall: overallScore, ranking };
  } catch (error) {
    console.error("[Scoring] Calculation failed:", error.message);
    return null;
  }
}
