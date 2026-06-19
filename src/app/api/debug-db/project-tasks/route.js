import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/debug-db/project-tasks?projectId=xxx
 *
 * Diagnostic endpoint that directly queries the database
 * to trace the task-to-project relationship.
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const taskId = searchParams.get("taskId");

    const results = {};

    // 1. Check v2_projects table structure
    const columnsRes = await db.execute({
      sql: `SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'v2_projects'
            ORDER BY ordinal_position`,
      args: [],
    });
    results.projectColumns = columnsRes.rows;

    // 2. Check tasks table structure
    const taskColsRes = await db.execute({
      sql: `SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'tasks'
            ORDER BY ordinal_position`,
      args: [],
    });
    results.taskColumns = taskColsRes.rows;

    // 3. If projectId provided, check that project
    if (projectId) {
      const projectRes = await db.execute({
        sql: "SELECT * FROM v2_projects WHERE id::text = ?",
        args: [projectId],
      });
      results.project = projectRes.rows[0] || null;

      // 4. Count tasks linked to this project (raw query)
      const taskCountRes = await db.execute({
        sql: "SELECT COUNT(*) AS count FROM tasks WHERE project_id::text = ?",
        args: [projectId],
      });
      results.taskCount = taskCountRes.rows[0]?.count || 0;

      // 5. Show the actual tasks (first 10)
      const tasksRes = await db.execute({
        sql: "SELECT id, title, user_name, project_id, status, created_at FROM tasks WHERE project_id::text = ? LIMIT 10",
        args: [projectId],
      });
      results.tasks = tasksRes.rows;

      // 6. Check project_members for this project
      const membersRes = await db.execute({
        sql: "SELECT * FROM project_members WHERE project_id::text = ?",
        args: [projectId],
      });
      results.members = membersRes.rows;
    }

    // 7. If taskId provided, check that specific task
    if (taskId) {
      const taskRes = await db.execute({
        sql: "SELECT * FROM tasks WHERE id = ?",
        args: [parseInt(taskId)],
      });
      results.task = taskRes.rows[0] || null;
    }

    // 8. Show a few sample tasks with their project_id values
    const sampleTasks = await db.execute({
      sql: "SELECT id, title, project_id, user_name, status, created_at FROM tasks ORDER BY created_at DESC LIMIT 20",
      args: [],
    });
    results.sampleTasks = sampleTasks.rows;

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
