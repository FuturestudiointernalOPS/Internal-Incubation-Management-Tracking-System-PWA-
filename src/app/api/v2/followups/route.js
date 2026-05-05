import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get('program_id');
    const result = await db.execute({
      sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC",
      args: [programId]
    });
    return NextResponse.json({ success: true, followups: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { program_id, week_number, session_id, comment } = await req.json();
    const result = await db.execute({
      sql: "INSERT INTO v2_followups (program_id, week_number, session_id, comment) VALUES (?, ?, ?, ?) RETURNING *",
      args: [program_id, week_number, session_id || null, comment]
    });
    return NextResponse.json({ success: true, followup: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
