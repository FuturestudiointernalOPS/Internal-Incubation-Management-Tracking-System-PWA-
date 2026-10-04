import db from "@/lib/db";

/**
 * Platform AI model — the run-scoped scoreboard (REPOSITORY layer).
 *
 * Split verbatim out of `models/platformAi.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

// ── /api/platform/ai/evaluation-scores — run-scoped scoreboard ───────────────

/** Run row (id, name, form_id) that anchors the run-scoped scoreboard. */
export async function getRunInfoForScores(runId) {
  return db.execute({
    sql: "SELECT id, name, form_id FROM platform_form_runs WHERE id = ?",
    args: [parseInt(runId)],
  });
}

/** A form's real fields — the dynamic filter/answer-label source. */
export async function getFormFieldsForScores(formId) {
  return db.execute({
    sql: "SELECT id, label, field_type, options FROM platform_form_fields WHERE form_id::text = ? ORDER BY sort_order, id",
    args: [String(formId)],
  });
}

/** Total evaluated submissions in the run/form scope. */
export async function countEvaluatedSubmissionsForScores(whereSql, args) {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS cnt
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions s ON e.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE ${whereSql}`,
    args,
  });
}

/** Count of qualifying submissions after the min/max score filters. */
export async function countQualifyingEvaluationsForScores(whereSql, args) {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS cnt
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions s ON e.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE ${whereSql}`,
    args,
  });
}

/** Average overall score of the qualifying submissions. */
export async function getAverageQualifyingScoreForScores(whereSql, args) {
  return db.execute({
    sql: `SELECT COALESCE(AVG(e.overall_score), 0)::float AS avg
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions s ON e.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE ${whereSql}`,
    args,
  });
}

/** Respondent rows with submission data, ordered by score (asc or desc). */
export async function listScoreRespondents(whereSql, args, sortDir) {
  return db.execute({
    sql: `SELECT
              s.submitter_name AS name,
              s.submitter_id,
              s.status AS submission_status,
              s.data AS submission_data,
              e.overall_score AS score,
              e.ranking,
              e.recommendation,
              e.submission_id
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions s ON e.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE ${whereSql}
            ORDER BY e.overall_score ${sortDir}`,
    args,
  });
}

/** Batch contact emails for a list of cids (instead of one query per respondent). */
export async function getContactEmailsByCids(cids) {
  return db.execute({
    sql: "SELECT cid, email FROM contacts WHERE cid = ANY(?)",
    args: [cids],
  });
}
