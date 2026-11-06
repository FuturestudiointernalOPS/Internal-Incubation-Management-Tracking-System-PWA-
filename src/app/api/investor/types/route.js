import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { requireInvestorStudioAuthorization } from "@/server/investor/studioAuthorization";
import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { listInvestorTypes } from "@/models/investor/investorTypes";

/** GET /api/investor/types — bilingual studio-managed investor type list. */
export async function GET() {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const studioDenied = await requireInvestorStudioAuthorization("investor", "view");
    if (studioDenied) {
      const selfDenied = await requireInvestorSelfServiceAuthorization("view");
      if (selfDenied) return selfDenied;
    }

    const result = await listInvestorTypes({ activeOnly: true });
    return NextResponse.json({ success: true, types: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
