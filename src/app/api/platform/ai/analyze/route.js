import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { analyzeSubmissionForRun } from "@/services/platform/analysis";

/**
 * Platform AI Analysis API
 *
 * POST /api/platform/ai/analyze
 *   { submission_id: number, mode?: "summarize" | "analyze" }
 *
 * Returns AI-generated summary, flags, score for a submission.
 * Results are advisory only — human decisions remain final.
 *
 * Thin controller: gates on `runs.view` and delegates to
 * `@/services/platform/analysis` (see docs/LAYER_SPLIT.md).
 */

export async function POST(req) {
  try {
    await initDb();
    // Advisory read of one submission (summary, flags, score). The result is
    // explicitly advisory — a human decision stays final — so it is gated on
    // the `runs.view` capability rather than a role name. The role list that
    // stood here could not be satisfied by any grant or assignment.
    const capError = await requireAuthorization("runs", "view");
    if (capError) return capError;

    const payload = await req.json();
    const { status, body } = await analyzeSubmissionForRun(payload);
    return NextResponse.json(body, { status });
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
