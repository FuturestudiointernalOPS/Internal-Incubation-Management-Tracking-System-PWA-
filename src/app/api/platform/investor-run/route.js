/**
 * GET /api/platform/investor-run
 *
 * Resolves the configured Investor Run (the active, shareable run of the form
 * flagged settings.investor_application = true) and returns its stable
 * reference + public URL. Super admin only.
 *
 * Mirrors GET /api/platform/venture-run. The screen that hands out the investor
 * intake link uses this instead of copy/pasting a URL.
 *
 * Thin controller: gates `super_admin` and delegates to
 * `@/services/platform/investorIntake` (see docs/LAYER_SPLIT.md).
 */

import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { getInvestorRunReference } from "@/services/platform/investorIntake";

export async function GET() {
  await initDb();
  const authError = await requireAuth(["super_admin"]);
  if (authError) return authError;

  try {
    const { status, body } = await getInvestorRunReference();
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("Investor run resolution error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to resolve Investor Run." },
      { status: 500 },
    );
  }
}
