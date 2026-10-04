import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { requireAssignmentAccess } from "@/server/authz/guards";
import { hasProgramManagementAccess } from "@/server/authz/capabilities";
import {
  decideReview,
  ensureReviewStructure,
  listReviews,
  submitReview,
} from "@/services/operations/facilitatorReviews";

/**
 * FACILITATOR REVIEWS API — controller layer.
 * -----------------------------------------------------------------------------
 * Facilitators submit reviews to the Program Manager. The PM records a
 * decision/action on the same row — the original review text is preserved
 * (audit trail) and never rewritten by the PM.
 *
 * GET  /api/facilitator-reviews?program_id=...      (management: all; others: own only)
 * GET  /api/facilitator-reviews?facilitator_id=...  (own reviews — assignment-free)
 * POST /api/facilitator-reviews                     (program-assigned facilitators / management)
 * PUT  /api/facilitator-reviews                     (PM decision — SA / PM / staff)
 *
 * Auth, the assignment guard (which answers HTTP) and the envelope only; the
 * decisions live in `@/services/operations/facilitatorReviews`.
 */

export async function GET(req) {
  try {
    await initDb();
    // Phase I5: the role pre-filter (facilitator/…) blocked members
    // with a legitimate program assignment. Any authenticated session may
    // reach the assignment gates below; only assigned facilitators (or
    // management roles) pass them.
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const { searchParams } = new URL(req.url);

    const result = await listReviews({
      session,
      programId: searchParams.get("program_id"),
      facilitatorId: searchParams.get("facilitator_id"),
      weekNumber: searchParams.get("week_number"),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    await ensureReviewStructure();
    // Phase I5: the program assignment gate below (requireAssignmentAccess)
    // is the security decision for non-management roles; the removed role
    // pre-filter used to block members holding a facilitator assignment.
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();

    if (!body.program_id) {
      return NextResponse.json(
        { success: false, error: "program_id is required" },
        { status: 400 },
      );
    }

    // Enforce program assignment for non-management roles.
    //
    // `reviews.submit` is passed so the per-program tick list is consulted: a
    // program manager who removes review submission from a facilitator's
    // assignment now actually stops it.
    if (session && !hasProgramManagementAccess(session.role)) {
      const guardError = await requireAssignmentAccess({
        resource: "program",
        contextId: body.program_id,
        capability: "reviews.submit",
        minLevel: 1,
      });
      if (guardError) return guardError;
    }

    const result = await submitReview({ session, body });
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Facilitator review POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "super_admin",
      "program_manager",
      "staff",
    ]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();

    const result = await decideReview({
      session,
      id: body.id,
      pm_decision: body.pm_decision,
      pm_decision_note: body.pm_decision_note,
    });
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
