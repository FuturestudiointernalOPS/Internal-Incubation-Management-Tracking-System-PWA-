import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { buildInvestorDashboard } from "@/services/investor";

/**
 * GET /api/investor/dashboard — investor's personalized dashboard data
 *
 * The recommendation scoring and the block assembly live in
 * `@/services/investor`.
 */
export async function GET(_req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const dashboard = await buildInvestorDashboard({ session: await getSession() });

    return NextResponse.json({ success: true, ...dashboard });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
