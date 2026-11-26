/**
 * POST /api/platform/seed/investor-application
 *
 * Seeds the canonical "Investor Application" form + run INSIDE the existing
 * platform forms engine (no new form system), then returns the run's public
 * link. The link is what a super admin hands to a prospective investor: filling
 * it creates a submission, and approving it creates the investor account
 * (profile + activation email) — see the platform automation rule.
 *
 * Idempotent: re-running reuses the existing form/run and only ensures the
 * configuration points at it.
 *
 * Gate: `investor.create` (delegatable from the Permission Center) or
 * `settings.edit` (the platform-configuration right this seed used to require).
 * A delegated investor creator gets the same link the Super Admin hands out.
 *
 * Thin controller: gates and delegates to `@/services/platform/seed` (see
 * docs/LAYER_SPLIT.md).
 */

import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { requireAnyAuthorization } from "@/models/authorization/index";
import { seedInvestorApplication } from "@/services/platform/seed";

export async function POST() {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;

  const capError = await requireAnyAuthorization([
    { module: "investor", capability: "create" },
    { module: "settings", capability: "edit" },
  ]);
  if (capError) return capError;

  try {
    const { status, body } = await seedInvestorApplication();
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("Investor application seed error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Seed failed." },
      { status: 500 },
    );
  }
}
