import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { syncRunDeadlines, unsyncRunDeadlines, syncAllRunDeadlines, checkCalendarHealth } from "@/lib/integrations/calendar/sync";

/**
 * Platform Calendar Integration API
 *
 * GET  /api/platform/integrations/calendar?action=health
 * POST /api/platform/integrations/calendar  { action, runId }
 */

export async function GET(req) {
  // Integration health discloses provider identity, whether credentials are
  // configured, and provider error text. It was readable anonymously while the
  // POST beside it was gated. It is platform-configuration state, so it follows
  // the System Settings read capability.
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

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
    const authError = await requireAuth(["super_admin", "program_manager"]);
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
