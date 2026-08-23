import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

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

  // Fetch in_progress and blocked tasks — these always need carryover consideration.
  // For 'carried_over' tasks: only include them if their cloned copy has NOT been completed
  // or archived. This prevents completed carried-over tasks from re-appearing each week.
  let sql = `
    SELECT * FROM tasks
    WHERE status IN ('in_progress', 'blocked')
    UNION
    SELECT t.* FROM tasks t
    WHERE t.status = 'carried_over'
      AND NOT EXISTS (
        SELECT 1 FROM tasks clone
        WHERE clone.carried_over_from_task_id = t.id
          AND clone.status IN ('completed', 'archived')
      )
  `;
  const baseArgs = [];

  // Wrap with user/assigned_to/supervisor filters
  const filterClauses = [];
  const filterArgs = [];
  if (user_id) {
    filterClauses.push("(user_id = ? OR assigned_to = ? OR supervisor_id = ?)");
    filterArgs.push(user_id, user_id, user_id);
  }
  if (week_number) {
    filterClauses.push("created_week <= ?");
    filterArgs.push(parseInt(week_number));
  }
  if (year) {
    filterClauses.push("created_year = ?");
    filterArgs.push(parseInt(year));
  }

  if (filterClauses.length > 0) {
    sql = `SELECT * FROM (${sql}) AS eligible WHERE ${filterClauses.join(" AND ")} ORDER BY created_at DESC`;
  } else {
    sql = `SELECT * FROM (${sql}) AS eligible ORDER BY created_at DESC`;
  }

  const args = [...baseArgs, ...filterArgs];
  const result = await db.execute({ sql, args });
  const tasksWithBlockers = await Promise.all(
    result.rows.map(async (task) => {
      const blockerRes = await db.execute({
        sql: "SELECT id, title, status, severity FROM blockers WHERE task_id = ? ORDER BY created_at DESC",
        args: [task.id],
      });
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
  const origRes = await db.execute({
    sql: "SELECT * FROM tasks WHERE id = ?",
    args: [oldId],
  });
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
    const nextRes = await db.execute({
      sql: "SELECT * FROM tasks WHERE carried_over_from_task_id = ? AND status != 'archived' ORDER BY created_week DESC, id DESC LIMIT 1",
      args: [taskToClone.id],
    });
    if (nextRes.rows.length === 0) break;
    taskToClone = nextRes.rows[0];
  }
  const sourceTask = taskToClone;

  const sourceId = sourceTask.id;

  // 3. Clone the LATEST task in the chain — preserve ALL fields including context
  const cloneRes = await db.execute({
    sql: `INSERT INTO tasks
      (user_id, user_name, title, description, status, project_id, category,
       created_week, created_year, carried_over_from_task_id,
       parent_task_id, start_date, end_date, assigned_to, link, priority,
       context_type, context_id, supervisor_id, intent_id)
      VALUES (?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?,
              ?, ?, ?, ?)
      RETURNING id`,
    args: [
      user_id || sourceTask.user_id,
      user_name || sourceTask.user_name,
      sourceTask.title,
      sourceTask.description,
      sourceTask.project_id,
      sourceTask.category,
      target_week,
      target_year,
      sourceId,
      sourceTask.start_date,
      sourceTask.end_date,
      sourceTask.assigned_to || null,
      sourceTask.link || null,
      sourceTask.priority || null,
      sourceTask.context_type || "staff",
      sourceTask.context_id || null,
      sourceTask.supervisor_id || null,
      sourceTask.intent_id || null,
    ],
  });
  const newId = Number(cloneRes.rows[0]?.id ?? cloneRes.lastInsertRowid);

  // 4. Migrate blockers from the LATEST task (not the original)
  await db.execute({
    sql: "UPDATE blockers SET task_id = ? WHERE task_id = ?",
    args: [newId, sourceId],
  });

  // 5. Migrate comments
  try {
    await db.execute({
      sql: "UPDATE v2_task_comments SET task_id = ? WHERE task_id = ?",
      args: [newId, sourceId],
    });
  } catch (_) {
    /* table may not exist yet */
  }

  // 6. Migrate resources/attachments
  try {
    await db.execute({
      sql: "UPDATE task_resources SET task_id = ? WHERE task_id = ?",
      args: [newId, sourceId],
    });
  } catch (_) {
    /* table may not exist yet */
  }

  // 7. Re-parent subtasks from the LATEST task
  await db.execute({
    sql: "UPDATE tasks SET parent_task_id = ? WHERE parent_task_id = ?",
    args: [newId, sourceId],
  });

  // 8. Mark the LATEST task as carried_over (not the original)
  await db.execute({
    sql: "UPDATE tasks SET status = 'carried_over', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [sourceId],
  });

  return NextResponse.json({
    success: true,
    id: newId,
    oldId,
    action: "carried_over",
  });
});
