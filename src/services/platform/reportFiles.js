/**
 * Platform — a Run's report-file attachment (SERVICE layer).
 *
 * The domain work behind `/api/platform/form-runs/report-file`: the validate
 * BEFORE any byte is read or written, the text extraction, the
 * replace-then-remove ordering (a failed replacement never leaves the Run with
 * nothing), the signed read link and the "detach = row first, object after".
 * The CONTROLLER keeps `initDb`, the `runs.edit` (write) / `runs.view` (read)
 * capabilities and the envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` and `@/lib/**`.
 */

import { getRunById } from "@/models/formRuns";
import {
  deleteRunReportFileByRunId,
  getRunReportFileByRunId,
  getRunReportFileTextByRunId,
  runReportFileDescriptor,
  upsertRunReportFile,
} from "@/models/platform/reportFiles";
import {
  removeRunReportFileObject,
  signRunReportFilePath,
  uploadRunReportFileObject,
  validateRunReportFile,
} from "@/lib/platform/runReportFiles";
import { extractReportFileText } from "@/lib/platform/runReportFileText";
import { MAX_REFERENCE_TEXT } from "./report";

/**
 * Attach (or replace) the document. A document the writer cannot read into text
 * is still a valid attachment (a human can open it), so it is kept and labelled
 * rather than refused — the screen is told which happened.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function attachRunReportFile({ runId, file, session }) {
  if (!runId) {
    return { status: 400, body: { success: false, error: "platformMisc.runs.reportFileMissingRun" } };
  }

  // Refuse before a byte is read or written, so a rejected document cannot
  // become an orphan object in storage.
  const check = validateRunReportFile(file);
  if (!check.success) {
    return { status: 400, body: { success: false, error: check.error } };
  }

  const run = await getRunById(runId);
  if (run.rows.length === 0) {
    return { status: 404, body: { success: false, error: "platformMisc.runs.reportFileRunNotFound" } };
  }

  const extraction = await extractReportFileText(file);

  const uploaded = await uploadRunReportFileObject({ file, runId, fileName: file.name });
  if (!uploaded.success) {
    return {
      status: uploaded.error === "platformMisc.runs.reportFileStorageUnavailable" ? 500 : 400,
      body: { success: false, error: uploaded.error },
    };
  }

  // Read the previous row BEFORE replacing it: its object is removed once the
  // new one is safely in place, never before — a failed replacement must not
  // leave the Run with nothing.
  const previous = await getRunReportFileByRunId(runId);

  const row = await upsertRunReportFile({
    runId,
    fileName: file.name,
    mimeType: file.type || null,
    fileSize: file.size,
    storagePath: uploaded.storage_path,
    extractedText: extraction.text || null,
    extractionStatus: extraction.status,
    extractionError: extraction.error || null,
    uploadedBy: session?.cid || session?.email || null,
  });

  if (previous?.storage_path && previous.storage_path !== uploaded.storage_path) {
    await removeRunReportFileObject(previous.storage_path);
  }

  return { status: 200, body: { success: true, file: runReportFileDescriptor(row) } };
}

/**
 * The descriptor, and (only when asked) the text the report writer reads. The
 * text is a second query because it is the one large part: a screen that only
 * shows "a document is attached" must not move it.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function getRunReportFilePayload({ runId, includeText }) {
  if (!runId) {
    return { status: 400, body: { success: false, error: "platformMisc.runs.reportFileMissingRun" } };
  }

  const row = await getRunReportFileByRunId(runId);
  if (!row) return { status: 200, body: { success: true, file: null } };

  const url = await signRunReportFilePath(row.storage_path);

  const payload = { success: true, file: runReportFileDescriptor(row, url) };
  if (includeText) {
    const stored = await getRunReportFileTextByRunId(runId);
    payload.text = stored?.text || "";
    // How much of it the report writer actually reads, so the screen can say so
    // instead of letting a long document look fully used.
    payload.prompt_limit = MAX_REFERENCE_TEXT;
  }

  return { status: 200, body: payload };
}

/** Detach: the row first (source of truth), the object after. */
export async function detachRunReportFile({ runId }) {
  if (!runId) {
    return { status: 400, body: { success: false, error: "platformMisc.runs.reportFileMissingRun" } };
  }

  const storagePath = await deleteRunReportFileByRunId(runId);
  if (storagePath) await removeRunReportFileObject(storagePath);

  return { status: 200, body: { success: true } };
}
