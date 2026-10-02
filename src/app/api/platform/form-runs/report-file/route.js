import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/models/authorization/index";
import { getSession } from "@/lib/auth";
import {
  attachRunReportFile,
  detachRunReportFile,
  getRunReportFilePayload,
} from "@/services/platform/reportFiles";

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
 * Thin controller: gates the capabilities, parses the request and delegates to
 * `@/services/platform/reportFiles` (see docs/LAYER_SPLIT.md).
 */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("runs", "edit");
    if (capError) return capError;

    const formData = await req.formData();
    const runId = parseInt(formData.get("run_id"));
    const file = formData.get("file");

    const session = await getSession().catch(() => null);
    const { status, body } = await attachRunReportFile({ runId, file, session });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("[Run report file] upload error:", error);
    return NextResponse.json(
      { success: false, error: "platformMisc.runs.reportFileUploadFailed" },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("runs", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const runId = parseInt(searchParams.get("run_id"));

    const { status, body } = await getRunReportFilePayload({
      runId,
      includeText: searchParams.get("text") === "1",
    });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("[Run report file] read error:", error);
    return NextResponse.json(
      { success: false, error: "platformMisc.runs.reportFileReadFailed" },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("runs", "edit");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const runId = parseInt(searchParams.get("run_id"));

    const { status, body } = await detachRunReportFile({ runId });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("[Run report file] delete error:", error);
    return NextResponse.json(
      { success: false, error: "platformMisc.runs.reportFileRemoveFailed" },
      { status: 500 },
    );
  }
}
