/**
 * PROGRAM EVALUATION (academic / incubation grading) — decisions, extracted
 * from the controller.
 *
 * `src/app/api/evaluation/route.js` mixed its controller (role check, request
 * parsing, response shaping) with: the safe-JSON-parse-with-fallback reads,
 * and PUT's grading-mode-aware validation (academic scores bounded 0-100,
 * incubation dimension scores bounded 1-5). Moved here VERBATIM — no SQL
 * (the model layer, `@/models/facilitation`, already owns it), no HTTP.
 *
 * See docs/GUIDE_DECOUPAGE_COUCHES.md for the method.
 */

import {
  getProgramEvaluationConfig,
  getProgramEvaluationConfigForValidation,
  getSubmissionEvaluation,
  updateProgramEvaluationConfig,
  updateProgramGradingMode,
  updateSubmissionEvaluation,
} from "@/models/facilitation";

function safeParse(value) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value || {};
  } catch (_) {
    return {};
  }
}

/** GET ?program_id=X — the program's grading mode + evaluation config. */
export async function getProgramConfig(programId) {
  const programResult = await getProgramEvaluationConfig(programId);
  if (programResult.rows.length === 0) {
    return { ok: false, statusCode: 404, error: "Program not found" };
  }
  const program = programResult.rows[0];
  return {
    ok: true,
    grading_mode: program.grading_mode,
    evaluation_config: safeParse(program.evaluation_config),
  };
}

/** GET ?submission_id=X — one submission's stored evaluation. */
export async function getSubmissionEvaluationDetail(submissionId) {
  const submissionResult = await getSubmissionEvaluation(submissionId);
  if (submissionResult.rows.length === 0) {
    return { ok: false, statusCode: 404, error: "Submission not found" };
  }
  const submission = submissionResult.rows[0];
  return {
    ok: true,
    evaluation: {
      score: submission.evaluation_score,
      data: safeParse(submission.evaluation_data),
      deliverable_title: submission.deliverable_title,
    },
  };
}

/**
 * PUT — update a submission's evaluation, validated against the program's
 * grading mode: academic scores bounded 0-100, incubation dimension scores
 * bounded 1-5 (the dimension list comes from the program's own config, with a
 * fixed default set).
 */
export async function saveSubmissionEvaluation({ program_id, submission_id, score, evaluation_data }) {
  if (!program_id || !submission_id) {
    return { ok: false, statusCode: 400, error: "program_id and submission_id required" };
  }

  // Fetch program's grading mode for validation
  const programResult = await getProgramEvaluationConfigForValidation(program_id);
  if (programResult.rows.length === 0) {
    return { ok: false, statusCode: 404, error: "Program not found" };
  }

  const program = programResult.rows[0];
  const gradingMode = program.grading_mode;

  // Validate based on grading mode
  if (gradingMode === "academic" && score !== undefined) {
    if (score < 0 || score > 100) {
      return { ok: false, statusCode: 400, error: "Academic score must be between 0 and 100" };
    }
  }

  if (gradingMode === "incubation" && evaluation_data) {
    // Validate incubation dimensions
    const config = safeParse(program.evaluation_config);
    const dimensions = config.dimensions || ["idea", "execution", "market", "team", "traction"];
    for (const dimension of dimensions) {
      if (
        evaluation_data[dimension] !== undefined &&
        (evaluation_data[dimension] < 1 || evaluation_data[dimension] > 5)
      ) {
        return { ok: false, statusCode: 400, error: `${dimension} score must be between 1 and 5` };
      }
    }
  }

  // Update submission with evaluation
  await updateSubmissionEvaluation({ score, evaluation_data, submission_id });

  return { ok: true };
}

/** POST — configure a program's grading mode and/or evaluation config. */
export async function configureProgramEvaluation({ program_id, grading_mode, evaluation_config }) {
  if (!program_id) {
    return { ok: false, statusCode: 400, error: "Program ID required" };
  }

  const validModes = ["graded", "review", "followup", "academic", "incubation"];
  if (grading_mode && !validModes.includes(grading_mode)) {
    return { ok: false, statusCode: 400, error: `Invalid grading mode. Must be one of: ${validModes.join(", ")}` };
  }

  if (grading_mode) {
    await updateProgramGradingMode(program_id, grading_mode);
  }

  if (evaluation_config) {
    await updateProgramEvaluationConfig(program_id, evaluation_config);
  }

  return { ok: true };
}
