import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { recalculateKpiProgress } from "@/lib/kpi-progress";

/**
 * ATTENDANCE API — TRACK 3 ENHANCED
 *
 * Tracks participant attendance per session/program.
 * Supports: present, absent, excused, late
 * Integrates with KPIs for attendance-linked KPI progress.
 */
export const dynamic = "force-dynamic";

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
    const sessionId = searchParams.get("session_id");
    const programId = searchParams.get("program_id");
    const participantId = searchParams.get("participant_id");
    const summary = searchParams.get("summary") === "true";

    // ── Summary mode: return attendance rates per participant ──
    if (summary && programId) {
      const summaryRes = await db.execute({
        sql: `
          SELECT
            a.participant_id,
            p.name as participant_name,
            COUNT(*) as total_sessions,
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
            SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
            SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_count,
            SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
            ROUND(
              (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(*), 0)) * 100
            , 1) as attendance_rate
          FROM v2_attendance a
          LEFT JOIN v2_participants p ON a.participant_id = p.id
          WHERE a.program_id = ?
          GROUP BY a.participant_id, p.name
          ORDER BY attendance_rate DESC
        `,
        args: [programId],
      });

      return NextResponse.json({
        success: true,
        summary: summaryRes.rows,
      });
    }

    let sql = "SELECT a.*, p.name as participant_name FROM v2_attendance a LEFT JOIN v2_participants p ON a.participant_id = p.id WHERE 1=1";
    const args = [];

    if (sessionId) {
      sql += " AND a.session_id = ?";
      args.push(sessionId);
    }
    if (programId) {
      sql += " AND a.program_id = ?";
      args.push(programId);
    }
    if (participantId) {
      sql += " AND a.participant_id = ?";
      args.push(participantId);
    }

    sql += " ORDER BY a.date DESC, a.created_at DESC";

    const res = await db.execute({ sql, args });
    return NextResponse.json({ success: true, attendance: res.rows });
  } catch (error) {
    console.error("Attendance GET Error:", error);
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
      "teacher",
    ]);
    if (authError) return authError;
    const { session_id, program_id, participant_id, status, date, kpi_id } =
      await req.json();

    if (!session_id || !program_id || !participant_id || !status || !date) {
      return NextResponse.json(
        {
          success: false,
          error:
            "session_id, program_id, participant_id, status, and date are required",
        },
        { status: 400 },
      );
    }

    if (!["present", "absent", "excused", "late"].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid status. Allowed: present, absent, excused, late",
        },
        { status: 400 },
      );
    }

    // Upsert: if a record exists for this session+participant+date, update it
    const existing = await db.execute({
      sql: "SELECT id FROM v2_attendance WHERE session_id = ? AND participant_id = ? AND date = ?",
      args: [session_id, participant_id, date],
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: "UPDATE v2_attendance SET status = ?, kpi_id = ? WHERE id = ?",
        args: [status, kpi_id || null, existing.rows[0].id],
      });
    } else {
      await db.execute({
        sql: "INSERT INTO v2_attendance (session_id, program_id, participant_id, status, date, kpi_id) VALUES (?, ?, ?, ?, ?, ?)",
        args: [session_id, program_id, participant_id, status, date, kpi_id || null],
      });
    }

    // Update KPI progress after attendance change
    try {
      await recalculateKpiProgress(program_id);
    } catch (_) {
      // Non-blocking KPI recalculation
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Attendance POST Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
