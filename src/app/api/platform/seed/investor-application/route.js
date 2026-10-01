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
 * See services/platform/seed.js for the seed pipeline.
 */

import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { seedInvestorApplication } from "@/services/platform/seed";

export async function POST() {
  await initDb();
  const authError = await requireAuth(["super_admin"]);
  if (authError) return authError;

  const result = await seedInvestorApplication();
  if (!result.ok) {
    return NextResponse.json(
      { success: false, code: result.code, error: result.error },
      { status: result.statusCode },
    );
  }

  return NextResponse.json({
    success: true,
    form_id: result.form_id,
    run_id: result.run_id,
    slug: result.slug,
    url: result.url,
  });
}
