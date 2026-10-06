import { getStandupsByUserAndWeek } from "@/models/participantPortal";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { recordStandup } from "@/services/participant";

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
  const weekNum = searchParams.get("week_number");

  const result = await getStandupsByUserAndWeek(cid, weekNum);
  return NextResponse.json({ success: true, standups: result.rows });
});

export const POST = createHandler(async (req) => {
  const { getSession } = await import("@/server/auth/session");
  const session = await getSession();
  if (!session)
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );

  const { week_number } = await req.json();

  // The default week and the calendar year live in the participant service.
  await recordStandup({
    cid: session.cid,
    userName: session.name || "",
    weekNumber: week_number,
  });
  return NextResponse.json({ success: true });
});
