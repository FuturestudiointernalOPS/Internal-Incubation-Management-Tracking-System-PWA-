import { getCheckinsByParticipantAndProgram, createCheckin } from "@/models/participantPortal";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const dynamic = "force-dynamic";

export const GET = createHandler(async (req) => {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session)
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );

  	const cid = session.cid;
  	const { searchParams } = new URL(req.url);
  	const programId = searchParams.get("program_id");

  const res = await getCheckinsByParticipantAndProgram(cid, programId);
  return NextResponse.json({ success: true, checkins: res.rows });
});

export const POST = createHandler(async (req) => {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session)
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );

  	const cid = session.cid;
  	const { program_id, status, notes } = await req.json();
  	if (!program_id)
  		return NextResponse.json(
  			{ success: false, error: "Program ID required" },
  			{ status: 400 },
  		);

  	await createCheckin(cid, program_id, status || "checked_in", notes || "");
  	return NextResponse.json({ success: true });
});
