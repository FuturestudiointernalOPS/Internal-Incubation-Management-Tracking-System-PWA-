import { withInvestorPrivacy } from "@/server/investor/withPrivacy";
import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { buildInvestorDashboard } from "@/services/investor";
import { readInvestorFlags } from "@/services/investor/featureFlags";
import { protectInvestorProfile } from "@/services/investor/profilePrivacy";
import { emitInvestorEvent } from "@/services/investor/activity";

const PRIVATE_RESPONSE = { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } };

/**
 * GET /api/investor/dashboard — investor's personalized dashboard data.
 *
 * The recommendation scoring and the block assembly live in
 * `@/services/investor`. The response is DTO-shaped and mode-aware; the view is
 * recorded as `list_viewed` (deduped per 30-minute window).
 */
async function GETWithOriginalGuards(_req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;
    await ensureInvestorExpansionSchema();

    const flags = await readInvestorFlags();
    const session = await getSession();
    const dashboard = await buildInvestorDashboard({ session, includeV2: flags.dashboard });

    await emitInvestorEvent({
      session,
      eventType: "list_viewed",
      metadata: { surface: "dashboard" },
    });

    return NextResponse.json({
      success: true,
      ...dashboard,
      profile: protectInvestorProfile(dashboard.profile, flags.profilePrivacy),
      features: { dashboardV2: flags.dashboard, introductions: flags.introductions,
        messaging: flags.messaging, meetings: flags.meetings,
        investmentConfirmation: flags.investmentConfirmation },
    }, PRIVATE_RESPONSE);
  } catch (_error) {
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { ...PRIVATE_RESPONSE, status: 500 });
  }
}

export const GET = withInvestorPrivacy(GETWithOriginalGuards, "dashboard");
