import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  requireAssignmentAccess,
  hasProgramManagementAccess,
} from "@/lib/auth";
import {
  createFacilitatorReview,
  decideFacilitatorReview,
  ensureFacilitatorReviewColumn,
  findChangesRequestedReview,
  getProgramAssignedPmId,
  getReviewProgramId,
  listFacilitatorReviews,
  resetReviewForResubmission,
} from "@/models/facilitation";

/**
 * FACILITATOR REVIEWS API
 * -----------------------------------------------------------------------------
 * Facilitators submit reviews to the Program Manager. The PM records a
 * decision/action on the same row — the original review text is preserved
 * (audit trail) and never rewritten by the PM.
 *
 * GET  /api/facilitator-reviews?program_id=...      (PM / super_admin / staff)
 * GET  /api/facilitator-reviews?facilitator_id=...  (facilitator sees own)
 * POST /api/facilitator-reviews                     (facilitator / PM / SA)
 * PUT  /api/facilitator-reviews                     (PM decision — SA / PM / staff)
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "super_admin",
      "program_manager",
      "staff",
      "teacher",
      "facilitator",
    ]);
    if (authError) return authError;

    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const facilitatorId = searchParams.get("facilitator_id");
    const weekNumber = searchParams.get("week_number");

    // Non-management roles may only read their own reviews
    const res = await listFacilitatorReviews({
      programId,
      facilitatorId,
      weekNumber,
      onlyOwn: !!(session && !hasProgramManagementAccess(session.role)),
      ownCid: session?.cid,
    });
    return NextResponse.json({ success: true, reviews: res.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

// Additive/idempotent — ensures the structured review columns exist so the
// route works even before migration 042 is applied. Never drops legacy columns.
async function ensureReviewStructure() {
  const cols = [
    "overall_rating TEXT",
    "went_well TEXT",
    "struggles TEXT",
    "engagement TEXT",
    "needs_attention_type TEXT",
    "needs_attention_note TEXT",
    "focus_next_week TEXT",
    "additional_notes TEXT",
  ];
  for (const col of cols) {
    try {
      await ensureFacilitatorReviewColumn(col);
    } catch (_) {}
  }
}

export async function POST(req) {
  try {
    await initDb();
    await ensureReviewStructure();
    const authError = await requireAuth([
      "super_admin",
      "program_manager",
      "staff",
      "facilitator",
    ]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const {
      program_id,
      week_number,
      // Legacy free-form fields (kept for backward compatibility)
      participant_progress,
      attendance_concerns,
      assignment_performance,
      challenges,
      participants_needing_intervention,
      completed_work,
      needs_attention,
      recommendations,
      // Structured weekly check-in fields
      overall_rating,
      went_well,
      struggles,
      engagement,
      needs_attention_type,
      needs_attention_note,
      focus_next_week,
      additional_notes,
    } = body;

    if (!program_id) {
      return NextResponse.json(
        { success: false, error: "program_id is required" },
        { status: 400 },
      );
    }

    // Enforce program assignment for non-management roles
    if (session && !hasProgramManagementAccess(session.role)) {
      const guardError = await requireAssignmentAccess({
        resource: "program",
        contextId: program_id,
      });
      if (guardError) return guardError;
    }

    const facilitatorCid = session.cid || "unknown";
    const parsedWeek = week_number ? parseInt(week_number) : null;
    const values = [
      participant_progress || null,
      attendance_concerns || null,
      assignment_performance || null,
      challenges || null,
      participants_needing_intervention || null,
      completed_work || null,
      needs_attention || null,
      recommendations || null,
      overall_rating || null,
      went_well || null,
      struggles || null,
      engagement || null,
      needs_attention_type || null,
      needs_attention_note || null,
      focus_next_week || null,
      additional_notes || null,
    ];

    // Respond-to-changes: if the PM requested changes on this week's review,
    // update the same row (reset to submitted, clear the decision) instead of
    // creating a duplicate review for the same program/week.
    if (parsedWeek != null) {
      const existing = await findChangesRequestedReview(
        program_id,
        facilitatorCid,
        parsedWeek,
      );
      if (existing.rows.length > 0) {
        const reviewId = existing.rows[0].id;
        await resetReviewForResubmission(reviewId, values);
        return NextResponse.json({ success: true, reviewId });
      }
    }

    const result = await createFacilitatorReview({
      program_id,
      facilitatorCid,
      facilitatorName: session.name || null,
      weekNumber: parsedWeek,
      values,
    });

    return NextResponse.json({
      success: true,
      reviewId: result.rows[0]?.id ?? result.lastInsertRowid,
    });
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
    const { id, pm_decision, pm_decision_note } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    // PMs can only decide on reviews for programs they manage (or SA/staff)
    if (session.role === "program_manager") {
      const review = await getReviewProgramId(id);
      const progId = review.rows[0]?.program_id;
      if (progId) {
        const prog = await getProgramAssignedPmId(progId);
        if (prog.rows[0]?.assigned_pm_id !== session.cid) {
          return NextResponse.json(
            { success: false, error: "errors.insufficientPermissions" },
            { status: 403 },
          );
        }
      }
    }

    await decideFacilitatorReview({
      id,
      pm_decision,
      pm_decision_note,
      decidedBy: session.cid,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
