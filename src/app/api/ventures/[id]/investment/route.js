import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { isStaffActorForVenture } from "@/lib/ventureAuth";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { retiredRouteResponse } from "@/server/http/refusal";
import { getInvestmentReadiness, evaluateInvestmentReadiness, getInvestmentRecommendations } from "@/services/ventures/investmentReadiness";

// ── RETIRED (WS4) ────────────────────────────────────────────────────────
// This was the TEN-CATEGORY readiness engine: a weighted score over profile,
// legal, financial, product, traction, market, business model, team, technology
// and pitch. It read the Venture's data through its own rules, so it disagreed
// with the Data Room about what "ready" means, and no screen called it any more.
//
// Investment Readiness is now the Data Room's completeness figure
// (`services/ventures/dataRoom/readiness`), surfaced by
// `/api/ventures/[id]/investment-readiness`. The service, its model and its
// tables are deliberately KEPT: the stored assessments and recommendations are
// historical records. Set RETIRED = false to re-enable the endpoint.
const RETIRED = true;

export const GET = createHandler(async (req, { params }) => {
  if (RETIRED) return retiredRouteResponse("ventures/[id]/investment");
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) return access.error;
  const { session } = access;
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
  if (RETIRED) return retiredRouteResponse("ventures/[id]/investment");
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const { session } = access;
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
