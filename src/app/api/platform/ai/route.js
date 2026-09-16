import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { summarizeSubmission, analyzeSubmission } from "@/lib/platform/integrations";

/**
 * PLATFORM AI API
 *
 * POST /api/platform/ai?action=summarize  — Summarize a submission
 * POST /api/platform/ai?action=analyze    — Analyze a submission, flag issues
 * GET  /api/platform/ai?action=health     — Check AI provider status
 */
export async function POST(req) {
  try {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    // Advisory AI on a submission: a summary and a set of flagged issues.
    // Gated on `runs.view` — asking for a reading aid about a submission you
    // can already read is a READ, and the result is advisory only (the human
    // decision stays final).
    //
    // This used to be a hardcoded ["super_admin", "admin", "program_manager"]
    // role list: no grant, no profile edit and no individual assignment could
    // ever satisfy it, and one of the three is the retired `admin` role. It is
    // now configurable like every other Runs permission — Permissions ->
    // Default Access -> Runs -> View for a template, or individual access for
    // one person. Pairs with the front end, which hides the control when the
    // capability is missing instead of letting the click 403.
    const capError = await requireAuthorization("runs", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const body = await req.json();

    if (action === "summarize") {
      const { submission, form } = body;
      if (!submission) return NextResponse.json({ success: false, error: "submission is required" }, { status: 400 });

      const summary = await summarizeSubmission(submission, form);
      return NextResponse.json({ success: true, summary });
    }

    if (action === "analyze") {
      const { submission, form } = body;
      if (!submission) return NextResponse.json({ success: false, error: "submission is required" }, { status: 400 });

      const analysis = await analyzeSubmission(submission, form);
      return NextResponse.json({ success: true, analysis });
    }

    return NextResponse.json({ success: false, error: "Invalid action. Use summarize or analyze." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "health") {
      const configured = !!process.env.GOOGLE_AI_STUDIO_API_KEY;
      return NextResponse.json({
        success: true,
        health: {
          provider: "gemini",
          model: "gemini-2.0-flash",
          configured,
          status: configured ? "ready" : "unconfigured",
        },
      });
    }

    return NextResponse.json({ success: false, error: "Use ?action=health" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
