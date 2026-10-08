import db from "@/lib/db";

/**
 * Facilitation model — evaluation config (REPOSITORY layer).
 *
 * The grading-mode / evaluation-config reads and writes for the evaluation
 * controller. Split verbatim out of `models/facilitation.js` — see
 * docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Program grading_mode + evaluation_config (GET: serve the evaluation config). */
export async function getProgramEvaluationConfig(programId) {
  return db.execute({
    sql: "SELECT grading_mode, evaluation_config FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Evaluation rows for one submission, joined with its deliverable title. */
export async function getSubmissionEvaluation(submissionId) {
  return db.execute({
    sql: "SELECT s.evaluation_score, s.evaluation_data, d.title as deliverable_title FROM v2_submissions s LEFT JOIN v2_deliverables d ON s.deliverable_id = d.id WHERE s.id = ?",
    args: [submissionId],
  });
}

/** Program grading_mode + evaluation_config (PUT: fetch grading mode for score validation). */
export async function getProgramEvaluationConfigForValidation(programId) {
  return db.execute({
    sql: "SELECT grading_mode, evaluation_config FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Attach an evaluation score/data to a submission. */
export async function updateSubmissionEvaluation(evaluation) {
  return db.execute({
    sql: `UPDATE v2_submissions SET
              evaluation_score = ?,
              evaluation_data = ?::jsonb,
              updated_at = NOW()
            WHERE id = ?`,
    args: [
      evaluation.score !== undefined ? evaluation.score : null,
      evaluation.evaluation_data ? JSON.stringify(evaluation.evaluation_data) : "{}",
      evaluation.submission_id,
    ],
  });
}

/** Configure the program's grading mode. */
export async function updateProgramGradingMode(programId, gradingMode) {
  return db.execute({
    sql: "UPDATE v2_programs SET grading_mode = ?, updated_at = NOW() WHERE id = ?",
    args: [gradingMode, programId],
  });
}

/** Configure the program's evaluation_config JSON. */
export async function updateProgramEvaluationConfig(programId, evaluationConfig) {
  return db.execute({
    sql: "UPDATE v2_programs SET evaluation_config = ?::jsonb, updated_at = NOW() WHERE id = ?",
    args: [JSON.stringify(evaluationConfig), programId],
  });
}
