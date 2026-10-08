import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { getMilestone } from "@/services/ventures/deliverables";
import { listTasks, getTask, createTask, updateTask, listTaskComments, addTaskComment, deleteTaskComment, listTaskAttachments, addTaskAttachment, deleteTaskAttachment, setTaskDependencies, syncTaskBlockState, releaseTasksBlockedBy, listVentureTaskDependencyEdges } from "@/services/ventures/tasks";
import { archiveTask } from "@/services/ventures/archive";
import { ventureOwned, ventureNotFound } from "@/lib/ventureOwnership";
import {
  getVentureDbIdForTasks,
  insertVentureTaskReview,
} from "@/models/ventureWorkspace";
import {
  buildTaskBoard,
  checkTaskStatusChange,
  afterTaskUpdate,
  syncMilestoneForTask,
} from "@/services/ventures/taskBoard";

async function resolveVentureDbId(ventureId) {
  const ventureResult = await getVentureDbIdForTasks(ventureId);
  return ventureResult.rows?.[0]?.id || null;
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

  // Columns, archived filter and dependency decoration: services/ventures/taskBoard.
  const includeArchived = searchParams.get("include_archived") === "1";
  const edges = await listVentureTaskDependencyEdges(dbId);
  const { tasks: decorated, byStatus } = buildTaskBoard(tasks, edges, includeArchived);

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

  // Dependency gate, then completion authority: services/ventures/taskBoard.
  const refused = await checkTaskStatusChange({
    id, dbId, session, existingTask, taskId, numericTaskId, status: body.status,
  });
  if (refused) {
    const { status, ...payload } = refused;
    return NextResponse.json({ success: false, ...payload }, { status });
  }
  await updateTask(parseInt(taskId), body);

  // Blocked tasks released, block state synced, milestone follows a status
  // change: services/ventures/taskBoard.
  const milestone = await afterTaskUpdate({ id, dbId, session, existingTask, numericTaskId, body });

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
  const archiveResult = await archiveTask({ taskId, actorCid: session.cid || null });
  if (archiveResult?.error) {
    return NextResponse.json({ success: false, error: archiveResult.error }, { status: 409 });
  }
  return NextResponse.json({ success: true, archived: true });
});
