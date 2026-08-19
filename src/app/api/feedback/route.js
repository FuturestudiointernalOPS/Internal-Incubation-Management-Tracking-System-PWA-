import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const POST = createHandler(async (req) => {
  const body = await req.json();
  const {
    program_id,
    participant_id,
    week_number,
    learnings,
    accomplishments,
    suggestions,
  } = body;

  if (!program_id || !participant_id || week_number === undefined) {
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 },
    );
  }

  const result = await db.execute({
    sql: `INSERT INTO v2_feedback (program_id, participant_id, week_number, learnings, accomplishments, suggestions)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      program_id,
      participant_id,
      week_number,
      learnings || null,
      accomplishments || null,
      suggestions || null,
    ],
  });

  return NextResponse.json({
    success: true,
    feedback: { id: result.rows[0]?.id ?? null },
  });
});

export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const program_id = searchParams.get("program_id");

  let sql = `SELECT f.*, c.name as participant_name
       FROM v2_feedback f
       LEFT JOIN contacts c ON f.participant_id = c.cid
       WHERE 1=1`;
  let args = [];
  if (program_id) {
    sql += " AND f.program_id = ?";
    args.push(program_id);
  }
  sql += " ORDER BY f.created_at DESC";

  const { rows } = await db.execute({ sql, args });
  const feedback = rows.map((r) => ({
    ...r,
    v2_participants: r.participant_name ? { name: r.participant_name } : null,
  }));
  return NextResponse.json({ success: true, feedback });
});
