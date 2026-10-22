import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/models/authorization/index";
import { requireSameOrigin } from "@/lib/requestOrigin";
import {
  getShadowReport,
  resetShadowReport,
} from "@/services/authorization/shadow";

export const dynamic = "force-dynamic";

/**
 * SHADOW-MODE COLLECTION REPORT (Phase 5, c3b).
 *
 *   GET     requires permissions.view_matrix
 *           → the divergences collected since the process started: total, a
 *             per-resource/policy breakdown (with the DIRECTION of the gap) and
 *             a bounded recent list. Inert until `AUTHZ_SHADOW_MODE=1`.
 *           State-changing GET guard (same-origin), like the registry reads.
 *
 *   DELETE  requires permissions.view_matrix + same-origin
 *           → clears the buffer so an operator starts a fresh measurement.
 *
 * The buffer is IN-MEMORY and per instance (like the rate limiter): it is the
 * measurement aid for a focused staging run, not a durable audit store. Durable
 * history lives in the permission audit log.
 */
export async function GET(req) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    await initDb();
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    return NextResponse.json({ success: true, ...getShadowReport() });
  } catch (error) {
    console.error("[shadow-report] GET error:", error.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    await initDb();
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    resetShadowReport();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[shadow-report] DELETE error:", error.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
