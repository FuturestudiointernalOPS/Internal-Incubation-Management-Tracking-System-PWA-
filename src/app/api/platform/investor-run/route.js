/**
 * GET /api/platform/investor-run
 *
 * Resolves the configured Investor Run (the active, shareable run of the form
 * flagged settings.investor_application = true) and returns its stable
 * reference + public URL. Super admin only.
 *
 * Mirrors GET /api/platform/venture-run. The screen that hands out the investor
 * intake link uses this instead of copy/pasting a URL.
 */

import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { resolveAppUrl } from "@/lib/appUrl";
import { resolveInvestorRun } from "@/models/investorApplication";

export async function GET() {
  await initDb();
  const authError = await requireAuth(["super_admin"]);
  if (authError) return authError;

  try {
    const run = await resolveInvestorRun();
    if (!run || !run.public_slug) {
      return NextResponse.json(
        { success: false, error: "No Investor Run configured. Run the Investor Application seed first." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      run_id: run.id,
      name: run.name,
      status: run.status,
      slug: run.public_slug,
      url: `${resolveAppUrl()}/s/${run.public_slug}`,
    });
  } catch (error) {
    console.error("Investor run resolution error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to resolve Investor Run." },
      { status: 500 },
    );
  }
}
