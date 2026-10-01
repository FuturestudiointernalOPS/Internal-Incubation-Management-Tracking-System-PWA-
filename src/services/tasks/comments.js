/**
 * Tasks — comment use cases (SERVICE layer).
 *
 * The domain work behind `/api/tasks/comments`: listing a task's comments,
 * posting one (with the owner/assignee + @mention notification fan-out), and
 * the author-only edit/delete rules.
 *
 * The CONTROLLER authenticates and validates; it also resolves the author
 * identity — the sender is always the session user, never a client value.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import { taskExists } from "@/models/tasks";
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
import { canAccessTask } from "./access";

/** The comments on a task the caller may see. */
export async function listTaskComments({ taskId, role, sessionCid }) {
  const taskResult = await getTaskAccessById(taskId);
  const task = taskResult.rows[0];
  if (!task) return { status: 404, error: "Task not found" };
  if (!canAccessTask({ task, role, cid: sessionCid })) {
    return { status: 403, error: "You do not have access to this task." };
  }

  const result = await getCommentsByTaskId(taskId);
  return { status: 200, body: { success: true, comments: result.rows } };
}

/**
 * Post a comment on a task.
 *
 * `authorName` is the resolved display name for the row; `notifyName` is the
 * body-supplied name used in the notification messages (matching the original
 * behaviour, where the two differ).
 */
export async function postTaskComment({
  taskId,
  senderId,
  authorName,
  notifyName,
  body,
  parentId,
  role,
  sessionCid,
}) {
  if (!(await taskExists(taskId))) {
    return { status: 404, error: "Task not found" };
  }

  const taskResult = await getTaskAccessForCreate(taskId);
  const task = taskResult.rows[0];
  if (!task) return { status: 404, error: "Task not found" };
  if (!canAccessTask({ task, role, cid: sessionCid })) {
    return { status: 403, error: "You do not have access to this task." };
  }

  const result = await createComment(taskId, senderId, authorName, body, parentId);
  const row = result.rows[0] || {};

  // Notify the task owner / assignee (minus the sender) and any @mention. The
  // fan-out fails SOFT — a notification problem must not lose the comment.
  try {
    const notifyFieldsResult = await getTaskNotifyFieldsById(taskId);
    const taskToNotify = notifyFieldsResult.rows[0];
    const alreadyNotified = new Set();

    if (taskToNotify) {
      const recipients = new Set(
        [taskToNotify.user_id, taskToNotify.assigned_to].filter(
          (recipient) => recipient && recipient !== senderId,
        ),
      );
      for (const recipientId of recipients) {
        alreadyNotified.add(recipientId);
        await createNotification(
          recipientId,
          "New Comment",
          `${notifyName || "Someone"} commented on "${taskToNotify.title}"`,
          "comment",
        );
      }
    }

    const mentionRegex = /@(\w[\w\s.-]*?\w)\b/g;
    let match;
    const mentionedNames = new Set();
    while ((match = mentionRegex.exec(body)) !== null) {
      mentionedNames.add(match[1].trim().toLowerCase());
    }

    if (mentionedNames.size > 0) {
      const mentionResult = await getContactsByNames([...mentionedNames]);
      for (const mentioned of mentionResult.rows) {
        if (alreadyNotified.has(mentioned.cid)) continue;
        if (mentioned.cid === senderId) continue;
        await createNotification(
          mentioned.cid,
          "Mention in Comment",
          `${notifyName || "Someone"} mentioned you in a comment on "${taskToNotify?.title || "a task"}"`,
          "mention",
        );
      }
    }
  } catch {
    /* notification failure is non-fatal */
  }

  return {
    status: 200,
    body: { success: true, id: Number(row.id), created_at: row.created_at },
  };
}

/** Delete a comment — only its author (or Super Admin) may. */
export async function deleteTaskComment({ id, role, sessionCid }) {
  const commentResult = await getCommentSenderById(id);

  if (commentResult.rows.length > 0) {
    const comment = commentResult.rows[0];
    if (
      String(comment.sender_id) !== String(sessionCid) &&
      role !== "super_admin"
    ) {
      return { status: 403, error: "Only the author can delete this comment." };
    }
    await deleteComment(id);
  }

  return { status: 200, body: { success: true } };
}

/** Edit a comment's body — only its author (or Super Admin) may. */
export async function editTaskComment({ id, body, role, sessionCid }) {
  const commentResult = await getCommentSenderForEdit(id);

  if (commentResult.rows.length === 0) {
    return { status: 404, error: "Comment not found" };
  }

  if (
    String(commentResult.rows[0].sender_id) !== String(sessionCid) &&
    role !== "super_admin"
  ) {
    return { status: 403, error: "Only the author can edit this comment." };
  }

  await updateCommentBody(id, body);
  return { status: 200, body: { success: true } };
}
