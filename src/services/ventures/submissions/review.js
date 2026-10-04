/**
 * DELIVERABLE SUBMISSIONS — the review use-case.
 *
 * Applies a review decision to one submission: the business rules, the role
 * lock, the review write, the follow-up scheduling, the participant
 * notification, the team propagation and the KPI recalculation. The route keeps
 * the assignment / scope guard (it answers HTTP).
 *
 * Reads and writes go through `@/models/forms`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import {
  checkSubmissionInFacilitatorTeamScope,
  createSubmissionFollowup,
  createSubmissionFollowupEvent,
  createSubmissionNotification,
  ensureSubmissionsFollowupsParticipantCidColumn,
  ensureSubmissionsReviewedByRoleColumn,
  ensureSubmissionsScoreColumn,
  ensureSubmissionsUpdatedAtColumn,
  getSubmissionReviewDetails,
  propagateSubmissionToTeamMembers,
  updateSubmissionReview,
} from "@/models/forms";
import { getFacilitatorTeamScope } from "@/models/authorization/accessQueries";

/**
 * Whether the session's facilitator assignment covers this submission. A
 * facilitator with NO assigned teams has no record scope here (fail closed).
 */
export async function isSubmissionWithinFacilitatorScope({ id, sessionCid, programId }) {
  const scope = await getFacilitatorTeamScope(programId, sessionCid);
  if (scope.scope !== "all") {
    if (scope.teamIds.length === 0) return false;
    const scopeCheckResult = await checkSubmissionInFacilitatorTeamScope(id, scope.teamIds);
    if (scopeCheckResult.rows.length === 0) return false;
  }
  return true;
}

/**
 * Apply a review decision to a submission (after the route's assignment/scope
 * guard): the business rules, the role lock, the review write, the follow-up
 * scheduling, the participant notification, the team propagation and the KPI
 * recalculation. Returns `{ denied: { error, status } }` or `{ ok: true }`.
 */
export async function applySubmissionReview({ session, payload }) {
  const {
    id,
    status,
    feedback,
    score,
    review_action,
    rejection_reason,
    followup_date,
    followup_time,
    followup_duration,
    meeting_link,
    followup_notes,
  } = payload || {};

  // ─── Business Rules ──────────────────────────────────────────────
  if (status === "revision_requested" && !feedback) {
    return {
      denied: { error: "Written feedback is required when requesting a revision", status: 400 },
    };
  }
  if (status === "rejected" && !rejection_reason) {
    return { denied: { error: "Rejection reason is required", status: 400 } };
  }
  // ────────────────────────────────────────────────────────────────

  const statusLabel =
    {
      approved: "Approved",
      rejected: "Rejected",
      revision_requested: "Revision Requested",
      pending: "Pending",
      pending_followup: "Follow-up Scheduled",
    }[status] || status;

  // 1. Current submission & participant details for the notification
  const reviewDetailsResult = await getSubmissionReviewDetails(id);
  const submission = reviewDetailsResult.rows[0];

  // Role Lock: a facilitator and program management cannot override each
  // other's decisions. Once a final decision (approved/rejected) exists, only
  // the role that made it may change it. super_admin and staff are exempt.
  const roleCamp = (role) => {
    if (role === "facilitator") return "facilitator";
    if (role === "program_manager") return "management";
    return null; // super_admin / staff → not locked
  };
  const FINAL_STATUSES = ["approved", "rejected"];
  if (submission && FINAL_STATUSES.includes(submission.status) && submission.reviewed_by_role) {
    const requesterCamp = roleCamp(session?.role);
    const reviewerCamp = roleCamp(submission.reviewed_by_role);
    if (requesterCamp && reviewerCamp && requesterCamp !== reviewerCamp) {
      const actorLabel =
        reviewerCamp === "facilitator" ? "a facilitator" : "the program manager";
      return {
        denied: {
          error: `This submission was already ${submission.status} by ${actorLabel}. Only that role can change the decision.`,
          status: 403,
        },
      };
    }
  }

  // 2. Ensure the columns exist (migration safety)
  try { await ensureSubmissionsScoreColumn(); } catch (_) {}
  try { await ensureSubmissionsReviewedByRoleColumn(); } catch (_) {}
  try { await ensureSubmissionsUpdatedAtColumn(); } catch (_) {}
  try { await ensureSubmissionsFollowupsParticipantCidColumn(); } catch (_) {}

  // 3. Update the row with all review fields. Preserve an existing score when
  // the reviewer does not send a new one (facilitators review without a score;
  // the PM grades via the dashboard).
  const hasNewScore = score !== undefined && score !== null && score !== "";
  await updateSubmissionReview({
    id,
    status,
    feedback,
    score,
    hasNewScore,
    review_action,
    rejection_reason,
    role: session?.role,
    teacherId: session?.cid || session?.email || null,
  });

  // 3. Follow-up Scheduling (creates a calendar event + a followup record)
  if (status === "pending_followup" && followup_date && submission) {
    try {
      const eventTitle = `Follow-up: ${submission.deliverable_title || "Submission Review"}`;
      const eventStart = followup_time
        ? new Date(`${followup_date}T${followup_time}`)
        : new Date(followup_date);

      await createSubmissionFollowupEvent({
        program_id: submission.program_id,
        title: eventTitle,
        description: followup_notes || null,
        start_time: eventStart.toISOString(),
        end_time: new Date(eventStart.getTime() + (followup_duration || 30) * 60000).toISOString(),
        location: meeting_link || null,
        participant_id: submission.participant_id,
        created_by: "instructor",
      });

      await createSubmissionFollowup({
        program_id: submission.program_id,
        participant_cid: submission.participant_cid || submission.participant_id,
        submission_id: id,
        comment: followup_notes || `Follow-up meeting for ${submission.deliverable_title || "submission"}`,
        scheduled_at: eventStart.toISOString(),
        duration_minutes: followup_duration || 30,
        meeting_link: meeting_link || null,
        notes: followup_notes || null,
      });
    } catch (_) {
      // Calendar creation failure is non-blocking
    }
  }

  // 4. Dispatch an in-app notification to the participant (non-blocking). No
  // email is sent for program-deliverable reviews — the badge is enough.
  if (submission && submission.participant_id) {
    try {
      const notificationTitle = `Submission ${statusLabel}`;
      let notificationMessage = feedback
        ? `Your deliverable "${submission.deliverable_title || ""}" for ${submission.program_name || ""} was ${statusLabel}. Feedback: ${feedback}`
        : `Your deliverable "${submission.deliverable_title || ""}" for ${submission.program_name || ""} was ${statusLabel}.`;

      if (status === "rejected" && rejection_reason) {
        notificationMessage += ` Reason: ${rejection_reason}`;
      }

      await createSubmissionNotification(
        submission.participant_id,
        notificationTitle,
        notificationMessage,
      );
    } catch (_) {}
  }

  // 5. Group Assessment Propagation: a team submission propagates the same
  // score/status to all team members for this deliverable (the role lock still
  // protects sibling decisions).
  if (submission?.team_id && (score != null || status === "approved")) {
    try {
      const requesterCampForProp = roleCamp(session?.role);
      await propagateSubmissionToTeamMembers({
        status,
        score,
        hasNewScore,
        feedback,
        review_action,
        rejection_reason,
        role: session?.role,
        teacherId: session?.cid || session?.email || null,
        teamId: submission.team_id,
        deliverableId: submission.deliverable_id,
        documentId: submission.document_id,
        id,
        requesterCampForProp,
      });
    } catch (_) {}
  }

  // 6. Recalculate KPI progress when the status becomes a final decision
  if ((status === "approved" || status === "rejected") && submission?.program_id) {
    try {
      const {
  recalculateKpiProgress,
} = require("@/services/programs/kpiProgress");
      await recalculateKpiProgress(submission.program_id);
    } catch (_) {}
  }

  return { ok: true };
}
