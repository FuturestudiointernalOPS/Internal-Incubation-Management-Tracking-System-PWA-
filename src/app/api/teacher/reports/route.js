import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["teacher", "staff", "super_admin"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");
    const week_number = searchParams.get("week_number");

    let sql = "SELECT * FROM v2_weekly_reports WHERE 1=1";
    const args = [];

    if (program_id) {
      sql += " AND program_id = ?";
      args.push(program_id);
    }
    if (week_number) {
      sql += " AND week_number = ?";
      args.push(parseInt(week_number));
    }

    sql += " ORDER BY created_at DESC";

    const reports = await db.execute({ sql, args });
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
    const authError = await requireAuth(["teacher", "staff", "super_admin"]);
    if (authError) return authError;
    const body = await req.json();
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
    const existing = await db.execute({
      sql: "SELECT id FROM v2_weekly_reports WHERE program_id = ? AND week_number = ? AND teacher_id = ?",
      args: [program_id, week_number, teacher_id],
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: `UPDATE v2_weekly_reports SET
                  reception_score = ?,
                  progress_notes = ?,
                  student_reception = ?,
                  action_taken = ?,
                  week_status = ?,
                  week_rating = ?,
                  main_topic = ?,
                  assignment_given = ?,
                  assignment_kpi_ids = ?,
                  assignment_objective = ?,
                  assignment_outcome = ?,
                  attendance_level = ?,
                  participation_level = ?,
                  participants_need_attention = ?,
                  participants_attention_notes = ?,
                  standout_participants = ?,
                  standout_notes = ?,
                  delivery_quality = ?,
                  participant_understanding = ?,
                  delivery_challenges = ?,
                  delivery_challenge_note = ?,
                  had_issues = ?,
                  requires_admin_attention = ?,
                  issue_types = ?,
                  additional_issue_note = ?,
                  program_on_track = ?,
                  planned_adjustments = ?,
                  updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`,
        args: [
          reception_score,
          progress_notes || null,
          student_reception || null,
          action_taken || null,
          week_status || null,
          week_rating || null,
          main_topic || null,
          assignment_given != null ? assignment_given : null,
          assignment_kpi_ids ? (typeof assignment_kpi_ids === "string" ? assignment_kpi_ids : JSON.stringify(assignment_kpi_ids)) : null,
          assignment_objective || null,
          assignment_outcome || null,
          attendance_level || null,
          participation_level || null,
          participants_need_attention != null ? participants_need_attention : null,
          participants_attention_notes || null,
          standout_participants != null ? standout_participants : null,
          standout_notes || null,
          delivery_quality || null,
          participant_understanding || null,
          delivery_challenges != null ? delivery_challenges : null,
          delivery_challenge_note || null,
          had_issues != null ? had_issues : null,
          requires_admin_attention != null ? requires_admin_attention : null,
          issue_types ? (typeof issue_types === "string" ? issue_types : JSON.stringify(issue_types)) : null,
          additional_issue_note || null,
          program_on_track != null ? program_on_track : null,
          planned_adjustments || null,
          existing.rows[0].id,
        ],
      });

      // Log Activity
      await db.execute({
        sql: "INSERT INTO activity_logs (user_identity, action, module, status) VALUES (?, ?, ?, ?)",
        args: [
          teacher_name,
          `Updated Weekly Report (Week ${week_number})`,
          "Programs",
          "success",
        ],
      });

      return NextResponse.json({
        success: true,
        id: existing.rows[0].id,
        action: "updated",
      });
    } else {
      const result = await db.execute({
        sql: `INSERT INTO v2_weekly_reports
                  (program_id, week_number, teacher_id, teacher_name, reception_score, progress_notes, student_reception, action_taken,
                   week_status, week_rating, main_topic,
                   assignment_given, assignment_kpi_ids, assignment_objective, assignment_outcome,
                   attendance_level, participation_level, participants_need_attention, participants_attention_notes, standout_participants, standout_notes,
                   delivery_quality, participant_understanding, delivery_challenges, delivery_challenge_note,
                   had_issues, requires_admin_attention, issue_types, additional_issue_note,
                   program_on_track, planned_adjustments)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                          ?, ?, ?,
                          ?, ?, ?, ?,
                          ?, ?, ?, ?, ?, ?,
                          ?, ?, ?, ?,
                          ?, ?, ?, ?,
                          ?, ?) RETURNING id`,
        args: [
          program_id,
          week_number,
          teacher_id,
          teacher_name,
          reception_score || 5,
          progress_notes || null,
          student_reception || null,
          action_taken || null,
          week_status || null,
          week_rating || null,
          main_topic || null,
          assignment_given != null ? assignment_given : null,
          assignment_kpi_ids ? (typeof assignment_kpi_ids === "string" ? assignment_kpi_ids : JSON.stringify(assignment_kpi_ids)) : null,
          assignment_objective || null,
          assignment_outcome || null,
          attendance_level || null,
          participation_level || null,
          participants_need_attention != null ? participants_need_attention : null,
          participants_attention_notes || null,
          standout_participants != null ? standout_participants : null,
          standout_notes || null,
          delivery_quality || null,
          participant_understanding || null,
          delivery_challenges != null ? delivery_challenges : null,
          delivery_challenge_note || null,
          had_issues != null ? had_issues : null,
          requires_admin_attention != null ? requires_admin_attention : null,
          issue_types ? (typeof issue_types === "string" ? issue_types : JSON.stringify(issue_types)) : null,
          additional_issue_note || null,
          program_on_track != null ? program_on_track : null,
          planned_adjustments || null,
        ],
      });

      // Log Activity
      await db.execute({
        sql: "INSERT INTO activity_logs (user_identity, action, module, status) VALUES (?, ?, ?, ?)",
        args: [
          teacher_name,
          `Created Weekly Report (Week ${week_number})`,
          "Programs",
          "success",
        ],
      });

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
