import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { buildInvestorDashboard } from "@/services/investor";
import { emitInvestorEvent } from "@/services/investor/activity";

/**
 * GET /api/investor/dashboard — investor's personalized dashboard data.
 *
 * The recommendation scoring and the block assembly live in
 * `@/services/investor`. The response is DTO-shaped and mode-aware; the view is
 * recorded as `list_viewed` (deduped per 30-minute window).
 */
export async function GET(_req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const session = await getSession();
    const dashboard = await buildInvestorDashboard({ session });

    await emitInvestorEvent({
      session,
      eventType: "list_viewed",
      metadata: { surface: "dashboard" },
    });

    return NextResponse.json({ success: true, ...dashboard });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
