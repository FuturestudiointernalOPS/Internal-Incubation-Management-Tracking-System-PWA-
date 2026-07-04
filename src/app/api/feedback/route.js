import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const POST = createHandler(async (req) => {
  const body = await req.json();
  const {
    program_id,
    group_id,
    participant_id,
    learnings,
    challenges,
    suggestions,
  } = body;

  if (!program_id || (!group_id && !participant_id)) {
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 },
    );
  }

  const result = await db.execute({
    sql: `INSERT INTO v2_feedback (program_id, group_id, participant_id, learnings, challenges, suggestions)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      program_id,
      group_id || null,
      participant_id || null,
      learnings || null,
      challenges || null,
      suggestions || null,
    ],
  });

  return NextResponse.json({
    success: true,
    feedback: { id: Number(result.rows[0]?.id ?? result.lastInsertRowid) },
  });
});

export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const program_id = searchParams.get("program_id");

  let sql = `SELECT f.*, p.name as participant_name, g.name as group_name
       FROM v2_feedback f
       LEFT JOIN v2_participants p ON f.participant_id = p.id
       LEFT JOIN v2_groups g ON f.group_id = g.id
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
    v2_groups: r.group_name ? { name: r.group_name } : null,
  }));
  return NextResponse.json({ success: true, feedback });
});
