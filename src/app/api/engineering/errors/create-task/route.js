import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import {
  createDevelopmentTaskFromErrorLog,
  getErrorLogById,
  linkErrorLogToTask,
} from "@/models/engineering";

/**
 * POST /api/engineering/errors/create-task
 *
 * Converts an Error Log into a Development Task.
 * Only accessible to super_admin and developer roles.
 */
export async function POST(request) {
  try {
    const capError = await requireAuthorization("engineering", "manage_errors");
    if (capError) return capError;

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
    const errorCheck = await getErrorLogById(error_id);

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

    const result = await createDevelopmentTaskFromErrorLog({
      errorLogUserId: errorLog.user_id,
      errorLogMessage: errorLog.message,
      error_id,
      title,
      description,
      priority,
      assignee,
      due_date,
      weekNumber,
      year,
    });

    const taskId = result.rows[0]?.id ?? result.lastInsertRowid;

    // Link the task back to the error log
    await linkErrorLogToTask(taskId, error_id);

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
