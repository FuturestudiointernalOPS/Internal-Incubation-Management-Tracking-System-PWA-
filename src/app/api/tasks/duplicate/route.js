import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * POST /api/tasks/duplicate
 *
 * Duplicates a task (and optionally its subtasks) with a new ID,
 * appending " (Copy)" to the title and resetting status to pending.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const { task_id } = await req.json();
    if (!task_id) {
      return NextResponse.json(
        { success: false, error: "task_id is required" },
        { status: 400 },
      );
    }

    // Fetch the source task
    const source = await db.execute({
      sql: "SELECT * FROM tasks WHERE id = ?",
      args: [parseInt(task_id)],
    });

    if (source.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 },
      );
    }

    const task = source.rows[0];
    const now = new Date();
    const created_week = getWeekNumber(now);
    const created_year = now.getFullYear();

    // Insert the duplicated task
    const result = await db.execute({
      sql: `INSERT INTO tasks
        (user_id, user_name, title, description, status, project_id, category,
         created_week, created_year, parent_task_id, start_date, end_date, assigned_to, priority, link)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
      args: [
        task.user_id,
        task.user_name || "",
        `${task.title} (Copy)`,
        task.description || null,
        "pending",
        task.project_id || null,
        task.category || null,
        created_week,
        created_year,
        null, // duplicate is never a subtask of the original parent
        task.start_date || null,
        task.end_date || null,
        task.assigned_to || null,
        task.priority || "medium",
        task.link || null,
      ],
    });

    const newTaskId = result.rows[0]?.id ?? result.lastInsertRowid;

    // Optionally copy subtasks
    const subtasks = await db.execute({
      sql: "SELECT * FROM tasks WHERE parent_task_id = ?",
      args: [parseInt(task_id)],
    });

    for (const st of subtasks.rows) {
      await db.execute({
        sql: `INSERT INTO tasks
          (user_id, user_name, title, description, status, project_id, category,
           created_week, created_year, parent_task_id, start_date, end_date, assigned_to, priority, link)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           RETURNING id`,
        args: [
          st.user_id,
          st.user_name || "",
          `${st.title} (Copy)`,
          st.description || null,
          "pending",
          st.project_id || null,
          st.category || null,
          created_week,
          created_year,
          newTaskId,
          st.start_date || null,
          st.end_date || null,
          st.assigned_to || null,
          st.priority || "medium",
          st.link || null,
        ],
      });
    }

    // Fetch the newly created task to return
    const newTask = await db.execute({
      sql: "SELECT * FROM tasks WHERE id = ?",
      args: [newTaskId],
    });

    return NextResponse.json({
      success: true,
      task: newTask.rows[0] || null,
    });
  } catch (error) {
    console.error("POST /api/tasks/duplicate error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
