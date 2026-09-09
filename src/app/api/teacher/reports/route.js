import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession, requireAssignmentAccess } from "@/lib/auth";
import {
  findWeeklyReportByProgramWeekTeacher,
  insertWeeklyReport,
  listWeeklyReports,
  logWeeklyReportCreatedActivity,
  logWeeklyReportUpdatedActivity,
  updateWeeklyReport,
} from "@/models/teacher";

export async function GET(req) {
  try {
    await initDb();
    // Phase 1.4: weekly reports are program-staff self-service — management
    // roles + staff read the full list; legacy teacher sessions keep their
    // own-report view; any other session must prove a program assignment and
    // still sees only its own reports.
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

    const reports = await listWeeklyReports(program_id, week_number);
    // Own-scope: everyone without full access (legacy teacher + program staff)
    // may only read their own reports.
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
    // file AS THEMSELVES — teacher_id/teacher_name are derived server-side and
    // the client-supplied values are ignored. Staff/PM/SA keep on-behalf entry.
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
      // Old fields
      reception_score,
      progress_notes,
      student_reception,
      action_taken,
      // Section 1: Weekly Overview
      week_status,
      week_rating,
      main_topic,
      // Section 2: Assignment Tracking
      assignment_given,
      assignment_kpi_ids,
      assignment_objective,
      assignment_outcome,
      // Section 3: Participation
      attendance_level,
      participation_level,
      participants_need_attention,
      participants_attention_notes,
      standout_participants,
      standout_notes,
      // Section 4: Delivery Feedback
      delivery_quality,
      participant_understanding,
      delivery_challenges,
      delivery_challenge_note,
      // Section 5: Issues & Support
      had_issues,
      requires_admin_attention,
      issue_types,
      additional_issue_note,
      // Section 6: Next Week
      program_on_track,
      planned_adjustments,
    } = body;

    // Check if report already exists for this week/program/teacher to update instead of insert
    const existing = await findWeeklyReportByProgramWeekTeacher(
      program_id,
      week_number,
      teacher_id,
    );

    if (existing.rows.length > 0) {
      await updateWeeklyReport({
        reception_score,
        progress_notes,
        student_reception,
        action_taken,
        week_status,
        week_rating,
        main_topic,
        assignment_given,
        assignment_kpi_ids,
        assignment_objective,
        assignment_outcome,
        attendance_level,
        participation_level,
        participants_need_attention,
        participants_attention_notes,
        standout_participants,
        standout_notes,
        delivery_quality,
        participant_understanding,
        delivery_challenges,
        delivery_challenge_note,
        had_issues,
        requires_admin_attention,
        issue_types,
        additional_issue_note,
        program_on_track,
        planned_adjustments,
        reportId: existing.rows[0].id,
      });

      // Log Activity
      await logWeeklyReportUpdatedActivity(teacher_name, week_number);

      return NextResponse.json({
        success: true,
        id: existing.rows[0].id,
        action: "updated",
      });
    } else {
      const result = await insertWeeklyReport({
        program_id,
        week_number,
        teacher_id,
        teacher_name,
        reception_score,
        progress_notes,
        student_reception,
        action_taken,
        week_status,
        week_rating,
        main_topic,
        assignment_given,
        assignment_kpi_ids,
        assignment_objective,
        assignment_outcome,
        attendance_level,
        participation_level,
        participants_need_attention,
        participants_attention_notes,
        standout_participants,
        standout_notes,
        delivery_quality,
        participant_understanding,
        delivery_challenges,
        delivery_challenge_note,
        had_issues,
        requires_admin_attention,
        issue_types,
        additional_issue_note,
        program_on_track,
        planned_adjustments,
      });

      // Log Activity
      await logWeeklyReportCreatedActivity(teacher_name, week_number);

      return NextResponse.json({
        success: true,
        id: Number(result.lastInsertRowid),
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
