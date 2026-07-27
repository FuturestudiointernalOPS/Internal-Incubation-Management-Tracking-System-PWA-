import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/tasks/carryover?user_id=X&week=12&year=2026
 *
 * Returns tasks flagged as carried_over for a specific user.
 * Used by Monday standup to auto-inject carry-over tasks.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
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

    // Attach blockers
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
  } catch (error) {
    console.error("GET carryover error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/tasks/carryover
 *
 * Clones a task, follows the chain forward to find the LATEST clone,
 * migrates blockers/comments/resources/subtasks, marks old as carried_over.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

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

    // 3. Clone the LATEST task in the chain
    const cloneRes = await db.execute({
      sql: `INSERT INTO tasks
        (user_id, user_name, title, description, status, project_id, category,
         created_week, created_year, carried_over_from_task_id,
         parent_task_id, start_date, end_date, assigned_to, link, priority)
        VALUES (?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
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
      ],
    });
    const newId = Number(cloneRes.rows[0]?.id ?? cloneRes.lastInsertRowid);

    // 4. Migrate blockers from the LATEST task
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
    } catch (_) {}

    // 6. Migrate resources/attachments
    try {
      await db.execute({
        sql: "UPDATE task_resources SET task_id = ? WHERE task_id = ?",
        args: [newId, sourceId],
      });
    } catch (_) {}

    // 7. Re-parent subtasks
    await db.execute({
      sql: "UPDATE tasks SET parent_task_id = ? WHERE parent_task_id = ?",
      args: [newId, sourceId],
    });

    // 8. Mark the LATEST task as carried_over
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
  } catch (error) {
    console.error("POST carryover error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
