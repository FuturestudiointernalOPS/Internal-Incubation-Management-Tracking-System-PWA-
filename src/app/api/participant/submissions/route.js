import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const GET = createHandler(async (req) => {
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
});

export const POST = createHandler(async (req) => {
  const { participant_id, team_id, program_id, requirement_id, file_url } =
    await req.json();

  await db.execute({
    sql: "INSERT INTO v2_submissions (participant_id, team_id, program_id, deliverable_id, file_url, status) VALUES (?, ?, ?, ?, ?, 'pending')",
    args: [
      participant_id || null,
      team_id || null,
      program_id,
      requirement_id,
      file_url || null,
    ],
  });

  return NextResponse.json({ success: true });
});
