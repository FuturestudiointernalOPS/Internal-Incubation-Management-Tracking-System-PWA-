/**
 * Internal operations — FACILITATOR REVIEWS (SERVICE layer).
 *
 * The domain work behind `/api/facilitator-reviews`. Facilitators submit a
 * weekly review to the Program Manager; the PM records a decision on the same
 * row. What lives here:
 *
 *   - the idempotent structured-column steps (so the route works before
 *     migration 042 is applied);
 *   - the READ scope: non-management roles may only read their own reviews;
 *   - the SUBMIT assembly: the 16 body values in their fixed order, and the
 *     respond-to-changes branch that updates the same row (reset to submitted,
 *     decision cleared) instead of duplicating a review for the same
 *     program/week;
 *   - the DECIDE rule: a PM may only decide a review for a program they manage.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`. The controller keeps `requireAuth`,
 * the assignment guard (which answers HTTP) and the envelope.
 */

import { hasProgramManagementAccess } from "@/server/authz/capabilities";
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
 * The structured review columns, in order. Additive and idempotent — the route
 * works even before migration 042 is applied; legacy columns are never dropped.
 */
export const REVIEW_COLUMNS = [
  "overall_rating TEXT",
  "went_well TEXT",
  "struggles TEXT",
  "engagement TEXT",
  "needs_attention_type TEXT",
  "needs_attention_note TEXT",
  "focus_next_week TEXT",
  "additional_notes TEXT",
];

/** Add every structured review column, best-effort. */
export async function ensureReviewStructure() {
  for (const column of REVIEW_COLUMNS) {
    try {
      await ensureFacilitatorReviewColumn(column);
    } catch (_) {}
  }
}

/**
 * List reviews. Non-management roles may only read their own.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function listReviews({ session, programId, facilitatorId, weekNumber }) {
  const reviewsResult = await listFacilitatorReviews({
    programId,
    facilitatorId,
    weekNumber,
    onlyOwn: !!(session && !hasProgramManagementAccess(session.role)),
    ownCid: session?.cid,
  });
  return { status: 200, body: { success: true, reviews: reviewsResult.rows } };
}

/**
 * The 16 submitted values, in the order the model's INSERT expects them: the
 * legacy free-form fields first, then the structured weekly check-in fields.
 */
export function buildReviewValues(body) {
  return [
    body.participant_progress || null,
    body.attendance_concerns || null,
    body.assignment_performance || null,
    body.challenges || null,
    body.participants_needing_intervention || null,
    body.completed_work || null,
    body.needs_attention || null,
    body.recommendations || null,
    body.overall_rating || null,
    body.went_well || null,
    body.struggles || null,
    body.engagement || null,
    body.needs_attention_type || null,
    body.needs_attention_note || null,
    body.focus_next_week || null,
    body.additional_notes || null,
  ];
}

/**
 * Submit a weekly review. When the PM asked for changes on this program/week,
 * the same row is updated instead of creating a duplicate.
 *
 * The controller has already answered the `reviews.submit` assignment guard.
 *
 * @returns {Promise<{status: number, body?: Object, error?: string}>}
 */
export async function submitReview({ session, body }) {
  const { program_id, week_number } = body;
  const values = buildReviewValues(body);

  const facilitatorCid = session.cid || "unknown";
  const parsedWeek = week_number ? parseInt(week_number) : null;

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
      return { status: 200, body: { success: true, reviewId } };
    }
  }

  const result = await createFacilitatorReview({
    program_id,
    facilitatorCid,
    facilitatorName: session.name || null,
    weekNumber: parsedWeek,
    values,
  });

  return {
    status: 200,
    body: {
      success: true,
      reviewId: result.rows[0]?.id ?? result.lastInsertRowid,
    },
  };
}

/**
 * Record the PM decision on a review. Program managers may only decide on a
 * review belonging to a program they manage.
 *
 * @returns {Promise<{status: number, body?: Object, error?: string}>}
 */
export async function decideReview({ session, id, pm_decision, pm_decision_note }) {
  if (!id) {
    return { status: 400, error: "id is required" };
  }

  // PMs can only decide on reviews for programs they manage (or SA/staff)
  if (session.role === "program_manager") {
    const reviewProgramResult = await getReviewProgramId(id);
    const programId = reviewProgramResult.rows[0]?.program_id;
    if (programId) {
      const assignedPmResult = await getProgramAssignedPmId(programId);
      if (assignedPmResult.rows[0]?.assigned_pm_id !== session.cid) {
        return { status: 403, error: "errors.insufficientPermissions" };
      }
    }
  }

  await decideFacilitatorReview({
    id,
    pm_decision,
    pm_decision_note,
    decidedBy: session.cid,
  });

  return { status: 200, body: { success: true } };
}
