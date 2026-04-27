import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get('participant_id');
    const programId = searchParams.get('program_id');

    let query = "SELECT * FROM v2_submissions WHERE participant_id = ?";
    let args = [participantId];

    if (programId) {
      query += " AND program_id = ?";
      args.push(programId);
    }

    const res = await db.execute({ sql: query, args });
    return NextResponse.json({ success: true, submissions: res.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { participant_id, program_id, requirement_id, file_url, report_body } = await req.json();
    
    await db.execute({
      sql: "INSERT INTO v2_submissions (participant_id, program_id, requirement_id, file_url, report_body) VALUES (?, ?, ?, ?, ?)",
      args: [participant_id, program_id, requirement_id, file_url || null, report_body || null]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
