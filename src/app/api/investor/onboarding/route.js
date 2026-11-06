import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { getInvestorProfileIdByUserId } from "@/models/investor";
import { markOnboardingCompleted } from "@/models/investor/legalDocuments";
import { readInvestorFlags } from "@/services/investor/featureFlags";
import { emitInvestorEvent } from "@/services/investor/activity";

/** POST /api/investor/onboarding — dismiss the first-run checklist. */
export async function POST() {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const capError = await requireInvestorSelfServiceAuthorization("edit");
    if (capError) return capError;

    const flags = await readInvestorFlags();
    if (!flags.onboarding) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }

    const session = await getSession();
    const profile = (await getInvestorProfileIdByUserId(session.cid || session.id)).rows?.[0];
    if (!profile?.id) {
      return NextResponse.json({ success: false, error: "Investor profile not found" }, { status: 404 });
    }

    await markOnboardingCompleted(profile.id);

    await emitInvestorEvent({
      session,
      investorId: profile.id,
      eventType: "onboarding_completed",
      metadata: {},
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
