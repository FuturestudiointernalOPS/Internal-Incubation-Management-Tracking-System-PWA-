import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { task_id, name, url } = body;

    if (!task_id || !url) {
      return NextResponse.json(
        { success: false, error: "task_id and url are required" },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: `INSERT INTO task_resources (task_id, name, url) VALUES (?, ?, ?)`,
      args: [parseInt(task_id), name || null, url],
    });

    return NextResponse.json({
      success: true,
      id: Number(result.lastInsertRowid),
      message: "Resource added successfully",
    });
  } catch (error) {
    console.error("POST tasks/resources error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

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
  } catch (error) {
    console.error("DELETE tasks/resources error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
