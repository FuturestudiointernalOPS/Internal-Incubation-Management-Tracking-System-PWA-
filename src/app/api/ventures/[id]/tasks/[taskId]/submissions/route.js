import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess, isStaffActorForVenture } from "@/lib/ventureAuth";
import { getUnmetTaskDependencies, releaseTasksBlockedBy } from "@/lib/ventures";
import {
  isGlobalRole,
  resolveVentureCode,
  getAssignmentScopes,
  hasVentureWideReach,
  isTaskInScope,
  resolveTaskContext,
} from "@/lib/ventureScope";
import {
  getVentureByCode,
  getVentureTaskById,
  listVentureTaskSubmissions,
  getNextTaskSubmissionVersion,
  insertTaskSubmission,
  setVentureTaskInProgress,
  getTaskSubmission,
  reviewTaskSubmission,
  setVentureTaskStatus,
  getMilestoneJourneyStageId,
} from "@/models/ventureWorkspace";

/**
 * Task submissions (Phase 2, D5) — founder submits work, staff review it.
 *
 * GET  /api/ventures/[id]/tasks/[taskId]/submissions
 *   → version history (any Venture-access holder: founders track status)
 * POST { action: "submit", file_url?, file_name?, file_type?, notes? }
 *   → append a new version (founders + staff)
 * POST { action: "review", submission_id, decision: approved|changes_requested, comment? }
 *   → staff review of the submission; approval is what satisfies a task
 *     configured with review_required = TRUE (completion authority).
 *
 * Append-only: every submission is a new row (version increments). Reviews
 * write on the reviewed submission; history is never overwritten.
 *
 * Assignment-scope enforcement (Vinance 3): a delegated (non-global)
 * reviewer may only review submissions whose task lies inside one of his
 * ACTIVE assignment scopes for the Venture. Global roles always pass; an
 * active lead_manager assignment is a Venture-wide pass; actors WITHOUT any
 * assignment rows keep the legacy behavior. Scope-resolution errors fail
 * CLOSED (403) so a bug can never over-grant review authority.
 */

const REVIEWER_ROLES = ["staff", "program_manager", "super_admin"];

async function resolveVentureDbId(ventureId) {
  const ventureResult = await getVentureByCode(ventureId);
  return ventureResult.rows?.[0]?.id || null;
}

async function resolveTask(taskId, ventureParam, dbId) {
  const taskResult = await getVentureTaskById(taskId);
  const task = taskResult.rows?.[0];
  if (!task) return null;
  const belongs =
    String(task.venture_id) === String(ventureParam) ||
    (dbId && String(task.venture_id) === String(dbId));
  return belongs ? task : null;
}

async function listSubmissions(taskId) {
  const queryResult = await listVentureTaskSubmissions(taskId);
  const rows = queryResult.rows || [];
  return {
    submissions: rows,
    latest: rows.length ? rows[rows.length - 1] : null,
  };
}

export const GET = createHandler(async (req, { params }) => {
  const { id, taskId } = await params;
  const { session } = await requireVentureAccess(id);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const dbId = await resolveVentureDbId(id);
  const task = await resolveTask(parseInt(taskId), id, dbId);
  if (!task) return NextResponse.json({ success: false, error: "Task not found." }, { status: 404 });
  const submissionData = await listSubmissions(task.id);
  return NextResponse.json({ success: true, ...submissionData });
});

export const POST = createHandler(async (req, { params }) => {
  const { id, taskId } = await params;
  const { session } = await requireVentureAccess(id);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const dbId = await resolveVentureDbId(id);
  const task = await resolveTask(parseInt(taskId), id, dbId);
  if (!task) return NextResponse.json({ success: false, error: "Task not found." }, { status: 404 });

  const body = await req.json();
  if (body.action === "submit") {
    // HARD dependency gate: a Venture-side actor cannot hand in work on a task
    // that a dependency still holds back. Future Studio staff plan ahead and
    // are exempt, exactly as for booking a session against a milestone.
    const staffActor = await isStaffActorForVenture(id, session);
    if (!staffActor && dbId) {
      const blockers = await getUnmetTaskDependencies({ ventureId: dbId, taskId: task.id });
      if (blockers.length > 0) {
        const names = blockers.map((blocker) => `"${blocker.title || blocker.id}"`).join(", ");
        return NextResponse.json(
          {
            success: false,
            error: `This task is blocked by ${names}, which is not completed yet.`,
            blocked_by: blockers.map((blocker) => blocker.title || blocker.id),
          },
          { status: 409 },
        );
      }
    }
    const fileUrl = body.file_url ? String(body.file_url).trim() : "";
    const notes = body.notes ? String(body.notes).trim() : "";
    if (!fileUrl && !notes) {
      return NextResponse.json({ success: false, error: "Provide a file URL and/or notes for the submission." }, { status: 400 });
    }
    const versionResult = await getNextTaskSubmissionVersion(task.id);
    const version = Number(versionResult.rows?.[0]?.next_version || 1);
    const insertResult = await insertTaskSubmission({
      taskId: task.id,
      version,
      fileUrl: fileUrl || null,
      fileName: body.file_name ? String(body.file_name).slice(0, 255) : null,
      fileType: body.file_type ? String(body.file_type).slice(0, 50) : null,
      fileSize: body.file_size ? parseInt(body.file_size) : null,
      notes: notes || null,
      submittedBy: session?.cid || null,
      submittedByName: session?.name || null,
    });
    // A submission means work is happening: move backlog/todo tasks forward.
    if (["backlog", "todo", "not_started"].includes(task.status)) {
      await setVentureTaskInProgress(task.id);
    }
    const submissionData = await listSubmissions(task.id);
    return NextResponse.json({ success: true, submission_id: insertResult.rows?.[0]?.id || null, ...submissionData });
  }

  if (body.action === "review") {
    if (!REVIEWER_ROLES.includes(session?.role)) {
      return NextResponse.json({ success: false, error: "Only Future Studio staff can review submissions." }, { status: 403 });
    }
    // Assignment-scope gate (Vinance 3): delegated reviewers are confined to
    // the tasks inside their ACTIVE assignment scopes on this Venture.
    if (session?.cid && !isGlobalRole(session.role)) {
      const code = await resolveVentureCode(id);
      const scopes = code ? await getAssignmentScopes({ code, cid: session.cid }) : null;
      let inScope = false;
      if (scopes === null) {
        inScope = false; // resolution error → fail closed, never over-grant
      } else if (scopes.length === 0) {
        inScope = true; // no assignment rows → legacy behavior unchanged
      } else if (hasVentureWideReach(scopes)) {
        inScope = true; // venture_wide or lead_manager → Venture-wide pass
      } else {
        inScope = isTaskInScope(scopes, await resolveTaskContext(task));
      }
      if (!inScope) {
        return NextResponse.json({ success: false, error: "This review is outside your assigned scope." }, { status: 403 });
      }
    }
    const submissionId = parseInt(body.submission_id);
    const decision = body.decision;
    if (!["approved", "changes_requested"].includes(decision)) {
      return NextResponse.json({ success: false, error: "Decision must be approved or changes_requested." }, { status: 400 });
    }
    const submissionResult = await getTaskSubmission(submissionId, task.id);
    const submission = submissionResult.rows?.[0];
    if (!submission) return NextResponse.json({ success: false, error: "Submission not found." }, { status: 404 });

    await reviewTaskSubmission({
      submissionId,
      decision,
      comment: body.comment ? String(body.comment) : null,
      reviewedBy: session?.cid || null,
    });
    // Approval satisfies review_required completion; changes_requested sends
    // the task back for another iteration. Statuses mirror the task review
    // vocabulary used by the tasks route.
    const taskStatus = decision === "approved" ? "accepted" : "revision_requested";
    await setVentureTaskStatus(task.id, taskStatus);
    // An approved task is done — the tasks it was blocking are freed right away.
    if (decision === "approved" && dbId) {
      await releaseTasksBlockedBy({ ventureId: dbId, blockerTaskId: task.id });
    }
    // Venture-facing notification + email (founders hear about review outcomes).
    // Entity context lets the platform inbox drill down venture → journey →
    // milestone → task (Vinance 3 Phase 1).
    try {
      const { notifyAndEmailVentureFounders } = await import("@/lib/ventureNotify");
      const approved = decision === "approved";
      let stageId = null;
      if (task.milestone_id) {
        try {
          const stageResult = await getMilestoneJourneyStageId(task.milestone_id);
          stageId = stageResult.rows?.[0]?.journey_stage_id || null;
        } catch (_) {}
      }
      await notifyAndEmailVentureFounders(db, {
        dbId,
        title: approved ? "Submission approved" : "Changes requested",
        message: `Your submission for "${task.title}" was ${approved ? "approved" : "requested changes"}.`,
        emailSubject: approved ? "Your submission was approved" : "Changes requested on your submission",
        emailLines: [
          `Your submission for the task "${task.title}" was ${approved ? "approved" : "reviewed with changes requested"}.`,
          body.comment ? `Feedback: ${body.comment}` : "",
          "Log in to ImpactOS to see the details.",
        ].filter(Boolean),
        context: {
          journey_stage_id: stageId,
          milestone_id: task.milestone_id || null,
          task_id: task.id,
        },
        templateKey: approved ? "venture.notif.submissionApproved" : "venture.notif.changesRequested",
        params: { taskTitle: task.title },
        dedupeKey: `submission-review:${submissionId}:${decision}`,
      });
    } catch (_) {}
    const submissionData = await listSubmissions(task.id);
    return NextResponse.json({ success: true, ...submissionData });
  }

  return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
});
