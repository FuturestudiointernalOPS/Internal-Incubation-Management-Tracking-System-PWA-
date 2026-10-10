import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/models/authorization/index";
import {
  SELF_SCOPED_ROUTES,
  OPEN_ASSUMED_ROUTES,
} from "@/services/authorization/actionDeclarations";

export const dynamic = "force-dynamic";

/**
 * GET /api/engineering/permissions/open-actions
 *
 * The list of API actions that carry NO permission decision, and WHY each is
 * acceptable (spec §13): the administrable view of the two declaration ratchets.
 * Feeds the Permission Center's "Open actions" tab.
 *
 *   selfScoped  — open to any connected user, scope = the caller themselves.
 *   openAssumed — public by design (intake / auth flow / token) or guarded by a
 *                 secret (scheduled task / webhook signature).
 *
 * Read-only. Gated on `permissions.view_matrix` (same as the rest of the centre).
 */
export async function GET() {
  try {
    await initDb();
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    return NextResponse.json({
      success: true,
      selfScoped: SELF_SCOPED_ROUTES,
      openAssumed: OPEN_ASSUMED_ROUTES,
    });
  } catch (error) {
    console.error("[open-actions] GET error:", error.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
