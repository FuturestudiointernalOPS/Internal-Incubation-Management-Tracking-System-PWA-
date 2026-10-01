import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import {
  addTaskResource,
  removeTaskResource,
} from "@/services/tasks/resources";

/**
 * TASK RESOURCES API — controller layer.
 *
 * POST   /api/tasks/resources  { task_id, name, url, type, file_name, file_size }
 * DELETE /api/tasks/resources?id=X
 *
 * The access rule (portfolio role, or the task's owner/assignee/supervisor)
 * lives in `@/services/tasks/resources`.
 */

export const POST = createHandler(async (req) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  const body = await req.json();
  const { task_id, name, url, type, file_name, file_size } = body;

  if (!task_id || !url) {
    return NextResponse.json(
      { success: false, error: "task_id and url are required" },
      { status: 400 },
    );
  }

  const result = await addTaskResource({
    taskId: task_id,
    name,
    url,
    type,
    fileName: file_name,
    fileSize: file_size,
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

  const result = await removeTaskResource({
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
