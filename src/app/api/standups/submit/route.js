import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";

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
    const capError = await requireAuthorization("reports", "create");
    if (capError) return capError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const body = await req.json();
    const {
      user_id,
      user_name,
      user_role,
      week_number,
      year,
      top_priorities,
      expected_deliverables,
      projects_tasks,
      has_dependencies,
      dependency_note,
      has_blockers,
      blocker_description,
      needs_support,
      support_note,
      additional_notes,
      tasks: newTasks,
      context_type,
      context_id,
    } = body;

    if (!user_id || !week_number || !year) {
      return NextResponse.json(
        {
          success: false,
          error: "user_id, week_number, and year are required",
        },
        { status: 400 },
      );
    }

    // SECURITY (Phase 0): Non-SA users can only submit their own standup.
    if (session.role !== "super_admin" && String(user_id) !== String(session.cid)) {
      return NextResponse.json(
        { success: false, error: "You can only submit your own standup." },
        { status: 403 },
      );
    }

    // Upsert standup report
    let existingSql =
      "SELECT id FROM v2_op_reports WHERE user_id = ? AND week_number = ? AND year = ? AND report_type = 'standup'";
    const existingArgs = [user_id, week_number, year];
    if (context_id) {
      existingSql += " AND context_id = ?";
      existingArgs.push(context_id);
    } else {
      existingSql += " AND context_type = ?";
      existingArgs.push(context_type || "staff");
    }
    const existing = await db.execute({ sql: existingSql, args: existingArgs });

    let reportId;
    if (existing.rows.length > 0) {
      reportId = existing.rows[0].id;
      await db.execute({
        sql: `UPDATE v2_op_reports SET
          top_priorities = ?, expected_deliverables = ?, projects_tasks = ?,
          has_dependencies = ?, dependency_note = ?,
          has_blockers = ?, blocker_description = ?,
          needs_support = ?, support_note = ?, additional_notes = ?,
          context_type = ?, context_id = ?,
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
          context_type || "staff",
          context_id || null,
          reportId,
        ],
      });
    } else {
      // Determine workspace based on user role
      const workspace = user_role === "intern" ? "interns" : "main";
      const result = await db.execute({
        sql: `INSERT INTO v2_op_reports
          (user_id, user_name, user_role, workspace, report_type, week_number, year, status,
           top_priorities, expected_deliverables, projects_tasks,
           has_dependencies, dependency_note, has_blockers, blocker_description,
           needs_support, support_note, additional_notes, context_type, context_id)
          VALUES (?, ?, ?, ?, 'standup', ?, ?, 'submitted',
           ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?, ?) RETURNING id`,
        args: [
          user_id,
          user_name || "",
          user_role || "staff",
          workspace,
          week_number,
          year,
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
          context_type || "staff",
          context_id || null,
        ],
      });
      reportId = Number(result.rows[0]?.id ?? result.lastInsertRowid);
    }

    // Create inline tasks if provided
    const createdTasks = [];
    if (newTasks && Array.isArray(newTasks)) {
      for (const task of newTasks) {
        if (task.title) {
          const taskResult = await db.execute({
            sql: `INSERT INTO tasks
              (user_id, user_name, title, description, status, project_id,
               created_week, created_year, start_date, end_date,
               context_type, context_id)
              VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
            args: [
              user_id,
              user_name || "",
              task.title,
              task.description || null,
              task.project_id || null,
              week_number,
              year,
              task.start_date || null,
              task.end_date || null,
              context_type || "staff",
              context_id || null,
            ],
          });
          createdTasks.push({
            id: Number(taskResult.rows[0]?.id ?? taskResult.lastInsertRowid),
            title: task.title,
          });
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
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
