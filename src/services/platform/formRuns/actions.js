/**
 * Platform — form runs: the link/document/run actions (SERVICE layer).
 *
 * The remaining write actions on a Run: rotating the public share slug, deleting
 * a submission and its dependents, re-rolling a composed report, creating a run
 * (version, slug, assignments, creation automation), updating metadata (the
 * Output-Instruction rule) and the permanent archive cascade.
 *
 * Split of `services/platform/formRuns.js` (see docs/LAYER_SPLIT.md): this is the
 * `actions` slice; the barrel at the original path re-exports the same surface.
 *
 * Layer: decisions and orchestration, no SQL, no HTTP. It reads and writes
 * through `@/models/**` and `@/lib/**`.
 */

import { onRunCreated } from "@/models/platform/automation";
import {
  addPublicSlugColumnIfMissing,
  createFormRun,
  createRunAssignmentForRunCreation,
  deleteEmailLogsByRunId,
  deleteEvaluationsByRunId,
  deleteEvaluationsBySubmissionId,
  deleteFormRunById,
  deleteReviewsByRunId,
  deleteReviewsBySubmissionId,
  deleteSubmissionById,
  deleteTimelineBySubmissionId,
  getFormVersionById,
  getRunAfterSlugRotationById,
  updateFormRunMetadataById,
  updatePublicSlugForRegeneratedLinkById,
  updatePublicSlugRetryAfterAlterById,
} from "@/models/formRuns";
import { deleteRunReportFileByRunId } from "@/models/platform/reportFiles";
import { removeRunReportFileObject } from "@/lib/platform/runReportFiles";
import { MAX_OUTPUT_INSTRUCTION } from "@/services/platform/report";
import { buildResultDocument, logTimeline } from "./resultEmails";

// ── Public link, submission deletion, report re-roll, run creation ──────────

/**
 * Rotate a run's public share slug — the old link stops working. The format
 * matches run creation (unguessable). Legacy schemas may lack the column, so
 * add it idempotently and retry once. Returns { ok:true, run, public_slug } or
 * { ok:false, statusCode, error }.
 */
export async function regeneratePublicLink({ id }) {
  const slug = "r" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

  try {
    await updatePublicSlugForRegeneratedLinkById(slug, id);
  } catch (_) {
    // Legacy schemas may lack the column — add it idempotently, then retry.
    try {
      await addPublicSlugColumnIfMissing();
      await updatePublicSlugRetryAfterAlterById(slug, id);
    } catch {
      return { ok: false, statusCode: 500, error: "Could not rotate the share link" };
    }
  }

  const fresh = await getRunAfterSlugRotationById(id);
  if (fresh.rows.length === 0) return { ok: false, statusCode: 404, error: "Run not found" };

  return { ok: true, run: fresh.rows[0], public_slug: slug };
}

/** Delete a submission and everything tied to it (reviews, timeline, evaluations). */
export async function deleteSubmission({ submission_id }) {
  await deleteReviewsBySubmissionId(submission_id);
  await deleteTimelineBySubmissionId(submission_id);
  await deleteEvaluationsBySubmissionId(submission_id);
  await deleteSubmissionById(submission_id);
  return { ok: true };
}

/**
 * Re-roll the composed report for a submission, then record it on the timeline.
 * Returns the built document (same shape as buildResultDocument) so the
 * controller can stream the PDF; a non-ok status is returned untouched.
 */
export async function regenerateRunReport({ submission_id }) {
  const document = await buildResultDocument({ submission_id, forceReport: true });
  if (document.status !== "ok") return document;
  logTimeline(parseInt(submission_id), "report_regenerated", "system", "System", {});
  return document;
}

/**
 * Create a run: resolve the form version, mint an unguessable public slug,
 * persist the run, create its initial assignments, then fire the creation
 * automation. Returns { ok:true, run } or { ok:false, statusCode, error }.
 */
export async function createRun({ form_id, name, description, opens_at, closes_at, assignments, settings, session }) {
  // Get current form version
  const form = await getFormVersionById(form_id);
  if (form.rows.length === 0) return { ok: false, statusCode: 404, error: "Form not found" };

  // Generate a random public slug (8-char hex, not guessable)
  const publicSlug = "r" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

  const result = await createFormRun({
    form_id,
    form_version: form.rows[0].version,
    name,
    description,
    opens_at,
    closes_at,
    settings,
    owner_id: session.cid,
    created_by: session.cid,
    public_slug: publicSlug,
  });

  // Create assignments
  if (Array.isArray(assignments)) {
    for (const assignment of assignments) {
      await createRunAssignmentForRunCreation({
        runId: result.rows[0].id,
        targetType: assignment.target_type || "user",
        targetId: assignment.target_id,
        assignedBy: session.cid,
      });
    }
  }

  // Fire automation
  onRunCreated(result.rows[0], session);

  return { ok: true, run: result.rows[0] };
}

// ── Run metadata update and permanent archive (PUT / DELETE) ─────────────────

/**
 * Update a run's metadata.
 *
 * The Output Instruction is a prompt an administrator writes, so it is
 * validated here and not only in the form: it must be a string, it is bounded
 * and stored trimmed (blank means "no instruction, default report" — never a
 * whitespace prompt). Returns { ok:true, run } or { ok:false, statusCode, error }
 * where the error is the i18n key the caller shows.
 */
export async function updateRunMetadata({ id, name, description, status, opens_at, closes_at, settings }) {
  let safeSettings = settings;
  if (settings && typeof settings === "object" && settings.output_instruction !== undefined) {
    const raw = settings.output_instruction;
    if (raw !== null && typeof raw !== "string") {
      return { ok: false, statusCode: 400, error: "platformMisc.runs.outputInstructionInvalid" };
    }
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed.length > MAX_OUTPUT_INSTRUCTION) {
      return { ok: false, statusCode: 400, error: "platformMisc.runs.outputInstructionTooLong" };
    }
    safeSettings = { ...settings, output_instruction: trimmed };
  }

  const result = await updateFormRunMetadataById({ id, name, description, status, opens_at, closes_at, settings: safeSettings });
  return { ok: true, run: result.rows[0] };
}

/**
 * Permanently delete a run and everything attached to it.
 *
 * Assignments and submissions cascade via FK, but the email/review/evaluation
 * logs reference submission_id without a FK cascade, so those are cleared first.
 * The report document's ROW cascades with the run; the stored OBJECT does not,
 * so it is taken down here or it would outlive its run forever.
 */
export async function archiveRun({ id }) {
  const runId = parseInt(id);

  await deleteEmailLogsByRunId(runId);
  await deleteReviewsByRunId(runId);
  await deleteEvaluationsByRunId(runId);
  const reportFilePath = await deleteRunReportFileByRunId(runId);
  if (reportFilePath) await removeRunReportFileObject(reportFilePath);
  await deleteFormRunById(runId);

  return { ok: true };
}
