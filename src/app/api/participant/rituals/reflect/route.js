import { getReflectionsByUserAndWeek, createReflection } from "@/models/participantPortal";
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

  	const res = await getReflectionsByUserAndWeek(cid, weekNum);
  	return NextResponse.json({ success: true, reflections: res.rows });
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
  	const { week_number, learnings, challenges, suggestions } = await req.json();

  	const content = [
  		learnings ? `Learnings: ${learnings}` : null,
  		challenges ? `Challenges: ${challenges}` : null,
  		suggestions ? `Suggestions: ${suggestions}` : null,
  	]
  		.filter(Boolean)
  		.join("\n");

  	await createReflection(cid, userName, content || "", week_number || 1, currentYear);
  	return NextResponse.json({ success: true });
});
