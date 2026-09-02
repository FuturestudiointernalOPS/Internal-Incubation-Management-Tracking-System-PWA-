import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  getCarryoverEligibleTasks,
  getBlockersForTask,
  getTaskRowById,
  getLatestCarriedOverClone,
  createCarriedOverClone,
  migrateBlockersToTask,
  migrateCommentsToTask,
  migrateResourcesToTask,
  reparentSubtasksToTask,
  markTaskCarriedOver,
} from "@/models/taskLifecycle";

export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
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
  let user_id = searchParams.get("user_id");
  if (!staffSide.includes(session.role)) {
    if (user_id && String(user_id) !== String(session.cid)) {
      return NextResponse.json(
        { success: false, error: "You can only view your own tasks." },
        { status: 403 },
      );
    }
    user_id = user_id || session.cid;
  }
  const week_number = searchParams.get("week");
  const year = searchParams.get("year");

  const result = await getCarryoverEligibleTasks(user_id, week_number, year);
  const tasksWithBlockers = await Promise.all(
    result.rows.map(async (task) => {
      const blockerRes = await getBlockersForTask(task.id);
      return { ...task, blockers: blockerRes.rows || [] };
    }),
  );
  return NextResponse.json({ success: true, tasks: tasksWithBlockers });
});

// POST /api/tasks/carryover — shared carry-over operation (Ticket 2.4)
// Clones a task, migrates blockers/comments/resources/subtasks, marks old as carried_over
export const POST = createHandler(async (req) => {
  const body = await req.json();
  const { task_id, target_week, target_year, user_id, user_name } = body;

  if (!task_id || !target_week || !target_year) {
    return NextResponse.json(
      {
        success: false,
        error: "task_id, target_week, and target_year are required",
      },
      { status: 400 },
    );
  }

  const oldId = parseInt(task_id);

  // 1. Fetch the original task
  const origRes = await getTaskRowById(oldId);
  if (origRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Task not found" },
      { status: 404 },
    );
  }
  const orig = origRes.rows[0];

  // 2. Follow chain forward to find the LATEST clone (not the original)
  // This prevents repeatedly cloning the same original task each week.
  let taskToClone = orig;
  while (true) {
    const nextRes = await getLatestCarriedOverClone(taskToClone.id);
    if (nextRes.rows.length === 0) break;
    taskToClone = nextRes.rows[0];
  }
  const sourceTask = taskToClone;

  const sourceId = sourceTask.id;

  // 3. Clone the LATEST task in the chain — preserve ALL fields including context
  const cloneRes = await createCarriedOverClone({
    user_id,
    user_name,
    target_week,
    target_year,
    sourceId,
    sourceTask,
  });
  const newId = Number(cloneRes.rows[0]?.id ?? cloneRes.lastInsertRowid);

  // 4. Migrate blockers from the LATEST task (not the original)
  await migrateBlockersToTask(newId, sourceId);

  // 5. Migrate comments
  try {
    await migrateCommentsToTask(newId, sourceId);
  } catch (_) {
    /* table may not exist yet */
  }

  // 6. Migrate resources/attachments
  try {
    await migrateResourcesToTask(newId, sourceId);
  } catch (_) {
    /* table may not exist yet */
  }

  // 7. Re-parent subtasks from the LATEST task
  await reparentSubtasksToTask(newId, sourceId);

  // 8. Mark the LATEST task as carried_over (not the original)
  await markTaskCarriedOver(sourceId);

  return NextResponse.json({
    success: true,
    id: newId,
    oldId,
    action: "carried_over",
  });
});
