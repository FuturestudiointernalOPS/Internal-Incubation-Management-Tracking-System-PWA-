import { getCheckinsByParticipantAndProgram } from "@/models/participantPortal";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { recordCheckin } from "@/services/participant";

export const dynamic = "force-dynamic";

export const GET = createHandler(async (req) => {
  const { getSession } = await import("@/server/auth/session");
  const session = await getSession();
  if (!session)
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );

  const cid = session.cid;
  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("program_id");

  const result = await getCheckinsByParticipantAndProgram(cid, programId);
  return NextResponse.json({ success: true, checkins: result.rows });
});

export const POST = createHandler(async (req) => {
  const { getSession } = await import("@/server/auth/session");
  const session = await getSession();
  if (!session)
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );

  const { program_id, status, notes } = await req.json();
  if (!program_id)
    return NextResponse.json(
      { success: false, error: "Program ID required" },
      { status: 400 },
    );

  // The status / notes defaults live in the participant service.
  await recordCheckin({ cid: session.cid, programId: program_id, status, notes });
  return NextResponse.json({ success: true });
});
