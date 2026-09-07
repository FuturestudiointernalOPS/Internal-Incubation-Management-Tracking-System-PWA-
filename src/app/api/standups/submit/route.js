import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import {
  findStandupReportId,
  updateStandupReport,
  createStandupReport,
  createStandupTask,
} from "@/models/standups";

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
    const existing = await findStandupReportId(
      user_id,
      week_number,
      year,
      context_id,
      context_type,
    );

    let reportId;
    if (existing.rows.length > 0) {
      reportId = existing.rows[0].id;
      await updateStandupReport({
        reportId,
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
        context_type,
        context_id,
      });
    } else {
      // Determine workspace based on user role
      const workspace = user_role === "intern" ? "interns" : "main";
      const result = await createStandupReport({
        user_id,
        user_name,
        user_role,
        workspace,
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
        context_type,
        context_id,
      });
      reportId = Number(result.rows[0]?.id ?? result.lastInsertRowid);
    }

    // Create inline tasks if provided
    const createdTasks = [];
    if (newTasks && Array.isArray(newTasks)) {
      for (const task of newTasks) {
        if (task.title) {
          const taskResult = await createStandupTask({
            user_id,
            user_name,
            task,
            week_number,
            year,
            context_type,
            context_id,
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
