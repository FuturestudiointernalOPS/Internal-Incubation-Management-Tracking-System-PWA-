import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { createFeedback, listFeedback } from "@/models/facilitation";

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

  const result = await createFeedback({
    program_id,
    participant_id,
    week_number,
    learnings,
    accomplishments,
    suggestions,
  });

  return NextResponse.json({
    success: true,
    feedback: { id: result.rows[0]?.id ?? null },
  });
});

export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const program_id = searchParams.get("program_id");

  const { rows } = await listFeedback(program_id);
  const feedback = rows.map((r) => ({
    ...r,
    v2_participants: r.participant_name ? { name: r.participant_name } : null,
  }));
  return NextResponse.json({ success: true, feedback });
});
