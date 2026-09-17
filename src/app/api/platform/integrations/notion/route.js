import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { syncSubmission, syncAllSubmissions, checkNotionHealth } from "@/lib/integrations/notion/sync";

/**
 * Platform Notion Integration API
 *
 * GET  /api/platform/integrations/notion?action=health
 * POST /api/platform/integrations/notion  { action, submissionId }
 */

export async function GET(req) {
  // Integration health discloses whether the integration is configured and
  // which environment variables are present. It was readable anonymously while
  // the POST beside it was gated. Same rule as the calendar probe: platform
  // configuration state follows the System Settings read capability.
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "health";

  if (action === "health") {
    const health = checkNotionHealth();
    return NextResponse.json({ success: true, ...health });
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}

export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin", "admin", "program_manager"]);
    if (authError) return authError;

    const { action, submissionId } = await req.json();

    switch (action) {
      case "sync": {
        if (!submissionId) return NextResponse.json({ success: false, error: "submissionId required" }, { status: 400 });
        const result = await syncSubmission(submissionId);
        return NextResponse.json({ success: true, ...result });
      }

      case "sync-all": {
        const result = await syncAllSubmissions();
        return NextResponse.json({ success: true, ...result });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("[Platform Notion API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
