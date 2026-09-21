import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { getSession } from "@/lib/auth";
import { getRunById } from "@/models/formRuns";
import {
  getRunReportFileByRunId,
  getRunReportFileTextByRunId,
  upsertRunReportFile,
  deleteRunReportFileByRunId,
  runReportFileDescriptor,
} from "@/models/platform/reportFiles";
import {
  validateRunReportFile,
  uploadRunReportFileObject,
  signRunReportFilePath,
  removeRunReportFileObject,
} from "@/lib/platform/runReportFiles";
import { extractReportFileText } from "@/lib/platform/runReportFileText";
import { MAX_REFERENCE_TEXT } from "@/models/platform/ai/report";

export const dynamic = "force-dynamic";

/**
 * RUN REPORT FILE — the document a Run hands to its report writer.
 *
 * POST   /api/platform/form-runs/report-file      (multipart: run_id, file)
 * GET    /api/platform/form-runs/report-file?run_id=<id>[&text=1]
 * DELETE /api/platform/form-runs/report-file?run_id=<id>
 *
 * Attaching, replacing and removing are edits of the Run, so they carry
 * `runs.edit`. READING is not: whoever may open the Run may open the document it
 * was configured with, so the read carries `runs.view` — the same gate that
 * already lets them see the run's settings.
 *
 * The document is read into text BEFORE it is stored, and the outcome travels
 * with the row. A document the writer cannot use is still a valid attachment
 * (a human can open it), so it is kept and labelled rather than refused — but the
 * screen is told, so nobody assumes a report read something it did not.
 *
 * The storage path never leaves the server: the read hands out a short-lived
 * signed link instead, and only for an object under this domain's own prefix.
 */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("runs", "edit");
    if (capError) return capError;

    const formData = await req.formData();
    const runId = parseInt(formData.get("run_id"));
    const file = formData.get("file");

    if (!runId) {
      return NextResponse.json(
        { success: false, error: "platformMisc.runs.reportFileMissingRun" },
        { status: 400 },
      );
    }

    // Refuse before a byte is read or written, so a rejected document cannot
    // become an orphan object in storage.
    const check = validateRunReportFile(file);
    if (!check.success) {
      return NextResponse.json({ success: false, error: check.error }, { status: 400 });
    }

    const run = await getRunById(runId);
    if (run.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "platformMisc.runs.reportFileRunNotFound" },
        { status: 404 },
      );
    }

    const extraction = await extractReportFileText(file);

    const uploaded = await uploadRunReportFileObject({ file, runId, fileName: file.name });
    if (!uploaded.success) {
      return NextResponse.json(
        { success: false, error: uploaded.error },
        { status: uploaded.error === "platformMisc.runs.reportFileStorageUnavailable" ? 500 : 400 },
      );
    }

    // Read the previous row BEFORE replacing it: its object is removed once the
    // new one is safely in place, never before — a failed replacement must not
    // leave the Run with nothing.
    const previous = await getRunReportFileByRunId(runId);

    const session = await getSession().catch(() => null);
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

    return NextResponse.json({ success: true, file: runReportFileDescriptor(row) });
  } catch (error) {
    console.error("[Run report file] upload error:", error);
    return NextResponse.json(
      { success: false, error: "platformMisc.runs.reportFileUploadFailed" },
      { status: 500 },
    );
  }
}

/**
 * GET — the document's descriptor, and (only when asked) the text the report
 * writer reads. The text is fetched by a second query because it is the one part
 * of this document that is large: a screen that only shows "a document is
 * attached" must not move it.
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("runs", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const runId = parseInt(searchParams.get("run_id"));
    if (!runId) {
      return NextResponse.json(
        { success: false, error: "platformMisc.runs.reportFileMissingRun" },
        { status: 400 },
      );
    }

    const row = await getRunReportFileByRunId(runId);
    if (!row) return NextResponse.json({ success: true, file: null });

    const url = await signRunReportFilePath(row.storage_path);

    const payload = { success: true, file: runReportFileDescriptor(row, url) };
    if (searchParams.get("text") === "1") {
      const stored = await getRunReportFileTextByRunId(runId);
      payload.text = stored?.text || "";
      // How much of it the report writer actually reads, so the screen can say so
      // instead of letting a long document look fully used.
      payload.prompt_limit = MAX_REFERENCE_TEXT;
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[Run report file] read error:", error);
    return NextResponse.json(
      { success: false, error: "platformMisc.runs.reportFileReadFailed" },
      { status: 500 },
    );
  }
}

/** DELETE — detach the document: the row first (source of truth), the object after. */
export async function DELETE(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("runs", "edit");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const runId = parseInt(searchParams.get("run_id"));
    if (!runId) {
      return NextResponse.json(
        { success: false, error: "platformMisc.runs.reportFileMissingRun" },
        { status: 400 },
      );
    }

    const storagePath = await deleteRunReportFileByRunId(runId);
    if (storagePath) await removeRunReportFileObject(storagePath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Run report file] delete error:", error);
    return NextResponse.json(
      { success: false, error: "platformMisc.runs.reportFileRemoveFailed" },
      { status: 500 },
    );
  }
}
