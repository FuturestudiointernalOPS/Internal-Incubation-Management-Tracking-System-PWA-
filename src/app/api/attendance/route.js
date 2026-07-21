import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

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

    // Ensure table exists
    try {
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS v2_attendance (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          session_id UUID NOT NULL,
          program_id UUID,
          participant_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'present',
          date DATE DEFAULT CURRENT_DATE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        args: [],
      });
    } catch (_) {}

    const body = await req.json();
    const records = Array.isArray(body) ? body : [body];

    let upserted = 0;
    for (const r of records) {
      const { session_id, program_id, participant_id, status, date } = r;
      if (!session_id || !participant_id) continue;

      await db.execute({
        sql: `DELETE FROM v2_attendance WHERE session_id = ? AND participant_id = ? AND date = ?`,
        args: [session_id, participant_id, date || new Date().toISOString().split("T")[0]],
      });
      await db.execute({
        sql: `INSERT INTO v2_attendance (session_id, program_id, participant_id, status, date)
              VALUES (?, ?, ?, ?, ?)`,
        args: [
          session_id,
          program_id || null,
          participant_id,
          status || "present",
          date || new Date().toISOString().split("T")[0],
        ],
      });
      upserted++;
    }

    return NextResponse.json({ success: true, upserted });
  } catch (e) {
    console.error("Attendance error:", e);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
      "participant",
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

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, attendance: result.rows });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
