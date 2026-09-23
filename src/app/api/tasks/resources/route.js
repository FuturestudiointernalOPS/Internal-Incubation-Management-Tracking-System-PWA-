import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createHandler } from "@/lib/api/createHandler";
import {
  getTaskAccessById,
  createResource,
  getResourceById,
  getTaskAccessForDelete,
  deleteResource,
} from "@/models/taskResources";

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

  const result = await createResource(
    task_id,
    name,
    url,
    type,
    file_name,
    file_size,
    session?.cid,
  );

  return NextResponse.json({
    success: true,
    id: Number(result.rows[0]?.id || result.lastInsertRowid),
    message: "Resource added successfully",
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

  const resourceResult = await getResourceById(id);
  const resource = resourceResult.rows[0];
  if (!resource) {
    return NextResponse.json(
      { success: false, error: "Resource not found." },
      { status: 404 },
    );
  }

  const taskResult = await getTaskAccessForDelete(resource.task_id);
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

  await deleteResource(id);

  return NextResponse.json({
    success: true,
    message: "Resource deleted successfully",
  });
});
