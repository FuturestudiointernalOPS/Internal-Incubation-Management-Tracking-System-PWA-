import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { requireSameOrigin } from "@/lib/requestOrigin";
import { syncAllContextGrantsEverywhere } from "@/models/authorization/contextGrants";

export const dynamic = "force-dynamic";

/**
 * GET /api/engineering/permissions/sync-context-grants
 *     requires permissions.view_matrix
 *
 * CONTEXT → PROFILE APPLICATION (idempotent reconcile, every context).
 *
 * Applies the Context Roles registry at the membership boundary:
 *
 *   venture:founder         — active venture membership → mapped profile caps
 *   program:facilitator     — active program assignment → the PER-PROGRAM TICK
 *                             LIST's capabilities (union, strongest level)
 *   program:program_manager — active program assignment → registry-mapped profile
 *
 * Program-derived grants carry the program's end date as an expiry, so the
 * access they justify ends with the program. Grants whose justifying
 * relationship ended are removed. Manual grants and administrator blocks are
 * never touched — a block is applied by the resolver AFTER the merge, so it
 * wins over anything this reconcile writes.
 *
 * Safe to re-run. Report shape:
 *   { success, contexts: [{ context, roleKey, evaluated, applied, revoked,
 *     changes }], evaluated, applied, revoked, changes }
 *
 * State-changing GET (CSRF-1) — same-origin only.
 */
export async function GET(req) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const result = await syncAllContextGrantsEverywhere();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Sync Context Grants] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
