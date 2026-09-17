import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getAuthorizationContext,
  effectivePermissionsFromContext,
} from "@/lib/authorization";
import { syncContextGrantsOnConnect } from "@/models/authorization/contextGrants";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/permissions
 *
 * Returns the CURRENT user's effective permission matrix (resolver-driven,
 * 60s-cached) for frontend visibility decisions (e.g. capability-projected
 * navigation). This is NEVER a security boundary — every API remains
 * server-authoritative. Requires only an authenticated session.
 *
 * ASSIGNMENT-DERIVED GRANTS ARE RECONCILED HERE FIRST. A facilitator or program
 * manager already in production when that mechanism shipped receives their
 * assignment-derived capabilities the moment they connect — additively, so
 * nothing they already hold is taken away. The reconcile is idempotent, bounded
 * to once per person per window, and best-effort: if it fails, the request still
 * answers with the grants the person already has.
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

    try {
      await syncContextGrantsOnConnect(session.cid, {
        email: session.email || null,
      });
    } catch (e) {
      // Never block the read: the grants already applied remain valid and the
      // scheduled sweep reconciles again.
      console.warn("[me/permissions] context reconcile skipped:", e.message);
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
