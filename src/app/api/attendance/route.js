import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * ATTENDANCE API
 * Tracks participant attendance per session/program.
 * Supports: present, absent, excused, late
 */
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
    ]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");
    const programId = searchParams.get("program_id");
    const participantId = searchParams.get("participant_id");

    let sql = "SELECT * FROM v2_attendance WHERE 1=1";
    const args = [];

    if (sessionId) {
      sql += " AND session_id = ?";
      args.push(sessionId);
    }
    if (programId) {
      sql += " AND program_id = ?";
      args.push(programId);
    }
    if (participantId) {
      sql += " AND participant_id = ?";
      args.push(participantId);
    }

    sql += " ORDER BY date DESC, created_at DESC";

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
    ]);
    if (authError) return authError;
    const { session_id, program_id, participant_id, status, date } =
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
        sql: "UPDATE v2_attendance SET status = ? WHERE id = ?",
        args: [status, existing.rows[0].id],
      });
    } else {
      await db.execute({
        sql: "INSERT INTO v2_attendance (session_id, program_id, participant_id, status, date) VALUES (?, ?, ?, ?, ?)",
        args: [session_id, program_id, participant_id, status, date],
      });
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
