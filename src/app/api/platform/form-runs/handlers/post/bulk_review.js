import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { getBulkReviewValidationsByIdsInRun } from "@/models/formRuns";
import { processReviewInternal } from "@/services/platform/formRuns";
import { scheduleResultSweep } from "../scheduleResultSweep";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    // Same separation as the single review: an admission decision is never a
    // side effect of holding runs.edit.
    const authError = await requireAuthorization("runs", "review");
    if (authError) return authError;

    const { run_id, submission_ids, decision, comment, include_result_pdf } = await req.json();
    if (!run_id || !Array.isArray(submission_ids) || submission_ids.length === 0) {
      return NextResponse.json({ success: false, error: "run_id and submission_ids are required" }, { status: 400 });
    }
    if (submission_ids.length > 25) {
      return NextResponse.json({ success: false, error: "A bulk batch can process at most 25 submissions" }, { status: 400 });
    }
    if (decision !== "approved") {
      return NextResponse.json({ success: false, error: "Only 'approved' is supported as a bulk action right now" }, { status: 400 });
    }

    const idList = [...new Set(submission_ids.map((id) => parseInt(id)).filter((numericId) => Number.isFinite(numericId)))];
    if (idList.length === 0) {
      return NextResponse.json({ success: false, error: "No valid submission ids provided" }, { status: 400 });
    }

    // Backend validation: every id must belong to THIS run — the frontend
    // selection state is never trusted alone.
    const validationsResult = await getBulkReviewValidationsByIdsInRun(idList, run_id);
    const validMap = new Map(validationsResult.rows.map((row) => [row.id, row]));

    const results = [];
    for (const id of idList) {
      const row = validMap.get(id);
      if (!row) {
        results.push({ submission_id: id, status: "failed", name: "", error: "Submission is not in this run" });
        continue;
      }
      if (row.status === "approved") {
        results.push({ submission_id: id, status: "already_approved", name: row.submitter_name || "" });
        continue;
      }
      try {
        const reviewResult = await processReviewInternal({
          submission_id: id,
          decision: "approved",
          comment: comment || "Bulk approved",
          session,
          includeResultPdf: include_result_pdf === true,
          after,
          scheduleResultSweep,
        });
        results.push({
          submission_id: id,
          status: reviewResult.ok ? (reviewResult.already_approved ? "already_approved" : "approved") : "failed",
          name: row.submitter_name || "",
          error: reviewResult.ok ? undefined : reviewResult.error,
          result_pdf: reviewResult.result_pdf ? reviewResult.result_pdf.status : undefined,
          result_pdf_error: reviewResult.result_pdf ? reviewResult.result_pdf.error : undefined,
        });
      } catch (error) {
        results.push({
          submission_id: id,
          status: "failed",
          name: row.submitter_name || "",
          error: error?.message || "Unknown error",
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}