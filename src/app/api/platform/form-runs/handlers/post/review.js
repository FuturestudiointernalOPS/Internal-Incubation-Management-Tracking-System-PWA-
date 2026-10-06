import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { processReviewInternal } from "@/services/platform/formRuns";
import { scheduleResultSweep } from "../scheduleResultSweep";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    // Deciding an applicant (approve/reject + automation + emails) is its OWN
    // capability, so holding runs.edit — which is what lets someone send run
    // messages, assign people and retry emails — never implies the authority
    // to admit or reject a person. Granted to nobody by default: only Super
    // Admin (eligibility bypass) can decide until runs.review is granted.
    const authError = await requireAuthorization("runs", "review");
    if (authError) return authError;

    const { submission_id, decision, comment, internal_note, dimension_overrides, force, include_result_pdf } = await req.json();
    if (!submission_id || !decision) return NextResponse.json({ success: false, error: "submission_id and decision required" }, { status: 400 });

    const reviewResult = await processReviewInternal({
      submission_id: parseInt(submission_id),
      decision,
      comment,
      internal_note,
      dimension_overrides,
      force,
      session,
      includeResultPdf: include_result_pdf === true,
      after,
      scheduleResultSweep,
    });
    if (!reviewResult.ok) {
      return NextResponse.json({ success: false, error: reviewResult.error, error_code: reviewResult.errorCode || null }, { status: reviewResult.statusCode || 500 });
    }
    if (reviewResult.already_approved) {
      return NextResponse.json({
        success: true,
        already_approved: true,
        submission: reviewResult.submission,
        message: "Submission already approved — no duplicate actions performed",
      });
    }
    return NextResponse.json({ success: true, submission: reviewResult.submission, result_pdf: reviewResult.result_pdf || null });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}