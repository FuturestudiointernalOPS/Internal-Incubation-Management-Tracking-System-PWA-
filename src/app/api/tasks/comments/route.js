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
  const taskRes = await getTaskAccessById(task_id);
  const t = taskRes.rows[0];
  if (!t) {
    return NextResponse.json(
      { success: false, error: "Task not found" },
      { status: 404 },
    );
  }
  const staffSide = [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
  ];
  if (
    !staffSide.includes(session.role) &&
    String(t.user_id) !== String(session.cid) &&
    String(t.assigned_to || "") !== String(session.cid) &&
    String(t.supervisor_id || "") !== String(session.cid)
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
  const taskRes = await getTaskAccessForCreate(task_id);
  const t = taskRes.rows[0];
  if (!t) {
    return NextResponse.json(
      { success: false, error: "Task not found" },
      { status: 404 },
    );
  }
  const staffSide = [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
  ];
  if (
    !staffSide.includes(session.role) &&
    String(t.user_id) !== String(session.cid) &&
    String(t.assigned_to || "") !== String(session.cid) &&
    String(t.supervisor_id || "") !== String(session.cid)
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
    const taskRes = await getTaskNotifyFieldsById(task_id);
    const task = taskRes.rows[0];
    const alreadyNotified = new Set();

    const insertNotif = async (recipientId, title, message, type) => {
      await createNotification(recipientId, title, message, type);
    };

    if (task) {
      const recipients = new Set(
        [task.user_id, task.assigned_to].filter((r) => r && r !== sender_id),
      );
      for (const recipientId of recipients) {
        alreadyNotified.add(recipientId);
        await insertNotif(
          recipientId,
          "New Comment",
          `${sender_name || "Someone"} commented on "${task.title}"`,
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
      const mentionRes = await getContactsByNames(namesArray);

      for (const mentioned of mentionRes.rows) {
        if (alreadyNotified.has(mentioned.cid)) continue;
        if (mentioned.cid === sender_id) continue;
        await insertNotif(
          mentioned.cid,
          "Mention in Comment",
          `${sender_name || "Someone"} mentioned you in a comment on "${task?.title || "a task"}"`,
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
  const user_id = searchParams.get("user_id"); // kept for backward compatibility, ignored

  if (!id) {
    return NextResponse.json(
      { success: false, error: "id is required" },
      { status: 400 },
    );
  }

  const commentRes = await getCommentSenderById(id);

  if (commentRes.rows.length > 0) {
    const comment = commentRes.rows[0];
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

  const commentRes = await getCommentSenderForEdit(id);

  if (commentRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Comment not found" },
      { status: 404 },
    );
  }

  if (String(commentRes.rows[0].sender_id) !== String(session.cid) &&
      session.role !== "super_admin") {
    return NextResponse.json(
      { success: false, error: "Only the author can edit this comment." },
      { status: 403 },
    );
  }

  await updateCommentBody(id, newBody);

  return NextResponse.json({ success: true });
});
