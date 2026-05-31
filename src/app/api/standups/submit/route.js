import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * POST /api/standups/submit
 *
 * Submits a Monday standup report.
 * Wraps the existing v2_op_reports POST with standup-specific validation.
 *
 * Body: { user_id, user_name, user_role, week_number, year,
 *         top_priorities, expected_deliverables, ... }
 *
 * Also accepts optional tasks array to create new tasks inline:
 *   tasks: [{ title, description, project_id, start_date, end_date }]
 */
export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const {
      user_id, user_name, user_role, week_number, year,
      top_priorities, expected_deliverables,
      projects_tasks, has_dependencies, dependency_note,
      has_blockers, blocker_description,
      needs_support, support_note, additional_notes,
      tasks: newTasks,
    } = body;

    if (!user_id || !week_number || !year) {
      return NextResponse.json(
        { success: false, error: "user_id, week_number, and year are required" },
        { status: 400 }
      );
    }

    // Upsert standup report
    const existing = await db.execute({
      sql: "SELECT id FROM v2_op_reports WHERE user_id = ? AND week_number = ? AND year = ? AND report_type = 'standup'",
      args: [user_id, week_number, year],
    });

    let reportId;
    if (existing.rows.length > 0) {
      reportId = existing.rows[0].id;
      await db.execute({
        sql: `UPDATE v2_op_reports SET
          top_priorities = ?, expected_deliverables = ?, projects_tasks = ?,
          has_dependencies = ?, dependency_note = ?,
          has_blockers = ?, blocker_description = ?,
          needs_support = ?, support_note = ?, additional_notes = ?,
          status = 'submitted', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        args: [
          JSON.stringify(top_priorities || []),
          JSON.stringify(expected_deliverables || []),
          projects_tasks || null,
          has_dependencies != null ? (has_dependencies ? 1 : 0) : null,
          dependency_note || null,
          has_blockers != null ? (has_blockers ? 1 : 0) : null,
          blocker_description || null,
          needs_support != null ? (needs_support ? 1 : 0) : null,
          support_note || null,
          additional_notes || null,
          reportId,
        ],
      });
    } else {
      const result = await db.execute({
        sql: `INSERT INTO v2_op_reports
          (user_id, user_name, user_role, report_type, week_number, year, status,
           top_priorities, expected_deliverables, projects_tasks,
           has_dependencies, dependency_note, has_blockers, blocker_description,
           needs_support, support_note, additional_notes)
          VALUES (?, ?, ?, 'standup', ?, ?, 'submitted',
           ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?)`,
        args: [
          user_id, user_name || "", user_role || "staff",
          week_number, year,
          JSON.stringify(top_priorities || []),
          JSON.stringify(expected_deliverables || []),
          projects_tasks || null,
          has_dependencies != null ? (has_dependencies ? 1 : 0) : null,
          dependency_note || null,
          has_blockers != null ? (has_blockers ? 1 : 0) : null,
          blocker_description || null,
          needs_support != null ? (needs_support ? 1 : 0) : null,
          support_note || null,
          additional_notes || null,
        ],
      });
      reportId = Number(result.lastInsertRowid);
    }

    // Create inline tasks if provided
    const createdTasks = [];
    if (newTasks && Array.isArray(newTasks)) {
      for (const task of newTasks) {
        if (task.title) {
          const taskResult = await db.execute({
            sql: `INSERT INTO tasks
              (user_id, user_name, title, description, status, project_id,
               created_week, created_year, start_date, end_date)
              VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
            args: [
              user_id, user_name || "", task.title, task.description || null,
              task.project_id || null,
              week_number, year,
              task.start_date || null, task.end_date || null,
            ],
          });
          createdTasks.push({ id: Number(taskResult.lastInsertRowid), title: task.title });
        }
      }
    }

    return NextResponse.json({
      success: true,
      reportId,
      createdTasks,
      action: existing.rows.length > 0 ? "updated" : "created",
    });
  } catch (error) {
    console.error("POST standups/submit error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
