import db from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createHandler } from "@/lib/api/createHandler";

export const POST = createHandler(async (req) => {
  const session = await getSession();

  const body = await req.json();
  const { task_id, name, url, type, file_name, file_size } = body;

  if (!task_id || !url) {
    return NextResponse.json(
      { success: false, error: "task_id and url are required" },
      { status: 400 },
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
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { success: false, error: "id is required" },
      { status: 400 },
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
