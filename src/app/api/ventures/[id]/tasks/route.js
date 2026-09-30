import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import {
  listTasks, getTask, getMilestone, createTask, updateTask,
  listTaskComments, addTaskComment, deleteTaskComment,
  listTaskAttachments, addTaskAttachment, deleteTaskAttachment,
  getUnmetTaskDependencies, setTaskDependencies, syncTaskBlockState,
  releaseTasksBlockedBy, listVentureTaskDependencyEdges,
} from "@/lib/ventures";
import { archiveTask } from "@/lib/ventureArchive";
import { TASK_BOARD_COLUMNS, TASK_REVIEW_GATED_COMPLETION_STATUSES, isTaskComplete, TASK_COMPLETED_STATUSES } from "@/lib/ventureStatuses";
import { isStaffActorForVenture } from "@/lib/ventureAuth";
import { canManageMilestones, syncMilestoneFromWork } from "@/lib/ventureMilestoneEngine";
import { ventureOwned, ventureNotFound } from "@/lib/ventureOwnership";
import db from "@/lib/db";
import {
  getVentureDbIdForTasks,
  insertVentureTaskReview,
} from "@/models/ventureWorkspace";

/**
 * A task may not move INTO one of these while a dependency it declares is
 * unmet. `backlog`/`todo`/`blocked`/`cancelled` are not progress, so they are
 * always allowed (a task can be parked, and it can be marked blocked by hand).
 */
const TASK_PROCEED_STATUSES = ["in_progress", "review", ...TASK_COMPLETED_STATUSES];

async function resolveVentureDbId(ventureId) {
  const ventureResult = await getVentureDbIdForTasks(ventureId);
  return ventureResult.rows?.[0]?.id || null;
}

/**
 * After a task's STATUS changes, the milestone it sits under follows — through
 * the same sync the deliverable route runs, so the work and the evidence can
 * never give a milestone two different answers.
 *
 * Only a status change calls this: renaming a task, moving its dates or
 * reassigning it is not progress. Completion authority is resolved once, here,
 * because it is the authority — not the tasks — that decides whether finished
 * work may close a milestone.
 */
async function syncMilestoneForTask(task, { id, dbId, session }) {
  if (!task?.milestone_id) return { changed: false, status: null };
  const canComplete = await canManageMilestones(db, { id, cid: session?.cid, role: session?.role });
  return syncMilestoneFromWork(db, {
    dbId,
    milestoneId: String(task.milestone_id),
    cid: session?.cid || null,
    canComplete,
  });
}

/**
 * GET /api/ventures/[id]/tasks?milestone_id=X&status=X&assigned_cid=X
 * POST /api/ventures/[id]/tasks — create task
 * PATCH /api/ventures/[id]/tasks?id=X — update task (also supports comments/attachments via actions)
 * DELETE /api/ventures/[id]/tasks?id=X — delete task
 */
export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) return access.error;
  const dbId = await resolveVentureDbId(id);
  if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
  const searchParams = new URL(req.url).searchParams;
  const tasks = await listTasks(dbId, searchParams.get("milestone_id"), searchParams.get("status"), searchParams.get("assigned_cid"));

  // Archived (soft-deleted) tasks stay in the database (history is kept) but
  // are hidden from default lists. Row-level filter: environments whose
  // schema predates the is_archived column keep working (field is undefined).
  const includeArchived = searchParams.get("include_archived") === "1";
  const visibleTasks = tasks.filter((task) => includeArchived || task.is_archived !== true);

  // Group by status for Kanban (column vocabulary from lib/ventureStatuses)
  const byStatus = {};
  for (const status of TASK_BOARD_COLUMNS) {
    byStatus[status] = [];
  }

  // Dependency edges, applied in one pass: each task carries the ids it is
  // blocked by, the ids it blocks, and whether a declared dependency is still
  // unmet. One read for the whole board, never one per task.
  const edges = await listVentureTaskDependencyEdges(dbId);
  const statusById = new Map(visibleTasks.map((task) => [String(task.id), task.status]));
  const titleById = new Map(visibleTasks.map((task) => [String(task.id), task.title]));
  const blockedBy = new Map();
  const blocks = new Map();
  const push = (map, key, value) => {
    const list = map.get(key) || [];
    list.push(value);
    map.set(key, list);
  };
  for (const edge of edges) {
    push(blockedBy, edge.target_id, edge.source_id);
    push(blocks, edge.source_id, edge.target_id);
  }

  const decorated = visibleTasks.map((task) => {
    const blockedByIds = blockedBy.get(String(task.id)) || [];
    const unmetIds = blockedByIds.filter((id) => {
      const status = statusById.get(id);
      return status === undefined ? true : !isTaskComplete(status);
    });
    const decoratedTask = {
      ...task,
      blocked_by_ids: blockedByIds,
      blocks_ids: blocks.get(String(task.id)) || [],
      dependency_blocked: unmetIds.length > 0,
      blocked_by_titles: unmetIds.map((id) => titleById.get(id)).filter(Boolean),
    };
    if (byStatus[decoratedTask.status]) byStatus[decoratedTask.status].push(decoratedTask);
    return decoratedTask;
  });

  return NextResponse.json({ success: true, tasks: decorated, by_status: byStatus });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const dbId = await resolveVentureDbId(id);
  if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
  const body = await req.json();
  if (!body.title?.trim()) return NextResponse.json({ success: false, error: "Task title is required." }, { status: 400 });

  // A task may only be attached to a milestone OF THIS venture.
  if (body.milestone_id) {
    const milestone = await getMilestone(parseInt(body.milestone_id));
    if (!ventureOwned(milestone, dbId, id)) return ventureNotFound();
  }

  const result = await createTask({
    ventureId: dbId, milestoneId: body.milestone_id, title: body.title, description: body.description,
    priority: body.priority, startDate: body.start_date, dueDate: body.due_date, estimatedHours: body.estimated_hours,
    assignedCid: body.assigned_cid, assignedName: body.assigned_name,
    reporterCid: req.session?.cid, reporterName: req.session?.name, labels: body.labels,
    parentTaskId: body.parent_task_id,
  });
  const createdId = Number.parseInt(String(result.id), 10);

  // Dependencies declared at creation. A brand-new task cannot close a loop
  // (nothing points at it yet), so this can only fail on a database error —
  // which is reported without losing the task that was just created.
  let warning = null;
  if (Array.isArray(body.blocked_by) && Number.isFinite(createdId)) {
    try {
      await setTaskDependencies({ ventureId: dbId, taskId: createdId, blockedByTaskIds: body.blocked_by });
      await syncTaskBlockState({ ventureId: dbId, taskId: createdId });
    } catch (_) {
      warning = "The task was created, but its dependencies could not be saved.";
    }
  }

  const task = await getTask(createdId);
  return NextResponse.json({ success: true, task, warning });
});

export const PATCH = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const { session } = access;
  const dbId = await resolveVentureDbId(id);
  if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
  const searchParams = new URL(req.url).searchParams;
  const taskId = searchParams.get("id");
  const action = searchParams.get("action");
  const body = await req.json();

  if (!taskId) return NextResponse.json({ success: false, error: "Task ID required." }, { status: 400 });

  // Object-level authorization: every id below comes from the request, so the
  // target task must be proven to belong to the venture in the URL — otherwise
  // an editor of one venture could touch another venture's tasks.
  const taskInVenture = async () => {
    const task = await getTask(parseInt(taskId));
    return ventureOwned(task, dbId, id) ? task : null;
  };

  // Handle comments
  if (action === "add_comment") {
    if (!(await taskInVenture())) return ventureNotFound();
    const result = await addTaskComment({ taskId: parseInt(taskId), parentId: body.parent_id, authorCid: session?.cid, authorName: session?.name, body: body.body });
    return NextResponse.json({ success: true, comment_id: result.id });
  }
  if (action === "delete_comment") {
    await deleteTaskComment(parseInt(body.comment_id), dbId);
    return NextResponse.json({ success: true });
  }
  if (action === "get_comments") {
    if (!(await taskInVenture())) return ventureNotFound();
    const comments = await listTaskComments(parseInt(taskId));
    return NextResponse.json({ success: true, comments });
  }

  // Handle attachments
  if (action === "add_attachment") {
    if (!(await taskInVenture())) return ventureNotFound();
    const result = await addTaskAttachment({ taskId: parseInt(taskId), fileName: body.file_name, fileSize: body.file_size, fileType: body.file_type, fileUrl: body.file_url, uploadedBy: session?.cid });
    return NextResponse.json({ success: true, attachment_id: result.id });
  }
  if (action === "delete_attachment") {
    await deleteTaskAttachment(parseInt(body.attachment_id), dbId);
    return NextResponse.json({ success: true });
  }
  if (action === "get_attachments") {
    if (!(await taskInVenture())) return ventureNotFound();
    const attachments = await listTaskAttachments(parseInt(taskId));
    return NextResponse.json({ success: true, attachments });
  }

  // Handle task reviews (Phase 5 — Future Studio staff accept/reject/revision)
  if (action === "add_review") {
    const reviewerRoles = ["staff", "program_manager", "super_admin"];
    if (!reviewerRoles.includes(session?.role)) {
      return NextResponse.json({ success: false, error: "Only Future Studio staff can review tasks." }, { status: 403 });
    }
    const { decision, comments } = body;
    if (!["accepted", "rejected", "revision_requested"].includes(decision)) {
      return NextResponse.json({ success: false, error: "Decision must be accepted, rejected or revision_requested." }, { status: 400 });
    }
    const reviewedTask = await taskInVenture();
    if (!reviewedTask) return ventureNotFound();
    await insertVentureTaskReview({ task_id: taskId, reviewer_cid: session?.cid, reviewer_name: session?.name, decision, comments });
    await updateTask(parseInt(taskId), { status: decision });
    // An accepted task is done — the tasks it was blocking are freed right away.
    if (decision === "accepted") {
      await releaseTasksBlockedBy({ ventureId: dbId, blockerTaskId: parseInt(taskId) });
    }
    // The milestone follows the work: an accepted task is finished work.
    const reviewMilestone = await syncMilestoneForTask(reviewedTask, { id, dbId, session });
    return NextResponse.json({ success: true, milestone: reviewMilestone });
  }

  // Default: update task fields — completion authority (D5). When a task is
  // configured with review_required, founders cannot complete it without an
  // approved submission; only the review flow marks it complete.
  const existingTask = await getTask(parseInt(taskId));
  if (!ventureOwned(existingTask, dbId, id)) return ventureNotFound();
  const numericTaskId = Number.parseInt(taskId, 10);

  // Dependency editing: replace the task's blockers with exactly this set. A
  // loop is refused AS A WHOLE — nothing is written when the request is bad.
  if (body.blocked_by !== undefined) {
    if (!Array.isArray(body.blocked_by)) {
      return NextResponse.json({ success: false, error: "blocked_by must be a list of task ids." }, { status: 400 });
    }
    try {
      await setTaskDependencies({ ventureId: dbId, taskId: numericTaskId, blockedByTaskIds: body.blocked_by });
    } catch (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
  }

  // HARD dependency gate: a Venture-side actor may not move a task into real
  // progress while a dependency it declares is unmet. Future Studio staff plan
  // ahead and are exempt (the same rule as booking a session against a
  // milestone), so the block bites where it should: on the Venture's own work.
  if (body.status !== undefined && TASK_PROCEED_STATUSES.includes(body.status)) {
    const staffActor = await isStaffActorForVenture(db, id, session);
    if (!staffActor) {
      const blockers = await getUnmetTaskDependencies({ ventureId: dbId, taskId: numericTaskId });
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
  }

  if (body.status && TASK_REVIEW_GATED_COMPLETION_STATUSES.includes(body.status) && existingTask.review_required) {
    const submissionResult = await db.execute({
      sql: "SELECT 1 FROM venture_task_submissions WHERE task_id = ? AND review_decision = 'approved' ORDER BY version DESC LIMIT 1",
      args: [parseInt(taskId)],
    }).catch(() => ({ rows: [] }));
    if (!(submissionResult.rows || []).length) {
      return NextResponse.json({ success: false, error: "This task requires an approved submission before it can be completed." }, { status: 403 });
    }
  }
  await updateTask(parseInt(taskId), body);

  // A completed task frees the tasks it was holding back, right away.
  if (body.status !== undefined && isTaskComplete(body.status)) {
    await releaseTasksBlockedBy({ ventureId: dbId, blockerTaskId: numericTaskId });
  }
  // Keep this task's own `blocked` state true to the dependencies just set.
  if (body.blocked_by !== undefined) {
    await syncTaskBlockState({ ventureId: dbId, taskId: numericTaskId });
  }

  // The milestone follows a STATUS change — and nothing else. This is the
  // "execution half" of the milestone: the work is visible to the outcome it
  // serves, while closing that outcome stays with the completion authority.
  let milestone = null;
  if (body.status !== undefined) {
    milestone = await syncMilestoneForTask(existingTask, { id, dbId, session });
  }

  const task = await getTask(parseInt(taskId));
  return NextResponse.json({ success: true, task, milestone });
});

export const DELETE = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const { session } = access;
  const dbId = await resolveVentureDbId(id);
  if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
  const taskId = new URL(req.url).searchParams.get("id");
  if (!taskId) return NextResponse.json({ success: false, error: "Task ID required." }, { status: 400 });

  // Object-level authorization: only a task of THIS venture may be archived.
  const task = await getTask(parseInt(taskId));
  if (!ventureOwned(task, dbId, id)) return ventureNotFound();

  // Soft delete (archive): a task that already has filed work (submissions or
  // reviews) is part of the Venture's record and can never be removed.
  const archiveResult = await archiveTask(db, { taskId, actorCid: session.cid || null });
  if (archiveResult?.error) {
    return NextResponse.json({ success: false, error: archiveResult.error }, { status: 409 });
  }
  return NextResponse.json({ success: true, archived: true });
});
