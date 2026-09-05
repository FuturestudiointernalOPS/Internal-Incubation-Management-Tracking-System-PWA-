import { getStandupsByUserAndWeek, createStandup } from "@/models/participantPortal";
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
  	const weekNum = searchParams.get("week_number");

  	const res = await getStandupsByUserAndWeek(cid, weekNum);
  	return NextResponse.json({ success: true, standups: res.rows });
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
  	const userName = session.name || "";
  	const currentYear = new Date().getFullYear();
  	const { week_number } = await req.json();

  	await createStandup(cid, userName, week_number || 1, currentYear);
  	return NextResponse.json({ success: true });
});
