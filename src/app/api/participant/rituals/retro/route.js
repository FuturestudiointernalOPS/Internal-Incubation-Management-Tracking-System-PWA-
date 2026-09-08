import { getRetrosByUserAndWeek, createRetro } from "@/models/participantPortal";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const dynamic = "force-dynamic";

/**
 * RETROSPECTIVE API — SUSPENDED
 * This endpoint is intentionally disabled from the participant UI.
 * Do not re-enable without explicit approval from the product owner.
 */

export const GET = createHandler(async (req) => {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  	const cid = session.cid;
  	const { searchParams } = new URL(req.url);
  	const weekNum = searchParams.get("week_number");

  	const res = await getRetrosByUserAndWeek(cid, weekNum);
  	return NextResponse.json({ success: true, retros: res.rows });
});

export const POST = createHandler(async (req) => {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  	const cid = session.cid;
  	const userName = session.name || "";
  	const currentYear = new Date().getFullYear();
  	const { week_number } = await req.json();

  	await createRetro(cid, userName, week_number || 1, currentYear);
  	return NextResponse.json({ success: true });
});
