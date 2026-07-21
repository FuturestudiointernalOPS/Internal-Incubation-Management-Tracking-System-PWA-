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
          session_id TEXT NOT NULL,
          program_id TEXT,
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
    const valid = records.filter((r) => r.session_id && r.participant_id);

    if (valid.length === 0) {
      return NextResponse.json({ success: true, upserted: 0 });
    }

    const sessionId = valid[0].session_id;
    const date = valid[0].date || new Date().toISOString().split("T")[0];

    // 1. Batch delete all existing records for this session+date
    const delPlaceholders = valid.map(() => "?").join(",");
    await db.execute({
      sql: `DELETE FROM v2_attendance WHERE session_id = ? AND date = ? AND participant_id IN (${delPlaceholders})`,
      args: [sessionId, date, ...valid.map((r) => r.participant_id)],
    });

    // 2. Batch insert all records in one multi-row VALUES query
    const valueTuples = valid.map(() => "(gen_random_uuid(), ?, ?, ?, ?, ?)").join(", ");
    const insertArgs = [];
    for (const r of valid) {
      insertArgs.push(
        r.session_id,
        r.program_id || null,
        r.participant_id,
        r.status || "present",
        date
      );
    }
    await db.execute({
      sql: `INSERT INTO v2_attendance (id, session_id, program_id, participant_id, status, date)
            VALUES ${valueTuples}`,
      args: insertArgs,
    });

    return NextResponse.json({ success: true, upserted: valid.length });
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
