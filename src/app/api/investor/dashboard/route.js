import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { buildInvestorDashboard } from "@/services/investor";
import { readInvestorFlags } from "@/services/investor/featureFlags";
import { protectInvestorProfile } from "@/services/investor/profilePrivacy";

const PRIVATE_RESPONSE = { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } };

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

    const flags = await readInvestorFlags();
    const dashboard = await buildInvestorDashboard({ session: await getSession() });

    return NextResponse.json({
      success: true,
      ...dashboard,
      profile: protectInvestorProfile(dashboard.profile, flags.profilePrivacy),
    }, PRIVATE_RESPONSE);
  } catch (_error) {
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { ...PRIVATE_RESPONSE, status: 500 });
  }
}
