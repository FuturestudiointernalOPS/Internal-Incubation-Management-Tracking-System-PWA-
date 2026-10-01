/**
 * Platform — advisory AI analysis of one submission (SERVICE layer).
 *
 * The domain work behind POST `/api/platform/ai/analyze`: load the submission
 * with its run and form context, run the requested mode (summarize / analyze)
 * and journal the usage. The result is explicitly advisory — a human decision
 * stays final.
 *
 * The CONTROLLER keeps `initDb`, the `runs.view` capability (a reading aid is a
 * READ) and the health probe.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` and `@/lib/**`.
 */

import { analyzeSubmission, summarizeSubmission } from "@/lib/platform/integrations";
import {
  getFormForAiAnalysis,
  getRunForAiAnalysis,
  getSubmissionForAiAnalysis,
  logAiAnalysisToTimeline,
} from "@/models/platformAi";

/**
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function analyzeSubmissionForRun({ submission_id, mode }) {
  if (!submission_id) {
    return { status: 400, body: { success: false, error: "submission_id required" } };
  }

  // Fetch submission
  const submissionResult = await getSubmissionForAiAnalysis(submission_id);
  if (submissionResult.rows.length === 0) {
    return { status: 404, body: { success: false, error: "Submission not found" } };
  }

  const submission = submissionResult.rows[0];

  // Fetch run and form for context
  const runResult = await getRunForAiAnalysis(submission.run_id);
  const run = runResult.rows[0] || null;

  let form = null;
  if (run?.form_id) {
    const formResult = await getFormForAiAnalysis(run.form_id);
    form = formResult.rows[0] || null;
  }

  const analysisMode = mode || "analyze";

  let result;
  if (analysisMode === "summarize") {
    const summary = await summarizeSubmission(submission, form);
    result = { summary };
  } else {
    const analysis = await analyzeSubmission(submission, form);
    result = analysis || { error: "AI analysis returned no result" };
  }

  // Log AI usage for governance
  try {
    await logAiAnalysisToTimeline(submission_id, {
      mode: analysisMode,
      timestamp: new Date().toISOString(),
    });
  } catch (_) {
    /* timeline logging is non-critical */
  }

  return {
    status: 200,
    body: {
      success: true,
      submission_id,
      mode: analysisMode,
      ...result,
    },
  };
}
