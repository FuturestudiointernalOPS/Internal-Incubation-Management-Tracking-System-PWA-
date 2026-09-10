import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { syncAllContextGrants } from "@/models/authorization/contextGrants";

export const dynamic = "force-dynamic";

/**
 * GET /api/engineering/permissions/sync-context-grants
 *     requires permissions.view_matrix
 *
 * PHASE 6 — CONTEXT → PROFILE APPLICATION (idempotent reconcile).
 *
 * Applies the Context Roles registry at the membership boundary: an active
 * venture founder receives the mapped profile's capabilities as additive
 * individual grants (`granted_by = ctx:venture:founder`), and grants whose
 * justifying relationship ended are removed. Manual grants are never touched.
 *
 * Safe to re-run. After running it, re-check
 * GET /api/engineering/permissions/venture-strict-audit — `viewMissing`
 * should be empty for founders.
 *
 * Report shape:
 *   { success, context, roleKey, evaluated, applied: [...], revoked: [...],
 *     changes, results: [{ cid, profile, ventures, applied, revoked, reason }] }
 */
export async function GET() {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const result = await syncAllContextGrants();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Sync Context Grants] error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
