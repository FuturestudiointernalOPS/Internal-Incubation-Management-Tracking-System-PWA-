import db from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createHandler } from "@/lib/api/createHandler";

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

  const taskRes = await db.execute({
    sql: "SELECT user_id, assigned_to, supervisor_id FROM tasks WHERE id = ?",
    args: [parseInt(task_id)],
  });
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

  const result = await db.execute({
    sql: `INSERT INTO task_resources (task_id, name, url, type, file_name, file_size, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      parseInt(task_id),
      name || null,
      url,
      type || "url",
      file_name || null,
      file_size || null,
      session?.cid || null,
    ],
  });

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

  const resourceRes = await db.execute({
    sql: "SELECT task_id FROM task_resources WHERE id = ?",
    args: [parseInt(id)],
  });
  const resource = resourceRes.rows[0];
  if (!resource) {
    return NextResponse.json(
      { success: false, error: "Resource not found." },
      { status: 404 },
    );
  }

  const taskRes = await db.execute({
    sql: "SELECT user_id, assigned_to, supervisor_id FROM tasks WHERE id = ?",
    args: [parseInt(resource.task_id)],
  });
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

  await db.execute({
    sql: `DELETE FROM task_resources WHERE id = ?`,
    args: [parseInt(id)],
  });

  return NextResponse.json({
    success: true,
    message: "Resource deleted successfully",
  });
});
