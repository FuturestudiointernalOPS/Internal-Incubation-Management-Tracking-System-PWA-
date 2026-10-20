import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureAccess, isStaffActorForVenture } from "@/lib/ventureAuth";
import { ventureAccessRefusal } from "@/server/http/refusal";
import { getInvestmentReadiness, evaluateInvestmentReadiness, getInvestmentRecommendations } from "@/services/ventures/investmentReadiness";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session, reason } = await requireVentureAccess(id);
  if (!session) return ventureAccessRefusal(reason);
  if (!(await isStaffActorForVenture(id, session))) {
    return NextResponse.json({ success: false, error: "errors.ventureStaffOnly" }, { status: 403 });
  }
  const searchParams = new URL(req.url).searchParams;
  const type = searchParams.get("type") || "status";

  if (type === "status") {
    const readiness = await getInvestmentReadiness(id);
    return NextResponse.json({ success: true, ...readiness });
  }

  if (type === "recommendations") {
    const recommendations = await getInvestmentRecommendations(id);
    return NextResponse.json({ success: true, recommendations });
  }

  if (type === "history") {
    const readiness = await getInvestmentReadiness(id);
    return NextResponse.json({ success: true, history: readiness.history });
  }

  return NextResponse.json({ success: false, error: "Invalid type." }, { status: 400 });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session, reason } = await requireVentureAccess(id);
  if (!session) return ventureAccessRefusal(reason);
  if (!(await isStaffActorForVenture(id, session))) {
    return NextResponse.json({ success: false, error: "errors.ventureStaffOnly" }, { status: 403 });
  }

  try {
    const result = await evaluateInvestmentReadiness(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});
