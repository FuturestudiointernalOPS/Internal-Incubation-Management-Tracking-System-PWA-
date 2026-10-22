import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/models/authorization/index";
import { listPortfolioReports, listPortfolioMissingClosingReports } from "@/services/ventures/reports";

export const dynamic = "force-dynamic";

/**
 * GET /api/journey-reports[?status=submitted]
 *
 * THE PORTFOLIO VIEW: every journey report across every Venture, plus the
 * journeys that closed without their closing report — the Super Admin's inbox,
 * so a report is read where it is governed and not only inside one Venture.
 *
 * It crosses Venture boundaries, so the door is `reports.portfolio`, which no
 * profile carries by default: only the platform owner (exempt) passes today.
 * A Venture assignment is deliberately NOT enough.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuthorization("reports", "portfolio");
    if (authError) return authError;

    const status = new URL(req.url).searchParams.get("status") || null;
    const [reports, missing] = await Promise.all([
      listPortfolioReports({ status }),
      listPortfolioMissingClosingReports(),
    ]);

    return NextResponse.json({ success: true, reports, journeys_missing_report: missing });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
