import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * PROGRAM COMPLETION RECORDS API (Ticket 6.2 — Historical Records)
 *
 * GET  /api/programs/completion?program_id=X
 *   - Returns all completion records for a program
 *
 * GET  /api/programs/completion?participant_id=X
 *   - Returns all completion records for a participant
 *
 * POST /api/programs/completion
 *   - Creates or updates a participant's completion record
 *   - Body: { program_id, participant_id, participant_name, completion_status,
 *             deliverables_completed, deliverables_total, attendance_rate,
 *             final_feedback, coach_notes }
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const participantId = searchParams.get("participant_id");

    let sql = "SELECT * FROM program_completion_records";
    const args = [];
    const conditions = [];

    if (programId) {
      conditions.push("program_id = ?");
      args.push(programId);
    }
    if (participantId) {
      conditions.push("participant_id = ?");
      args.push(participantId);
    }
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY completed_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, records: result.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
    ]);
    if (authError) return authError;

    const {
      program_id,
      participant_id,
      participant_name,
      completion_status,
      deliverables_completed,
      deliverables_total,
      attendance_rate,
      final_feedback,
      coach_notes,
    } = await req.json();

    if (!program_id || !participant_id) {
      return NextResponse.json(
        { success: false, error: "program_id and participant_id are required" },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: `INSERT INTO program_completion_records
            (program_id, participant_id, participant_name, completion_status,
             deliverables_completed, deliverables_total, attendance_rate,
             final_feedback, coach_notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (program_id, participant_id)
            DO UPDATE SET
              participant_name = EXCLUDED.participant_name,
              completion_status = EXCLUDED.completion_status,
              deliverables_completed = EXCLUDED.deliverables_completed,
              deliverables_total = EXCLUDED.deliverables_total,
              attendance_rate = EXCLUDED.attendance_rate,
              final_feedback = EXCLUDED.final_feedback,
              coach_notes = EXCLUDED.coach_notes,
              completed_at = NOW()
            RETURNING *`,
      args: [
        program_id,
        participant_id,
        participant_name || null,
        completion_status || "completed",
        deliverables_completed || 0,
        deliverables_total || 0,
        attendance_rate || 0,
        final_feedback || null,
        coach_notes || null,
      ],
    });

    return NextResponse.json({ success: true, record: result.rows[0] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
