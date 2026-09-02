import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getAuthorizationContext,
  effectivePermissionsFromContext,
} from "@/lib/authorization";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/permissions
 *
 * Returns the CURRENT user's effective permission matrix (resolver-driven,
 * 60s-cached) for frontend visibility decisions (e.g. capability-projected
 * navigation). This is NEVER a security boundary — every API remains
 * server-authoritative. Requires only an authenticated session.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );
    }
    const ctx = await getAuthorizationContext(session);
    return NextResponse.json({
      success: true,
      role: session.role,
      isSuperAdmin: !!ctx?.isSuperAdmin,
      effective: effectivePermissionsFromContext(ctx),
    });
  } catch (e) {
    console.error("[me/permissions] error:", e.message);
    return NextResponse.json(
      { success: false, error: "errors.authzSystemFailure" },
      { status: 500 },
    );
  }
}
