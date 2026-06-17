import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get("participant_id");
    const teamId = searchParams.get("team_id");
    const programId = searchParams.get("program_id");

    let query =
      "SELECT *, document_id AS requirement_id FROM v2_submissions WHERE ";
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
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const {
      participant_id,
      team_id,
      program_id,
      requirement_id,
      file_url,
      report_body,
    } = await req.json();

    // requirement_id maps to deliverable_id in the schema
    await db.execute({
      sql: "INSERT INTO v2_submissions (participant_id, program_id, deliverable_id, file_url, status) VALUES (?, ?, ?, ?, 'pending')",
      args: [
        participant_id || null,
        program_id,
        requirement_id,
        file_url || null,
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
