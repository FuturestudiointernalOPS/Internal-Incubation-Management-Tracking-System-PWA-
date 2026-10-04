import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { regenerateRunReport } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuthorization("runs", "edit");
    if (authError) return authError;

    const { submission_id } = await req.json();
    if (!submission_id) return NextResponse.json({ success: false, error: "submission_id required" }, { status: 400 });

    // The service re-rolls the document and records the regeneration on the
    // timeline; the controller only streams the bytes.
    const resultDocument = await regenerateRunReport({ submission_id });
    if (resultDocument.status !== "ok") {
      return NextResponse.json(
        { success: false, error: resultDocument.error || "Result document unavailable" },
        { status: resultDocument.status === "not_found" ? 404 : 400 },
      );
    }
    return new NextResponse(resultDocument.pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="result-${parseInt(submission_id)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}