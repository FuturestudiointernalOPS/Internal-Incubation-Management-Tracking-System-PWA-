import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");
  const week_number = searchParams.get("week");
  const year = searchParams.get("year");

  let sql =
    "SELECT * FROM tasks WHERE status IN ('carried_over', 'in_progress', 'blocked')";
  const args = [];
  if (user_id) {
    sql += " AND user_id = ?";
    args.push(user_id);
  }
  if (week_number) {
    sql += " AND created_week <= ?";
    args.push(parseInt(week_number));
  }
  if (year) {
    sql += " AND created_year = ?";
    args.push(parseInt(year));
  }
  sql += " ORDER BY created_at DESC";

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

  // 2. Clone the task — preserve ALL fields including assigned_to, priority, link
  const cloneRes = await db.execute({
    sql: `INSERT INTO tasks
      (user_id, user_name, title, description, status, project_id, category,
       created_week, created_year, carried_over_from_task_id,
       parent_task_id, start_date, end_date, assigned_to, link, priority)
      VALUES (?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
      RETURNING id`,
    args: [
      user_id || orig.user_id,
      user_name || orig.user_name,
      orig.title,
      orig.description,
      orig.project_id,
      orig.category,
      target_week,
      target_year,
      oldId,
      orig.start_date,
      orig.end_date,
      orig.assigned_to || null,
      orig.link || null,
      orig.priority || null,
    ],
  });
  const newId = Number(cloneRes.rows[0]?.id ?? cloneRes.lastInsertRowid);

  // 3. Migrate blockers
  await db.execute({
    sql: "UPDATE blockers SET task_id = ? WHERE task_id = ?",
    args: [newId, oldId],
  });

  // 4. Migrate comments
  try {
    await db.execute({
      sql: "UPDATE v2_task_comments SET task_id = ? WHERE task_id = ?",
      args: [newId, oldId],
    });
  } catch (_) {
    /* table may not exist yet */
  }

  // 5. Migrate resources/attachments
  try {
    await db.execute({
      sql: "UPDATE task_resources SET task_id = ? WHERE task_id = ?",
      args: [newId, oldId],
    });
  } catch (_) {
    /* table may not exist yet */
  }

  // 6. Re-parent subtasks
  await db.execute({
    sql: "UPDATE tasks SET parent_task_id = ? WHERE parent_task_id = ?",
    args: [newId, oldId],
  });

  // 7. Mark old task as carried_over
  await db.execute({
    sql: "UPDATE tasks SET status = 'carried_over', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [oldId],
  });

  return NextResponse.json({
    success: true,
    id: newId,
    oldId,
    action: "carried_over",
  });
});
