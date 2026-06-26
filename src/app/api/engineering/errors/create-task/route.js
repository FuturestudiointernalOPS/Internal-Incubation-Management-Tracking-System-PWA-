import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/engineering/errors/create-task
 *
 * Converts an Error Log into a Development Task.
 * Only accessible to super_admin and developer roles.
 */
export async function POST(request) {
  try {
    const authError = await requireAuth(["super_admin", "developer"]);
    if (authError) return authError;

    const { error_id, title, description, priority, assignee, due_date } =
      await request.json();

    if (!error_id || !title) {
      return NextResponse.json(
        { success: false, error: "error_id and title are required" },
        { status: 400 },
      );
    }

    await initDb();

    // Verify the error log exists
    const errorCheck = await db.execute({
      sql: "SELECT * FROM error_logs WHERE id = ?",
      args: [error_id],
    });

    if (errorCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Error log not found" },
        { status: 404 },
      );
    }

    const errorLog = errorCheck.rows[0];

    // Create the development task (reuse existing tasks system)
    const weekNumber = getWeekNumber(new Date());
    const year = new Date().getFullYear();

    const result = await db.execute({
      sql: `INSERT INTO tasks (user_id, user_name, title, description, status, category, priority, assigned_to, end_date, created_week, created_year, project_id)
            VALUES (?, ?, ?, ?, ?, 'development', ?, ?, ?, ?, ?, ?)`,
      args: [
        errorLog.user_id || "system",
        "Engineering Ops",
        title,
        description ||
          `Auto-created from Error Log #${error_id}: ${errorLog.message}`,
        "pending",
        priority || "medium",
        assignee || null,
        due_date || null,
        weekNumber,
        year,
        null,
      ],
    });

    const taskId = result.lastInsertRowid || result.rows?.[0]?.id;

    // Link the task back to the error log
    await db.execute({
      sql: "UPDATE error_logs SET task_id = ?, status = 'in_progress' WHERE id = ?",
      args: [taskId, error_id],
    });

    return NextResponse.json({
      success: true,
      task_id: taskId,
      message: `Development task #${taskId} created from Error Log #${error_id}`,
    });
  } catch (err) {
    console.error("[API engineering] create-task failed:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}
