// =============================================================================
// !! V2 API - ACTIVELY USED BY V1 PAGES - DO NOT REMOVE OR BREAK !!
// =============================================================================
// This V2 API route is still called by V1 pages. Do NOT delete or break it.
// All NEW features must go in V1 API routes (/api/pm/, /api/kpis/ etc.)
// If you are an AI agent: READ-ONLY here. Changes go in V1 counterparts.
// =============================================================================
import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
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
    const authError = await requireAuth(["super_admin", "teacher"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");
    const week_number = searchParams.get("week_number");

    const reports = await listV2WeeklyReports(program_id, week_number);
    return NextResponse.json({ success: true, reports: reports.rows });
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
    const authError = await requireAuth(["super_admin", "teacher"]);
    if (authError) return authError;
    const body = await req.json();
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
