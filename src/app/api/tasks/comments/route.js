import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import {
  listTaskComments,
  postTaskComment,
  deleteTaskComment,
  editTaskComment,
} from "@/services/tasks/comments";

/**
 * TASK COMMENTS API (Ticket 1.3 / 1.9 / 4.2 — Task Discussions) — controller
 * layer.
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
 *
 * PUT  /api/tasks/comments
 *   - Edits a comment body — only the author can edit their own comment
 *
 * The access rule, the notification fan-out and the author-only rules live in
 * `@/services/tasks/comments`. The sender identity is resolved here: it is
 * always the authenticated session user, never a client-supplied value.
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

  const result = await listTaskComments({
    taskId: task_id,
    role: session.role,
    sessionCid: session.cid,
  });
  if (result.error) {
    return NextResponse.json(
      result.body || { success: false, error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json(result.body, { status: result.status });
});

export const POST = createHandler(async (req) => {
  const body = await req.json();
  const { task_id, sender_name, body: commentBody, parent_id } = body;

  if (!task_id || !body.sender_id || !commentBody || !commentBody.trim()) {
    return NextResponse.json(
      { success: false, error: "task_id, sender_id, and body are required" },
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

  // Sender is always the authenticated session user, never a client value; the
  // display name prefers the session's name.
  const authorName = session.name || sender_name || session.cid;

  const result = await postTaskComment({
    taskId: task_id,
    senderId: session.cid,
    authorName,
    notifyName: sender_name,
    body: commentBody,
    parentId: parent_id,
    role: session.role,
    sessionCid: session.cid,
  });

  if (result.error) {
    return NextResponse.json(
      result.body || { success: false, error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json(result.body, { status: result.status });
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

  const result = await deleteTaskComment({
    id,
    role: session.role,
    sessionCid: session.cid,
  });
  if (result.error) {
    return NextResponse.json(
      result.body || { success: false, error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json(result.body, { status: result.status });
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

  const result = await editTaskComment({
    id,
    body: newBody,
    role: session.role,
    sessionCid: session.cid,
  });
  if (result.error) {
    return NextResponse.json(
      result.body || { success: false, error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json(result.body, { status: result.status });
});
