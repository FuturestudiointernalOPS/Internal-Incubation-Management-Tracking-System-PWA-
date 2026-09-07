import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { syncRunDeadlines, unsyncRunDeadlines, syncAllRunDeadlines, checkCalendarHealth } from "@/lib/integrations/calendar/sync";

/**
 * Platform Calendar Integration API
 *
 * GET  /api/platform/integrations/calendar?action=health
 * POST /api/platform/integrations/calendar  { action, runId }
 */

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "health";

  if (action === "health") {
    const health = await checkCalendarHealth();
    return NextResponse.json({ success: true, ...health });
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}

export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin", "admin", "program_manager"]);
    if (authError) return authError;

    const { action, runId } = await req.json();

    switch (action) {
      case "sync": {
        if (!runId) return NextResponse.json({ success: false, error: "runId required" }, { status: 400 });
        const result = await syncRunDeadlines(runId);
        return NextResponse.json({ success: true, ...result });
      }

      case "unsync": {
        if (!runId) return NextResponse.json({ success: false, error: "runId required" }, { status: 400 });
        const result = await unsyncRunDeadlines(runId);
        return NextResponse.json({ success: true, ...result });
      }

      case "sync-all": {
        const result = await syncAllRunDeadlines();
        return NextResponse.json({ success: true, ...result });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("[Platform Calendar API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
