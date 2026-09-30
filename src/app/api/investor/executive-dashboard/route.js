import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getExecutiveDashboardInvestors,
  getExecutiveDashboardVentures,
  getExecutiveDashboardFundraising,
  getExecutiveDashboardRelationships,
  getExecutiveDashboardPipeline,
  getExecutiveDashboardTopInvestors,
  getExecutiveDashboardSectorDemand,
  getExecutiveDashboardCampaignPerformance,
} from "@/models/investor";

export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const [investors, ventures, fundraising, relationships, pipeline, topInvestors, sectorDemand, campaignPerformance] = await Promise.all([
      getExecutiveDashboardInvestors(),
      getExecutiveDashboardVentures(),
      getExecutiveDashboardFundraising(),
      getExecutiveDashboardRelationships(),
      getExecutiveDashboardPipeline(),
      getExecutiveDashboardTopInvestors(),
      getExecutiveDashboardSectorDemand(),
      getExecutiveDashboardCampaignPerformance(),
    ]);

    return NextResponse.json({ success: true, investors: investors[0], ventures: ventures[0], fundraising: fundraising[0], relationships: relationships[0], pipeline, topInvestors, sectorDemand, campaignPerformance: campaignPerformance });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
