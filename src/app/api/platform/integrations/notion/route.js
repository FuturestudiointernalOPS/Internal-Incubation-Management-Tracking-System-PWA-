import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { getNotionHealth, runNotionAction } from "@/services/platform/integrations";

/**
 * Platform Notion Integration API
 *
 * GET  /api/platform/integrations/notion?action=health
 * POST /api/platform/integrations/notion  { action, submissionId }
 *
 * Thin controller: gates the capabilities and delegates to
 * `@/services/platform/integrations` (see docs/LAYER_SPLIT.md).
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
    const { body } = await getNotionHealth();
    return NextResponse.json(body);
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}

export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin", "program_manager"]);
    if (authError) return authError;

    const { action, submissionId } = await req.json();
    const { status, body } = await runNotionAction({ action, submissionId });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("[Platform Notion API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
