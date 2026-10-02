import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireAuthorization } from "@/models/authorization/index";
import { getCalendarHealth, runCalendarAction } from "@/services/platform/integrations";

/**
 * Platform Calendar Integration API
 *
 * GET  /api/platform/integrations/calendar?action=health
 * POST /api/platform/integrations/calendar  { action, runId }
 *
 * Thin controller: gates the capabilities and delegates to
 * `@/services/platform/integrations` (see docs/LAYER_SPLIT.md).
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
    const { body } = await getCalendarHealth();
    return NextResponse.json(body);
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}

export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin", "program_manager"]);
    if (authError) return authError;

    const { action, runId } = await req.json();
    const { status, body } = await runCalendarAction({ action, runId });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("[Platform Calendar API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
