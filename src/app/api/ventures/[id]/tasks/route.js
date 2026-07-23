import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import {
  listTasks, getTask, createTask, updateTask, deleteTask,
  listTaskComments, addTaskComment, deleteTaskComment,
  listTaskAttachments, addTaskAttachment, deleteTaskAttachment,
} from "@/lib/ventures";

/**
 * GET /api/ventures/[id]/tasks?milestone_id=X&status=X&assigned_cid=X
 * POST /api/ventures/[id]/tasks — create task
 * PATCH /api/ventures/[id]/tasks?id=X — update task (also supports comments/attachments via actions)
 * DELETE /api/ventures/[id]/tasks?id=X — delete task
 */
export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const s = new URL(req.url).searchParams;
  const tasks = await listTasks(id, s.get("milestone_id"), s.get("status"), s.get("assigned_cid"));

  // Group by status for Kanban
  const byStatus = {};
  for (const status of ["backlog", "todo", "in_progress", "review", "done", "blocked", "cancelled"]) {
    byStatus[status] = tasks.filter((t) => t.status === status);
  }

  return NextResponse.json({ success: true, tasks, by_status: byStatus });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  if (!body.title?.trim()) return NextResponse.json({ success: false, error: "Task title is required." }, { status: 400 });

  const result = await createTask({
    ventureId: id, milestoneId: body.milestone_id, title: body.title, description: body.description,
    priority: body.priority, dueDate: body.due_date, estimatedHours: body.estimated_hours,
    assignedCid: body.assigned_cid, assignedName: body.assigned_name,
    reporterCid: req.session?.cid, reporterName: req.session?.name, labels: body.labels,
  });
  const task = await getTask(result.id);
  return NextResponse.json({ success: true, task });
});

export const PATCH = createHandler(async (req, { params }) => {
  const s = new URL(req.url).searchParams;
  const taskId = s.get("id");
  const action = s.get("action");
  const body = await req.json();
  const session = req.session;

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

  // Default: update task fields
  if (!(await getTask(parseInt(taskId)))) return NextResponse.json({ success: false, error: "Task not found." }, { status: 404 });
  await updateTask(parseInt(taskId), body);
  const task = await getTask(parseInt(taskId));
  return NextResponse.json({ success: true, task });
});

export const DELETE = createHandler(async (req, { params }) => {
  const taskId = new URL(req.url).searchParams.get("id");
  if (!taskId) return NextResponse.json({ success: false, error: "Task ID required." }, { status: 400 });
  await deleteTask(parseInt(taskId));
  return NextResponse.json({ success: true });
});
