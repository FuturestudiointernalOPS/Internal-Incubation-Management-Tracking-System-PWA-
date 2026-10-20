import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { can, requireAuthorization } from "@/models/authorization/index";
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
  // program management (programs.edit — held by staff and the program-manager
  // profile, bypassed by the platform owner) may record feedback on behalf of
  // someone else. `can()` fails closed, so an unknown caller writes their own.
  const { session } = req;
  if (!session) {
    return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
  }
  const canManage = await can(session, "programs", "edit");
  const effectiveParticipantId = canManage ? participant_id : session.cid;

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
  // The feedback list is a management view: a participant must not be able to
  // read every program's weekly reflections by changing the query.
  const capError = await requireAuthorization("programs", "view");
  if (capError) return capError;

  const { searchParams } = new URL(req.url);
  const program_id = searchParams.get("program_id");

  const { rows } = await listFeedback(program_id);
  const feedback = rows.map((row) => ({
    ...row,
    v2_participants: row.participant_name ? { name: row.participant_name } : null,
  }));
  return NextResponse.json({ success: true, feedback });
});
