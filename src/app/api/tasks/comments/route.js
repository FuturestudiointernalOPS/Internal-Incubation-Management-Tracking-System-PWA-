import { NextResponse } from "next/server";
import { taskExists } from "@/lib/db/queries/tasks";
import {
  getTaskAccessById,
  getCommentsByTaskId,
  getTaskAccessForCreate,
  createComment,
  getTaskNotifyFieldsById,
  createNotification,
  getContactsByNames,
  getCommentSenderById,
  deleteComment,
  getCommentSenderForEdit,
  updateCommentBody,
} from "@/models/taskComments";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";

/**
 * TASK COMMENTS API (Ticket 1.3 / 1.9 / 4.2 — Task Discussions)
 *
 * GET  /api/tasks/comments?task_id=X
 *   - Returns all comments for a task (or subtask), oldest first
 *
 * POST /api/tasks/comments
 *   - Creates a new comment on a task (or subtask)
 *   - Body: { task_id, sender_id, sender_name, body, parent_id? }
 *
 * DELETE /api/tasks/comments?id=X&user_id=Y
 *   - Deletes a comment — only the author can delete their own comment
 */

export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const task_id = searchParams.get("task_id");

  if (!task_id) {
    return NextResponse.json(
      { success: false, error: "task_id is required" },
      { status: 400 },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }
  const taskResult = await getTaskAccessById(task_id);
  const task = taskResult.rows[0];
  if (!task) {
    return NextResponse.json(
      { success: false, error: "Task not found" },
      { status: 404 },
    );
  }
  const staffSide = [
    "super_admin",
    "staff",
    "program_manager",
  ];
  if (
    !staffSide.includes(session.role) &&
    String(task.user_id) !== String(session.cid) &&
    String(task.assigned_to || "") !== String(session.cid) &&
    String(task.supervisor_id || "") !== String(session.cid)
  ) {
    return NextResponse.json(
      { success: false, error: "You do not have access to this task." },
      { status: 403 },
    );
  }

  const result = await getCommentsByTaskId(task_id);

  return NextResponse.json({ success: true, comments: result.rows });
});

export const POST = createHandler(async (req) => {
  const body = await req.json();
  let { sender_id } = body;
  const {
    task_id,
    sender_name,
    body: commentBody,
    parent_id,
  } = body;

  if (!task_id || !sender_id || !commentBody || !commentBody.trim()) {
    return NextResponse.json(
      { success: false, error: "task_id, sender_id, and body are required" },
      { status: 400 },
    );
  }

  if (!(await taskExists(task_id))) {
    return NextResponse.json(
      { success: false, error: "Task not found" },
      { status: 404 },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }
  const taskResult = await getTaskAccessForCreate(task_id);
  const task = taskResult.rows[0];
  if (!task) {
    return NextResponse.json(
      { success: false, error: "Task not found" },
      { status: 404 },
    );
  }
  const staffSide = [
    "super_admin",
    "staff",
    "program_manager",
  ];
  if (
    !staffSide.includes(session.role) &&
    String(task.user_id) !== String(session.cid) &&
    String(task.assigned_to || "") !== String(session.cid) &&
    String(task.supervisor_id || "") !== String(session.cid)
  ) {
    return NextResponse.json(
      { success: false, error: "You do not have access to this task." },
      { status: 403 },
    );
  }
  // Sender is always the authenticated session user, not a client-supplied value
  sender_id = session.cid;

  const result = await createComment(
    task_id,
    sender_id,
    sender_name,
    commentBody,
    parent_id,
  );

  const row = result.rows[0] || {};

  // Notify the task owner / assignee if someone else commented
  try {
    const notifyFieldsResult = await getTaskNotifyFieldsById(task_id);
    const taskToNotify = notifyFieldsResult.rows[0];
    const alreadyNotified = new Set();

    const insertNotification = async (recipientId, title, message, type) => {
      await createNotification(recipientId, title, message, type);
    };

    if (taskToNotify) {
      const recipients = new Set(
        [taskToNotify.user_id, taskToNotify.assigned_to].filter((recipient) => recipient && recipient !== sender_id),
      );
      for (const recipientId of recipients) {
        alreadyNotified.add(recipientId);
        await insertNotification(
          recipientId,
          "New Comment",
          `${sender_name || "Someone"} commented on "${taskToNotify.title}"`,
          "comment",
        );
      }
    }

    const mentionRegex = /@(\w[\w\s.-]*?\w)\b/g;
    let match;
    const mentionedNames = new Set();
    while ((match = mentionRegex.exec(commentBody)) !== null) {
      mentionedNames.add(match[1].trim().toLowerCase());
    }

    if (mentionedNames.size > 0) {
      const namesArray = [...mentionedNames];
      const mentionResult = await getContactsByNames(namesArray);

      for (const mentioned of mentionResult.rows) {
        if (alreadyNotified.has(mentioned.cid)) continue;
        if (mentioned.cid === sender_id) continue;
        await insertNotification(
          mentioned.cid,
          "Mention in Comment",
          `${sender_name || "Someone"} mentioned you in a comment on "${taskToNotify?.title || "a task"}"`,
          "mention",
        );
      }
    }
  } catch (_) {}

  return NextResponse.json({
    success: true,
    id: Number(row.id),
    created_at: row.created_at,
  });
});

export const DELETE = createHandler(async (req) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { success: false, error: "id is required" },
      { status: 400 },
    );
  }

  const commentResult = await getCommentSenderById(id);

  if (commentResult.rows.length > 0) {
    const comment = commentResult.rows[0];
    if (
      String(comment.sender_id) !== String(session.cid) &&
      session.role !== "super_admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Only the author can delete this comment.",
        },
        { status: 403 },
      );
    }
    await deleteComment(id);
  }

  return NextResponse.json({ success: true });
});

export const PUT = createHandler(async (req) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }
  const body = await req.json();
  const { id, user_id, body: newBody } = body;

  if (!id || !user_id || !newBody || !newBody.trim()) {
    return NextResponse.json(
      { success: false, error: "id, user_id, and body are required" },
      { status: 400 },
    );
  }

  const commentResult = await getCommentSenderForEdit(id);

  if (commentResult.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Comment not found" },
      { status: 404 },
    );
  }

  if (String(commentResult.rows[0].sender_id) !== String(session.cid) &&
      session.role !== "super_admin") {
    return NextResponse.json(
      { success: false, error: "Only the author can edit this comment." },
      { status: 403 },
    );
  }

  await updateCommentBody(id, newBody);

  return NextResponse.json({ success: true });
});
