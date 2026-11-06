import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { requireInvestorStudioAuthorization } from "@/server/investor/studioAuthorization";
import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { listDeclineReasons } from "@/models/investor/declineReasons";

/** GET /api/investor/decline-reasons?applies_to=intro|investment|pass|application|deal_flow_close */
export async function GET(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const studioDenied = await requireInvestorStudioAuthorization("investor", "view");
    if (studioDenied) {
      const selfDenied = await requireInvestorSelfServiceAuthorization("view");
      if (selfDenied) return selfDenied;
    }

    const appliesTo = new URL(req.url).searchParams.get("applies_to") || undefined;
    const result = await listDeclineReasons({ appliesTo, activeOnly: true });
    return NextResponse.json({ success: true, reasons: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
