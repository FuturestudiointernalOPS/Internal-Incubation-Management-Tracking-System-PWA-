import { getRetrosByUserAndWeek } from "@/models/participantPortal";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { recordRetro } from "@/services/participant";

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

  const result = await getRetrosByUserAndWeek(cid, weekNum);
  return NextResponse.json({ success: true, retros: result.rows });
});

export const POST = createHandler(async (req) => {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  const { week_number } = await req.json();

  await recordRetro({
    cid: session.cid,
    userName: session.name || "",
    weekNumber: week_number,
  });
  return NextResponse.json({ success: true });
});
