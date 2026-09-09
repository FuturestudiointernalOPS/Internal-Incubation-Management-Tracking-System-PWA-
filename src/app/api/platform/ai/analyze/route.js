import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { summarizeSubmission, analyzeSubmission } from "@/lib/platform/integrations";
import {
  getFormForAiAnalysis,
  getRunForAiAnalysis,
  getSubmissionForAiAnalysis,
  logAiAnalysisToTimeline,
} from "@/models/platformAi";

/**
 * Platform AI Analysis API
 *
 * POST /api/platform/ai/analyze
 *   { submission_id: number, mode?: "summarize" | "analyze" }
 *
 * Returns AI-generated summary, flags, score for a submission.
 * Results are advisory only — human decisions remain final.
 */

export async function POST(req) {
  try {
    await initDb();
    // Phase 1.6 (C5b = A): AI analysis is management-only (SA/admin/PM) —
    // same rule as /api/platform/ai. Assignment-verified program staff can be
    // admitted later via a capability seam once run->program resolution lands.
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (session && !["super_admin", "admin", "program_manager"].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }

    const { submission_id, mode } = await req.json();
    if (!submission_id) {
      return NextResponse.json({ success: false, error: "submission_id required" }, { status: 400 });
    }

    // Fetch submission
    const sub = await getSubmissionForAiAnalysis(submission_id);
    if (sub.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Submission not found" }, { status: 404 });
    }

    const submission = sub.rows[0];

    // Fetch run and form for context
    const runRes = await getRunForAiAnalysis(submission.run_id);
    const run = runRes.rows[0] || null;

    let form = null;
    if (run?.form_id) {
      const formRes = await getFormForAiAnalysis(run.form_id);
      form = formRes.rows[0] || null;
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
    } catch (_) { /* timeline logging is non-critical */ }

    return NextResponse.json({
      success: true,
      submission_id,
      mode: analysisMode,
      ...result,
    });
  } catch (error) {
    console.error("[Platform AI API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  // Defect fix (I6A defect queue): health probe now requires an authenticated
  // session (consistent with the sibling platform/ai GET). It still only
  // reports provider configuration — never data.
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  if (searchParams.get("health") === "true") {
    const aiConfigured = !!process.env.DEEPSEEK_API_KEY;
    return NextResponse.json({
      success: true,
      configured: aiConfigured,
      provider: aiConfigured ? "deepseek" : "none",
    });
  }
  return NextResponse.json({ success: false, error: "Use POST for analysis or ?health=true for status" }, { status: 400 });
}
