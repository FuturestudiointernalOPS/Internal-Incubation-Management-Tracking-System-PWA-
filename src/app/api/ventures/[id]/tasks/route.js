import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { getSession } from "@/lib/auth";
import {
  listTasks, getTask, createTask, updateTask, deleteTask,
  listTaskComments, addTaskComment, deleteTaskComment,
  listTaskAttachments, addTaskAttachment, deleteTaskAttachment,
} from "@/lib/ventures";
import db from "@/lib/db";

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

/**
 * GET /api/ventures/[id]/tasks?milestone_id=X&status=X&assigned_cid=X
 * POST /api/ventures/[id]/tasks — create task
 * PATCH /api/ventures/[id]/tasks?id=X — update task (also supports comments/attachments via actions)
 * DELETE /api/ventures/[id]/tasks?id=X — delete task
 */
export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const dbId = await resolveVentureDbId(id);
  if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
  const s = new URL(req.url).searchParams;
  const tasks = await listTasks(dbId, s.get("milestone_id"), s.get("status"), s.get("assigned_cid"));

  // Group by status for Kanban
  const byStatus = {};
  for (const status of ["backlog", "todo", "in_progress", "review", "done", "blocked", "cancelled"]) {
    byStatus[status] = tasks.filter((t) => t.status === status);
  }

  return NextResponse.json({ success: true, tasks, by_status: byStatus });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const dbId = await resolveVentureDbId(id);
  if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
  const body = await req.json();
  if (!body.title?.trim()) return NextResponse.json({ success: false, error: "Task title is required." }, { status: 400 });

  const result = await createTask({
    ventureId: dbId, milestoneId: body.milestone_id, title: body.title, description: body.description,
    priority: body.priority, dueDate: body.due_date, estimatedHours: body.estimated_hours,
    assignedCid: body.assigned_cid, assignedName: body.assigned_name,
    reporterCid: req.session?.cid, reporterName: req.session?.name, labels: body.labels,
    parentTaskId: body.parent_task_id,
  });
  const task = await getTask(result.id);
  return NextResponse.json({ success: true, task });
});

export const PATCH = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const s = new URL(req.url).searchParams;
  const taskId = s.get("id");
  const action = s.get("action");
  const body = await req.json();

  if (!taskId) return NextResponse.json({ success: false, error: "Task ID required." }, { status: 400 });

  // Handle comments
  if (action === "add_comment") {
    const result = await addTaskComment({ taskId: parseInt(taskId), parentId: body.parent_id, authorCid: session?.cid, authorName: session?.name, body: body.body });
    return NextResponse.json({ success: true, comment_id: result.id });
  }
  if (action === "delete_comment") {
    await deleteTaskComment(parseInt(body.comment_id));
    return NextResponse.json({ success: true });
  }
  if (action === "get_comments") {
    const comments = await listTaskComments(parseInt(taskId));
    return NextResponse.json({ success: true, comments });
  }

  // Handle attachments
  if (action === "add_attachment") {
    const result = await addTaskAttachment({ taskId: parseInt(taskId), fileName: body.file_name, fileSize: body.file_size, fileType: body.file_type, fileUrl: body.file_url, uploadedBy: session?.cid });
    return NextResponse.json({ success: true, attachment_id: result.id });
  }
  if (action === "delete_attachment") {
    await deleteTaskAttachment(parseInt(body.attachment_id));
    return NextResponse.json({ success: true });
  }
  if (action === "get_attachments") {
    const attachments = await listTaskAttachments(parseInt(taskId));
    return NextResponse.json({ success: true, attachments });
  }

  // Handle task reviews (Phase 5 — Future Studio staff accept/reject/revision)
  if (action === "add_review") {
    const reviewerRoles = ["staff", "program_manager", "super_admin", "developer", "teacher"];
    if (!reviewerRoles.includes(session?.role)) {
      return NextResponse.json({ success: false, error: "Only Future Studio staff can review tasks." }, { status: 403 });
    }
    const { decision, comments } = body;
    if (!["accepted", "rejected", "revision_requested"].includes(decision)) {
      return NextResponse.json({ success: false, error: "Decision must be accepted, rejected or revision_requested." }, { status: 400 });
    }
    if (!(await getTask(parseInt(taskId)))) {
      return NextResponse.json({ success: false, error: "Task not found." }, { status: 404 });
    }
    await db.execute({
      sql: `INSERT INTO venture_task_reviews (task_id, reviewer_cid, reviewer_name, decision, comments, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())`,
      args: [parseInt(taskId), session?.cid || null, session?.name || null, decision, comments || null],
    });
    await updateTask(parseInt(taskId), { status: decision });
    return NextResponse.json({ success: true });
  }

  // Default: update task fields
  if (!(await getTask(parseInt(taskId)))) return NextResponse.json({ success: false, error: "Task not found." }, { status: 404 });
  await updateTask(parseInt(taskId), body);
  const task = await getTask(parseInt(taskId));
  return NextResponse.json({ success: true, task });
});

export const DELETE = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const taskId = new URL(req.url).searchParams.get("id");
  if (!taskId) return NextResponse.json({ success: false, error: "Task ID required." }, { status: 400 });
  await deleteTask(parseInt(taskId));
  return NextResponse.json({ success: true });
});
