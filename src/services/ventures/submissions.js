/**
 * DELIVERABLE SUBMISSIONS — the submit / review / list / score use-cases.
 *
 * A submission is versioned: each POST creates a new version (never an update).
 * Self-service callers (participant / member / team sessions) are bound to their
 * OWN identity and program, and may only submit into an active program they still
 * belong to; staff / PM / Super Admin submit on behalf. The capability /
 * assignment guards stay on the route (they answer HTTP).
 *
 * Reads and writes go through `@/models/forms` (and `@/models/teams` for the
 * team-ownership check); nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import {
  checkSubmissionInFacilitatorTeamScope,
  createSubmission,
  createSubmissionFollowup,
  createSubmissionFollowupEvent,
  createSubmissionNotification,
  ensureSubmissionsFollowupsParticipantCidColumn,
  ensureSubmissionsReviewedByRoleColumn,
  ensureSubmissionsScoreColumn,
  ensureSubmissionsTeamIdColumn,
  ensureSubmissionsUpdatedAtColumn,
  findMaxSubmissionVersion,
  getParticipantProgramSubmissionStatus,
  getSubmissionProgramStatus,
  getSubmissionReviewDetails,
  propagateSubmissionToTeamMembers,
  updateSubmissionReview,
} from "@/models/forms";
import { getTeamForOwnershipCheck } from "@/models/teams";
import { getFacilitatorTeamScope } from "@/lib/auth";

const MANAGEMENT_ROLES = ["staff", "super_admin", "program_manager"];

/**
 * Create a new submission version. Returns `{ denied: { error, status } }`, or
 * `{ submission }` on success.
 */
export async function createSubmissionRecord({ session, body }) {
  const role = String(session?.role || "").toLowerCase();

  // Phase 1.1 identity binding (self-service):
  //  - participant/member sessions may only submit AS THEMSELVES and only into a
  //    program where they hold an active participant membership;
  //  - team-entity sessions may only submit AS THEIR OWN TEAM and only into the
  //    program that owns the team.
  // The caller-chosen participant_id/team_id can no longer target someone
  // else's record.
  if (session && (role === "participant" || role === "member")) {
    if (body.participant_id && String(body.participant_id) !== String(session.cid)) {
      return { denied: { error: "errors.insufficientPermissions", status: 403 } };
    }
    if (!body.program_id) {
      return {
        denied: {
          error: "Missing required fields (program_id and deliverable_id or document_id)",
          status: 400,
        },
      };
    }
    const participationCheck = await getParticipantProgramSubmissionStatus(
      session.cid,
      body.program_id,
    );
    const participationRow = participationCheck.rows?.[0];
    if (!participationRow || String(participationRow.status || "").toLowerCase() === "completed") {
      return { denied: { error: "errors.insufficientPermissions", status: 403 } };
    }
    body.participant_id = session.cid;
    delete body.team_id;
  } else if (session && role === "team") {
    if (!body.program_id) {
      return {
        denied: {
          error: "Missing required fields (program_id and deliverable_id or document_id)",
          status: 400,
        },
      };
    }
    const ownTeam = await getTeamForOwnershipCheck(session.cid);
    const teamRow = ownTeam.rows?.[0];
    if (!teamRow || String(teamRow.program_id) !== String(body.program_id)) {
      return { denied: { error: "errors.insufficientPermissions", status: 403 } };
    }
    if (body.team_id && String(body.team_id) !== String(session.cid)) {
      return { denied: { error: "errors.insufficientPermissions", status: 403 } };
    }
    body.team_id = session.cid;
    delete body.participant_id;
  } else if (session && !MANAGEMENT_ROLES.includes(role)) {
    // Parity guard: every other role (founder, investor, …) was denied by the
    // old pre-filter and stays denied — only staff/PM/SA may submit on behalf.
    return { denied: { error: "errors.insufficientPermissions", status: 403 } };
  }

  const {
    program_id,
    deliverable_id,
    group_id,
    participant_id,
    team_id,
    submission_link,
    file_path,
    file_url,
    supporting_url,
    status,
    feedback,
    document_id,
  } = body;

  if (!program_id || (!deliverable_id && !document_id)) {
    return {
      denied: {
        error: "Missing required fields (program_id and deliverable_id or document_id)",
        status: 400,
      },
    };
  }

  // View-only gate: participants/teams cannot submit into a program that is no
  // longer active (completed/archived), nor when their own membership is closed
  // even if the program itself is still active.
  if (session && ["participant", "team"].includes(session.role)) {
    try {
      const programCheckResult = await getSubmissionProgramStatus(program_id);
      const programStatus = programCheckResult.rows[0]?.status;
      if (programStatus && String(programStatus).toLowerCase() !== "active") {
        return { denied: { error: "errors.programCompletedViewOnly", status: 403 } };
      }
      if (session.role === "participant") {
        const participationCheck = await getParticipantProgramSubmissionStatus(
          session.cid,
          program_id,
        );
        const participationStatus = String(participationCheck.rows[0]?.status || "").toLowerCase();
        if (participationStatus === "completed") {
          return { denied: { error: "errors.programCompletedViewOnly", status: 403 } };
        }
      }
    } catch (_) {}
  }

  // Resolve file URL (database requires this field to be non-null)
  const resolvedFileUrl = file_url || submission_link || file_path || supporting_url || "";

  // Ensure team_id column exists (teams submit as a unit; the PM table matches
  // submissions to members by team_id).
  try {
    await ensureSubmissionsTeamIdColumn();
  } catch (_) {}

  // Auto-detect document_id from deliverable_id if needed
  const finalDeliverableId = deliverable_id || null;
  const finalDocumentId =
    document_id ||
    (deliverable_id && !isNaN(Number(deliverable_id)) ? Number(deliverable_id) : null);

  // Determine version number: the highest existing version for this
  // participant+deliverable, plus one.
  let nextVersion = 1;
  try {
    const existingVersionResult = await findMaxSubmissionVersion({
      participant_id,
      program_id,
      deliverable_id: finalDeliverableId,
      document_id: finalDocumentId,
    });
    const existingVersion = existingVersionResult.rows[0]?.max_ver;
    if (existingVersion) {
      nextVersion = Number(existingVersion) + 1;
    }
  } catch (_) {
    // version_number column might not exist yet (pre-migration)
  }

  const result = await createSubmission({
    program_id,
    deliverable_id: finalDeliverableId,
    document_id: finalDocumentId,
    group_id,
    team_id,
    participant_id,
    file_url: resolvedFileUrl,
    supporting_url,
    status,
    feedback,
    version_number: nextVersion,
  });

  return {
    submission: {
      id: Number(result.rows[0]?.id ?? result.lastInsertRowid),
      program_id,
      deliverable_id,
      version_number: nextVersion,
      status: status || "pending",
    },
  };
}

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
      const { recalculateKpiProgress } = await import("@/lib/kpi-progress");
      await recalculateKpiProgress(submission.program_id);
    } catch (_) {}
  }

  return { ok: true };
}
