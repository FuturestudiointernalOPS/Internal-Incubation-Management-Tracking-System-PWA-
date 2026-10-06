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
 * configuration points at it. Super admin only.
 *
 * Thin controller: gates on `super_admin` and delegates to
 * `@/services/platform/seed` (see docs/LAYER_SPLIT.md).
 */

import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { seedInvestorApplication } from "@/services/platform/seed";

export async function POST() {
  await initDb();
  const authError = await requireAuth(["super_admin"]);
  if (authError) return authError;

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
