import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

import {
  countVentureInvestedPipeline,
  countVentureParticipants,
  getVentureProgramKpiFields,
} from "@/models/investor";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";

/** GET /api/investor/venture-kpis?venture_id=X — KPIs derived from Venture OS */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");
    if (!ventureId) return NextResponse.json({ success: false, error: "venture_id required" }, { status: 400 });

    const prog = await getVentureProgramKpiFields(ventureId);
    if (prog.rows.length === 0) return NextResponse.json({ success: true, kpis: [] });

    const p = prog.rows[0];
    const participants = await countVentureParticipants(ventureId);
    const invested = await countVentureInvestedPipeline(ventureId);

    const kpis = [
      { kpi_key: "completion", kpi_label: "Program Completion", kpi_value: `${Number(p.completion_index || 0).toFixed(0)}%`, trend: Number(p.completion_index || 0) > 50 ? "up" : "stable" },
      { kpi_key: "participants", kpi_label: "Participants", kpi_value: String(participants.rows[0]?.count || 0), trend: "stable" },
      { kpi_key: "investors", kpi_label: "Active Investors", kpi_value: String(invested.rows[0]?.count || 0), trend: "up" },
      { kpi_key: "status", kpi_label: "Venture Status", kpi_value: p.status || "active", trend: "stable" },
    ];

    return NextResponse.json({ success: true, kpis });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
