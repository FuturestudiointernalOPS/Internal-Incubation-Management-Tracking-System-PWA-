import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  getInvestmentReadiness,
  evaluateInvestmentReadiness,
  getInvestmentRecommendations,
} from "@/lib/ventures";

export const GET = createHandler(async (req, { params }) => {
  const { id } = params;
  const s = new URL(req.url).searchParams;
  const type = s.get("type") || "status";

  if (type === "status") {
    const data = await getInvestmentReadiness(id);
    return NextResponse.json({ success: true, ...data });
  }

  if (type === "recommendations") {
    const recs = await getInvestmentRecommendations(id);
    return NextResponse.json({ success: true, recommendations: recs });
  }

  if (type === "history") {
    const data = await getInvestmentReadiness(id);
    return NextResponse.json({ success: true, history: data.history });
  }

  return NextResponse.json({ success: false, error: "Invalid type." }, { status: 400 });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = params;

  try {
    const result = await evaluateInvestmentReadiness(id);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
});
