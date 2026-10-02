import { getReflectionsByUserAndWeek } from "@/models/participantPortal";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { recordReflection } from "@/services/participant";

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

  const result = await getReflectionsByUserAndWeek(cid, weekNum);
  return NextResponse.json({ success: true, reflections: result.rows });
});

export const POST = createHandler(async (req) => {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session)
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );

  const { week_number, learnings, challenges, suggestions } = await req.json();

  // The content assembly, the default week and the year live in the service.
  await recordReflection({
    cid: session.cid,
    userName: session.name || "",
    weekNumber: week_number,
    learnings,
    challenges,
    suggestions,
  });
  return NextResponse.json({ success: true });
});
