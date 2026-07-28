import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { summarizeSubmission, analyzeSubmission } from "@/lib/platform/integrations";

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
    const authError = await requireAuth(["super_admin", "admin", "program_manager", "teacher"]);
    if (authError) return authError;

    const { submission_id, mode } = await req.json();
    if (!submission_id) {
      return NextResponse.json({ success: false, error: "submission_id required" }, { status: 400 });
    }

    // Fetch submission
    const sub = await db.execute({
      sql: "SELECT * FROM platform_form_submissions WHERE id = ?",
      args: [submission_id],
    });
    if (sub.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Submission not found" }, { status: 404 });
    }

    const submission = sub.rows[0];

    // Fetch run and form for context
    const runRes = await db.execute({
      sql: "SELECT * FROM platform_form_runs WHERE id = ?",
      args: [submission.run_id],
    });
    const run = runRes.rows[0] || null;

    let form = null;
    if (run?.form_id) {
      const formRes = await db.execute({
        sql: "SELECT * FROM platform_forms WHERE id = ?",
        args: [run.form_id],
      });
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
      await db.execute({
        sql: `INSERT INTO platform_submission_timeline (submission_id, action, actor_id, metadata)
              VALUES (?, 'ai_analyzed', ?, ?)`,
        args: [
          submission_id,
          "system",
          JSON.stringify({ mode: analysisMode, timestamp: new Date().toISOString() }),
        ],
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
