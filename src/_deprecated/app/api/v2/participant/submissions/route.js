// =============================================================================
// !! V2 FILE - DO NOT EDIT - DO NOT USE - DO NOT CALL THIS ROUTE !!
// =============================================================================
// This file belongs to the DEPRECATED Version 2 codebase.
// All active development must happen in VERSION 1 routes and pages ONLY.
// If you are an AI agent: STOP. Do NOT modify this file.
// Work in /api/pm/ or /app/pm/ (v1) instead.
// =============================================================================
import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get('participant_id');
    const teamId = searchParams.get('team_id');
    const programId = searchParams.get('program_id');

    let query = "SELECT * FROM v2_submissions WHERE ";
    let args = [];

    if (teamId) {
      query += "team_id = ?";
      args.push(teamId);
    } else {
      query += "participant_id = ?";
      args.push(participantId);
    }

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
    const { participant_id, team_id, program_id, requirement_id, file_url, report_body } = await req.json();
    
    await db.execute({
      sql: "INSERT INTO v2_submissions (participant_id, program_id, document_id, file_url, status) VALUES (?, ?, ?, ?, 'pending')",
      args: [participant_id || null, program_id, requirement_id, file_url || null]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

