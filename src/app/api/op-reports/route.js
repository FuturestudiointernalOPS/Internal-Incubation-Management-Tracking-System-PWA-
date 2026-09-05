import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  getOpReportId,
  insertOpReport,
  listOpReports,
  updateOpReport,
} from "@/models/adminOps";

/**
 * OPERATIONAL REPORTS API
 *
 * GET  /api/op-reports?user_id=X&type=standup&week=12&year=2026
 *   - Returns reports, filtered by query params
 *   - Super Admin sees all; staff see only their own
 *
 * POST /api/op-reports
 *   - Creates or updates a report (upsert on user_id + week + year + type)
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");
    const report_type = searchParams.get("type");
    const week_number = searchParams.get("week");
    const year = searchParams.get("year");
    const role = searchParams.get("role");
    const workspace = searchParams.get("workspace");
    const context_type = searchParams.get("context_type");
    const context_id = searchParams.get("context_id");

    // SECURITY (Phase 0): Non-SA users can only view their own reports.
    // SA can view all reports with optional filters.
    if (session.role !== "super_admin") {
      if (user_id && String(user_id) !== String(session.cid)) {
        return NextResponse.json(
          { success: false, error: "You can only view your own operational reports." },
          { status: 403 },
        );
      }
    }

    const result = await listOpReports({
      isSuperAdmin: session.role === "super_admin",
      sessionCid: session.cid,
      user_id,
      workspace,
      report_type,
      week_number,
      year,
      context_type,
      context_id,
    });
    return NextResponse.json({ success: true, reports: result.rows });
  } catch (error) {
    console.error("GET op-reports error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("reports", "create");
    if (capError) return capError;
    const body = await req.json();
    const {
      user_id,
      user_name,
      user_role,
      report_type,
      week_number,
      year,
      status,
      // Stand-up fields
      weekly_priorities,
      key_deliverables,
      risks_blockers,
      additional_notes,
      // New structured stand-up fields
      top_priorities,
      expected_deliverables,
      projects_tasks,
      has_dependencies,
      dependency_note,
      has_blockers,
      blocker_description,
      needs_support,
      support_note,
      // Retro fields
      completed_work,
      unfinished_tasks,
      challenges,
      wins,
      carryover_items,
      retro_notes,
      // Context fields
      context_type,
      context_id,
    } = body;

    if (!user_id || !report_type || !week_number || !year) {
      return NextResponse.json(
        {
          success: false,
          error: "user_id, report_type, week_number, and year are required",
        },
        { status: 400 },
      );
    }

    // Check if report already exists (upsert)
    const existing = await getOpReportId(user_id, week_number, year, report_type);

    if (existing.rows.length > 0) {
      const reportId = existing.rows[0].id;
      const updateFields = [];
      const updateArgs = [];

      const allFields = [
        "weekly_priorities",
        "key_deliverables",
        "risks_blockers",
        "additional_notes",
        "top_priorities",
        "expected_deliverables",
        "projects_tasks",
        "has_dependencies",
        "dependency_note",
        "has_blockers",
        "blocker_description",
        "needs_support",
        "support_note",
        "completed_work",
        "unfinished_tasks",
        "challenges",
        "wins",
        "carryover_items",
        "retro_notes",
        "context_type",
        "context_id",
      ];

      const fieldValues = {
        weekly_priorities,
        key_deliverables,
        risks_blockers,
        additional_notes,
        top_priorities,
        expected_deliverables,
        projects_tasks,
        has_dependencies,
        dependency_note,
        has_blockers,
        blocker_description,
        needs_support,
        support_note,
        completed_work,
        unfinished_tasks,
        challenges,
        wins,
        carryover_items,
        retro_notes,
        context_type,
        context_id,
      };

      for (const field of allFields) {
        if (fieldValues[field] !== undefined) {
          // Merge projects_tasks: don't overwrite auto-generated tasks with empty/null
          if (
            field === "projects_tasks" &&
            (!fieldValues[field] || fieldValues[field].trim() === "")
          ) {
            continue; // skip — keep existing tasks
          }
          updateFields.push(`${field} = ?`);
          updateArgs.push(fieldValues[field]);
        }
      }

      if (status) {
        updateFields.push("status = ?");
        updateArgs.push(status);
      }

      updateFields.push("updated_at = CURRENT_TIMESTAMP");
      updateArgs.push(reportId);

      if (updateFields.length > 1) {
        await updateOpReport(updateFields, updateArgs);
      }

      return NextResponse.json({
        success: true,
        id: reportId,
        action: "updated",
      });
    }

    // Insert new report
    // Determine workspace based on user role
    const workspace = user_role === "intern" ? "interns" : "main";
    const result = await insertOpReport({
      user_id,
      user_name,
      user_role,
      workspace,
      report_type,
      week_number,
      year,
      status,
      // Stand-up fields
      weekly_priorities,
      key_deliverables,
      risks_blockers,
      additional_notes,
      // New structured stand-up fields
      top_priorities,
      expected_deliverables,
      projects_tasks,
      has_dependencies,
      dependency_note,
      has_blockers,
      blocker_description,
      needs_support,
      support_note,
      // Retro fields
      completed_work,
      unfinished_tasks,
      challenges,
      wins,
      carryover_items,
      retro_notes,
      // Context fields
      context_type,
      context_id,
    });

    return NextResponse.json({
      success: true,
      id: Number(result.rows[0]?.id ?? result.lastInsertRowid),
      action: "created",
    });
  } catch (error) {
    console.error("POST op-reports error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
