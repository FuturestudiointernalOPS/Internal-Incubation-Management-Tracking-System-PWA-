import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getTaskById } from "@/lib/db/queries/tasks";
import {
  createTaskCopy,
  getSubtasksByParentId,
  createSubtaskCopy,
} from "@/models/taskLifecycle";

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
    const task = await getTaskById(task_id);

    if (!task) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 },
      );
    }

    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
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
      String(task.user_id) !== String(session.cid) &&
      String(task.assigned_to || "") !== String(session.cid) &&
      String(task.supervisor_id || "") !== String(session.cid)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You do not have permission to duplicate this task.",
        },
        { status: 403 },
      );
    }

    const now = new Date();
    const created_week = getWeekNumber(now);
    const created_year = now.getFullYear();

    // Insert the duplicated task
    const result = await createTaskCopy(task, created_week, created_year);

    const newTaskId = result.rows[0]?.id ?? result.lastInsertRowid;

    // Optionally copy subtasks
    const subtasks = await getSubtasksByParentId(task_id);

    for (const st of subtasks.rows) {
      await createSubtaskCopy(st, created_week, created_year, newTaskId);
    }

    // Fetch the newly created task to return
    const newTask = await getTaskById(newTaskId);

    return NextResponse.json({
      success: true,
      task: newTask || null,
    });
  } catch (error) {
    console.error("POST /api/tasks/duplicate error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
