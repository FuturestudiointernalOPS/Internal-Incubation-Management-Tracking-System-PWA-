import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";
import {
  getInvestmentReadiness,
  evaluateInvestmentReadiness,
  getInvestmentRecommendations,
} from "@/lib/ventures";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
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
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  try {
    const result = await evaluateInvestmentReadiness(id);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
});
