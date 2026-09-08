import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, requireAssignmentAccess, getFacilitatorTeamScope, hasProgramManagementAccess } from "@/lib/auth";
import {
  getSubmissionProgramStatus,
  getParticipantProgramSubmissionStatus,
  ensureSubmissionsTeamIdColumn,
  findMaxSubmissionVersion,
  createSubmission,
  ensureSubmissionsRoleLockColumn,
  getSubmissionProgramId,
  checkSubmissionInFacilitatorTeamScope,
  getSubmissionReviewDetails,
  ensureSubmissionsScoreColumn,
  ensureSubmissionsReviewedByRoleColumn,
  ensureSubmissionsUpdatedAtColumn,
  ensureSubmissionsFollowupsParticipantCidColumn,
  updateSubmissionReview,
  createSubmissionFollowupEvent,
  createSubmissionFollowup,
  createSubmissionNotification,
  propagateSubmissionToTeamMembers,
  ensureSubmissionsTeamIdColumnForListing,
  listSubmissions,
  ensureSubmissionScoresColumn,
  ensureSubmissionEvaluationScoreColumn,
  updateSubmissionScoreById,
  updateSubmissionsScoreForParticipant,
} from "@/models/forms";

/**
 * SUBMISSIONS API — TRACK 3 ENHANCED
 * Supports versioning, instructor review actions, follow-up scheduling.
 * Never overwrites previous submissions — each POST creates a new version.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "participant",
      "team",
    ]);
    if (authError) return authError;
    const body = await req.json();
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
      return NextResponse.json(
        { success: false, error: "Missing required fields (program_id and deliverable_id or document_id)" },
        { status: 400 },
      );
    }

    // View-only gate: participants/teams cannot submit into a program that is
    // no longer active (completed/archived). Staff/PM/SA manage programs
    // regardless of its status. Also blocks a participant whose own membership
    // is completed even when the program is still active (Phase 2 acceptance).
    const session = await getSession();
    if (session && ["participant", "team"].includes(session.role)) {
      try {
        const progCheck = await getSubmissionProgramStatus(program_id);
        const progStatus = progCheck.rows[0]?.status;
        if (progStatus && String(progStatus).toLowerCase() !== "active") {
          return NextResponse.json(
            { success: false, error: "errors.programCompletedViewOnly" },
            { status: 403 },
          );
        }
        // Person-level completion: the participant's own membership is closed
        // even if the program itself is still active.
        if (session.role === "participant") {
          const ppCheck = await getParticipantProgramSubmissionStatus(session.cid, program_id);
          const ppStatus = String(ppCheck.rows[0]?.status || "").toLowerCase();
          if (ppStatus === "completed") {
            return NextResponse.json(
              { success: false, error: "errors.programCompletedViewOnly" },
              { status: 403 },
            );
          }
        }
      } catch (_) {}
    }

    // Resolve file URL (database requires this field to be non-null)
    const resolvedFileUrl = file_url || submission_link || file_path || supporting_url || "";

    // Ensure team_id column exists (teams submit as a unit; the PM table
    // matches submissions to members by team_id).
    try {
      await ensureSubmissionsTeamIdColumn();
    } catch (_) {}

    // Auto-detect deliverable_id from document_id if needed
    const finalDeliverableId = deliverable_id || null;
    const finalDocumentId = document_id || 
      (deliverable_id && !isNaN(Number(deliverable_id)) ? Number(deliverable_id) : null);

    // Determine version number: find the highest existing version for this participant+deliverable
    let nextVersion = 1;
    try {
      const existingRes = await findMaxSubmissionVersion({
        participant_id,
        program_id,
        deliverable_id: finalDeliverableId,
        document_id: finalDocumentId,
      });
      const existingVersion = existingRes.rows[0]?.max_ver;
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

    return NextResponse.json({
      success: true,
      submission: {
        id: Number(result.rows[0]?.id ?? result.lastInsertRowid),
        program_id,
        deliverable_id,
        version_number: nextVersion,
        status: status || "pending",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
      "facilitator",
    ]);
    if (authError) return authError;
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
    } = await req.json();

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing ID or status" },
        { status: 400 },
      );
    }

    // Server-side enforcement: facilitators must be assigned to the program
    // and hold assignments.grade to review submissions.
    const session = await getSession();
    // Ensure role-lock column exists before we read it below.
    try { await ensureSubmissionsRoleLockColumn(); } catch (_) {}
    if (session && !hasProgramManagementAccess(session.role)) {
      const subRow = await getSubmissionProgramId(id);
      const progId = subRow.rows[0]?.program_id;
      if (!progId) {
        return NextResponse.json(
          { success: false, error: "Submission not found" },
          { status: 404 },
        );
      }
      const facError = await requireAssignmentAccess({
        resource: "program",
        contextId: progId,
        capability: "assignments.grade",
        minLevel: 1,
      });
      if (facError) return facError;
      const scope = await getFacilitatorTeamScope(progId, session.cid);
      if (scope.scope !== "all" && scope.teamIds.length > 0) {
        const inScope = await checkSubmissionInFacilitatorTeamScope(id, scope.teamIds);
        if (inScope.rows.length === 0) {
          return NextResponse.json(
            { success: false, error: "errors.insufficientPermissions" },
            { status: 403 },
          );
        }
      }
    }

    // ─── Business Rules ──────────────────────────────────────────────
    if (status === "revision_requested" && !feedback) {
      return NextResponse.json(
        { success: false, error: "Written feedback is required when requesting a revision" },
        { status: 400 },
      );
    }

    if (status === "rejected" && !rejection_reason) {
      return NextResponse.json(
        { success: false, error: "Rejection reason is required" },
        { status: 400 },
      );
    }
    // ─────────────────────────────────────────────────────────────────

    const statusLabel = { approved: "Approved", rejected: "Rejected", revision_requested: "Revision Requested", pending: "Pending", pending_followup: "Follow-up Scheduled" }[status] || status;

    // 1. Fetch current submission & participant details for notification
    const subRes = await getSubmissionReviewDetails(id);

    const sub = subRes.rows[0];

    // ─── Role Lock: a facilitator and program management cannot override
    //     each other's decisions. Once a final decision (approved/rejected)
    //     exists, only the role that made it may change it. super_admin and
    //     staff are exempt.
    const roleCamp = (role) => {
      if (role === "facilitator") return "facilitator";
      if (role === "program_manager" || role === "teacher") return "management";
      return null; // super_admin / staff → not locked
    };
    const FINAL_STATUSES = ["approved", "rejected"];
    if (sub && FINAL_STATUSES.includes(sub.status) && sub.reviewed_by_role) {
      const requesterCamp = roleCamp(session?.role);
      const reviewerCamp = roleCamp(sub.reviewed_by_role);
      if (requesterCamp && reviewerCamp && requesterCamp !== reviewerCamp) {
        const actorLabel =
          reviewerCamp === "facilitator"
            ? "a facilitator"
            : "the program manager";
        return NextResponse.json(
          {
            success: false,
            error: `This submission was already ${sub.status} by ${actorLabel}. Only that role can change the decision.`,
          },
          { status: 403 },
        );
      }
    }

    // 2. Ensure score column exists (migration safety)
    try { await ensureSubmissionsScoreColumn(); } catch (_) {}
    try { await ensureSubmissionsReviewedByRoleColumn(); } catch (_) {}
    try { await ensureSubmissionsUpdatedAtColumn(); } catch (_) {}
    try { await ensureSubmissionsFollowupsParticipantCidColumn(); } catch (_) {}

    // 3. Update Database with all review fields
    // Preserve an existing score when the reviewer does not send a new one
    // (facilitators review without a score; the PM grades via the dashboard).
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

    // 3. Handle Follow-up Scheduling (creates calendar event)
    if (status === "pending_followup" && followup_date && sub) {
      try {
        // Create event in v2_events for calendar sync
        const eventTitle = `Follow-up: ${sub.deliverable_title || "Submission Review"}`;
        const eventStart = followup_time
          ? new Date(`${followup_date}T${followup_time}`)
          : new Date(followup_date);

        const eventRes = await createSubmissionFollowupEvent({
          program_id: sub.program_id,
          title: eventTitle,
          description: followup_notes || null,
          start_time: eventStart.toISOString(),
          end_time: new Date(eventStart.getTime() + (followup_duration || 30) * 60000).toISOString(),
          location: meeting_link || null,
          participant_id: sub.participant_id,
          created_by: "instructor",
        });

        // Also create a followup record
        await createSubmissionFollowup({
          program_id: sub.program_id,
          participant_cid: sub.participant_cid || sub.participant_id,
          submission_id: id,
          comment: followup_notes || `Follow-up meeting for ${sub.deliverable_title || "submission"}`,
          scheduled_at: eventStart.toISOString(),
          duration_minutes: followup_duration || 30,
          meeting_link: meeting_link || null,
          notes: followup_notes || null,
        });
      } catch (_) {
        // Calendar creation failure is non-blocking
      }
    }

    // 4. Dispatch In-App Notification to Participant (non-blocking)
    if (sub && sub.participant_id) {
      try {
        let notifTitle = `Submission ${statusLabel}`;
        let notifMessage = feedback
          ? `Your deliverable "${sub.deliverable_title || ""}" for ${sub.program_name || ""} was ${statusLabel}. Feedback: ${feedback}`
          : `Your deliverable "${sub.deliverable_title || ""}" for ${sub.program_name || ""} was ${statusLabel}.`;

        if (status === "rejected" && rejection_reason) {
          notifMessage += ` Reason: ${rejection_reason}`;
        }

        await createSubmissionNotification(sub.participant_id, notifTitle, notifMessage);
      } catch (_) {}

      // NOTE: No email is sent for program-deliverable reviews. In-app
      // notification only — the participant sees the unread count badge.
    }

    // 5. Group Assessment Propagation: if this submission belongs to a team,
    //    propagate the same score/status to all team members for this deliverable.
    //    Never overwrite a sibling submission that was already decided by the
    //    other role camp (role lock).
    if (sub?.team_id && (score != null || status === "approved")) {
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
          teamId: sub.team_id,
          deliverableId: sub.deliverable_id,
          documentId: sub.document_id,
          id,
          requesterCampForProp,
        });
      } catch (_) {}
    }

    // 6. Recalculate KPI progress if status changed to approved/rejected
    if ((status === "approved" || status === "rejected") && sub?.program_id) {
      try {
        const { recalculateKpiProgress } = await import("@/lib/kpi-progress");
        await recalculateKpiProgress(sub.program_id);
      } catch (_) {}
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
      "participant",
      "team",
      "facilitator",
    ]);
    if (authError) return authError;
    // Ensure team_id column exists so team-level submissions resolve.
    try {
      await ensureSubmissionsTeamIdColumnForListing();
    } catch (_) {}
    const { searchParams } = new URL(req.url);
    const participant_id = searchParams.get("participant_id");
    const team_id = searchParams.get("team_id");
    const group_id = searchParams.get("group_id");
    const program_id = searchParams.get("program_id");
    const deliverable_id = searchParams.get("deliverable_id");
    const document_id = searchParams.get("document_id");
    const status = searchParams.get("status");
    const include_versions = searchParams.get("include_versions") === "true";
    const latest_only = searchParams.get("latest_only") === "true";

    // Server-side enforcement: only facilitators must be assigned to the
    // program and hold assignments.view. Scope restricts to their assigned
    // groups. Participants/teams/staff read their own submissions directly.
    const session = await getSession();
    let facScopeFilter = null;
    let facScopeArgs = [];
    if (session && program_id && session.role === "facilitator") {
      const facError = await requireAssignmentAccess({
        resource: "program",
        contextId: program_id,
        capability: "assignments.view",
        minLevel: 1,
      });
      if (facError) return facError;
      const scope = await getFacilitatorTeamScope(program_id, session.cid);
      if (scope.scope !== "all") {
        if (scope.teamIds.length === 0) {
          return NextResponse.json({ success: true, submissions: [] });
        }
        facScopeFilter =
          "s.participant_id IN (SELECT c.cid FROM contacts c WHERE c.v2_team_id IN (" +
          scope.teamIds.map(() => "?").join(",") +
          "))";
        facScopeArgs = scope.teamIds;
      }
    }

    const { rows } = await listSubmissions({
      participant_id,
      team_id,
      group_id,
      program_id,
      deliverable_id,
      document_id,
      status,
      latest_only,
      facScopeFilter,
      facScopeArgs,
    });

    // Format for UI
    const submissions = rows.map((r) => ({
      ...r,
      v2_deliverables: {
        title: r.deliverable_title,
        week_number: r.deliverable_week,
        due_date: r.deliverable_due_date,
      },
      v2_participants: r.participant_name ? { name: r.participant_name } : null,
      v2_groups: r.group_name ? { name: r.group_name } : null,
    }));

    // If include_versions, group and include version history
    if (include_versions && (participant_id || group_id)) {
      const grouped = {};
      for (const sub of submissions) {
        const groupId = sub.deliverable_id || sub.document_id || `doc-${sub.id}`;
        const key = `${sub.program_id}-${groupId}`;
        if (!grouped[key]) {
          grouped[key] = {
            deliverable_id: sub.deliverable_id,
            program_id: sub.program_id,
            deliverable_title: sub.deliverable_title,
            deliverable_week: sub.deliverable_week,
            deliverable_due_date: sub.deliverable_due_date,
            latest: sub,
            versions: [],
          };
        }
        grouped[key].versions.push(sub);
        // Sort versions by version_number
        grouped[key].versions.sort(
          (a, b) => (b.version_number || 0) - (a.version_number || 0),
        );
      }

      return NextResponse.json({
        success: true,
        grouped: Object.values(grouped),
        total: Object.keys(grouped).length,
      });
    }

    return NextResponse.json({ success: true, submissions });
  } catch (error) {
    console.error("Submissions GET Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin", "program_manager"]);
    if (authError) return authError;
    const { id, participant_id, program_id, score, evaluation_data } = await req.json();

    // Accept either a single submission id OR participant_id + program_id
    // (applies the same score to every submission of that participant).
    if (!id && (!participant_id || !program_id)) {
      return NextResponse.json(
        { success: false, error: "Missing submission ID or participant_id + program_id" },
        { status: 400 },
      );
    }

    // Ensure both score columns exist (migration safety).
    try { await ensureSubmissionScoresColumn(); } catch (_) {}
    try { await ensureSubmissionEvaluationScoreColumn(); } catch (_) {}

    const payload = {
      score: score != null ? parseInt(score) : null,
      evaluation_score: score != null ? parseInt(score) : null,
      evaluation_data: evaluation_data ? JSON.stringify(evaluation_data) : null,
    };

    if (id) {
      await updateSubmissionScoreById({
        ...payload,
        id,
      });
    } else {
      await updateSubmissionsScoreForParticipant({
        ...payload,
        participant_id,
        program_id,
      });
    }

    return NextResponse.json({ success: true, message: "Evaluation updated" });
  } catch (error) {
    console.error("Submissions PUT Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
