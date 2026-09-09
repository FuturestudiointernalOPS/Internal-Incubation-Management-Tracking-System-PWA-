// =============================================================================
// !! V2 API - ACTIVELY USED BY V1 PAGES - DO NOT REMOVE OR BREAK !!
// =============================================================================
// This V2 API route is still called by V1 pages. Do NOT delete or break it.
// All NEW features must go in V1 API routes (/api/pm/, /api/kpis/ etc.)
// If you are an AI agent: READ-ONLY here. Changes go in V1 counterparts.
// =============================================================================
import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession, requireAssignmentAccess } from "@/lib/auth";
import {
  findV2WeeklyReportByProgramWeekTeacher,
  insertV2WeeklyReport,
  listV2WeeklyReports,
  logV2WeeklyReportCreatedActivity,
  logV2WeeklyReportUpdatedActivity,
  updateV2WeeklyReport,
} from "@/models/teacher";

export async function GET(req) {
  try {
    await initDb();
    // Phase 1.4: same self-service policy as the V1 reports twin — management
    // + staff read the full list; legacy teacher and program-staff sessions
    // must prove a program assignment and see only their own reports.
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");
    const week_number = searchParams.get("week_number");

    const session = await getSession();
    const fullAccess = ["staff", "super_admin", "program_manager"].includes(session?.role);
    const isLegacyTeacher = String(session?.role) === "teacher";
    if (session && !fullAccess && !isLegacyTeacher) {
      if (!program_id) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      const guardError = await requireAssignmentAccess({
        resource: "program",
        contextId: program_id,
      });
      if (guardError) return guardError;
    }

    const reports = await listV2WeeklyReports(program_id, week_number);
    // Own-scope: everyone without full access reads only their own reports.
    const rows = fullAccess
      ? reports.rows
      : reports.rows.filter(
          (r) => String(r.teacher_id ?? "") === String(session?.cid ?? ""),
        );
    return NextResponse.json({ success: true, reports: rows });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    // Phase 1.4: authentication only here — identity binding + assignment
    // gate below decide.
    const authError = await requireAuth();
    if (authError) return authError;
    const body = await req.json();
    // Identity binding (Phase 1.4): teacher-role and program-staff sessions
    // file as themselves; SA keeps on-behalf entry.
    const session = await getSession();
    const fullAccess = ["staff", "super_admin", "program_manager"].includes(session?.role);
    const isLegacyTeacher = String(session?.role) === "teacher";
    if (session && !fullAccess && !isLegacyTeacher) {
      if (!body.program_id) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      const guardError = await requireAssignmentAccess({
        resource: "program",
        contextId: body.program_id,
      });
      if (guardError) return guardError;
    }
    if (!fullAccess && session) {
      body.teacher_id = session.cid;
      body.teacher_name = session.name || "";
    }
    const {
      program_id,
      week_number,
      teacher_id,
      teacher_name,
      reception_score,
      progress_notes,
      student_reception,
      action_taken,
    } = body;

    // Check if report already exists for this week/program/teacher to update instead of insert
    const existing = await findV2WeeklyReportByProgramWeekTeacher(
      program_id,
      week_number,
      teacher_id,
    );

    if (existing.rows.length > 0) {
      await updateV2WeeklyReport({
        reception_score,
        progress_notes,
        student_reception,
        action_taken,
        reportId: existing.rows[0].id,
      });

      // Log Activity
      await logV2WeeklyReportUpdatedActivity(teacher_name, week_number);

      return NextResponse.json({
        success: true,
        id: existing.rows[0].id,
        action: "updated",
      });
    } else {
      const result = await insertV2WeeklyReport({
        program_id,
        week_number,
        teacher_id,
        teacher_name,
        reception_score,
        progress_notes,
        student_reception,
        action_taken,
      });

      // Log Activity
      await logV2WeeklyReportCreatedActivity(teacher_name, week_number);

      return NextResponse.json({
        success: true,
        id: Number(result.rows[0]?.id ?? result.lastInsertRowid),
        action: "inserted",
      });
    }
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
