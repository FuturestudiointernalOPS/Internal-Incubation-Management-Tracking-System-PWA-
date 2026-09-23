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

  // Own-scope: a participant writes only their OWN weekly feedback. Only
  // management may record feedback on behalf of someone else.
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }
  const staffSide = ["super_admin", "staff", "program_manager"];
  const effectiveParticipantId = staffSide.includes(session.role) ? participant_id : session.cid;

  const result = await createFeedback({
    program_id,
    participant_id: effectiveParticipantId,
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

  // The feedback list is a management view: a participant must not be able to
  // read every program's weekly reflections by changing the query.
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!["super_admin", "staff", "program_manager"].includes(session?.role)) {
    return NextResponse.json(
      { success: false, error: "errors.insufficientPermissions" },
      { status: 403 },
    );
  }

  const { rows } = await listFeedback(program_id);
  const feedback = rows.map((row) => ({
    ...row,
    v2_participants: row.participant_name ? { name: row.participant_name } : null,
  }));
  return NextResponse.json({ success: true, feedback });
});
