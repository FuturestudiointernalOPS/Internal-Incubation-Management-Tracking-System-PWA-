import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { buildContextGrantReadiness } from "@/models/authorization/contextGrantReadiness";

export const dynamic = "force-dynamic";

/**
 * GET /api/engineering/permissions/context-grant-readiness
 *     requires permissions.view_matrix
 *
 * READ-ONLY. The report an administrator consults before narrowing the
 * portfolio-wide defaults and after applying the assignment-derived model.
 *
 * Per person, per assignment role:
 *   applied[]       — capabilities the mechanism has granted
 *   expired[]       — granted rows whose program end date has passed (the
 *                     resolver already ignores these; the sweep removes them)
 *   driftToAdd[]    — the next reconcile will add these
 *   driftToRemove[] — the next reconcile will withdraw these
 *   wouldLose[]     — capabilities held TODAY that this assignment does not
 *                     justify — i.e. what a strictly assignment-derived model
 *                     would take away
 *   expiresAt       — when the access ends (the program's end date)
 *
 * `summary.wouldLose` is the union across people: the keys to review before
 * making access strictly assignment-derived.
 */
export async function GET(req) {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const limitParam = Number.parseInt(searchParams.get("limit") || "", 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 200;

    const report = await buildContextGrantReadiness({ limit });
    return NextResponse.json(report);
  } catch (err) {
    console.error("[Context Grant Readiness] error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
