import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listPortfolioReports, listPortfolioMissingClosingReports } from "@/lib/ventureReports";

export const dynamic = "force-dynamic";

/**
 * GET /api/journey-reports[?status=submitted]
 *
 * THE PORTFOLIO VIEW: every journey report across every Venture, plus the
 * journeys that closed without their closing report — the Super Admin's inbox,
 * so a report is read where it is governed and not only inside one Venture.
 *
 * GLOBAL ROLES ONLY. This crosses Venture boundaries, so it is deliberately NOT
 * reachable through a Venture assignment (`roleIsPrivileged` is too broad here:
 * it also admits staff and program managers).
 */
const GLOBAL_ROLES = ["super_admin"];

export async function GET(req) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }
    if (!GLOBAL_ROLES.includes(session.role)) {
      return NextResponse.json({ success: false, error: "Global access required." }, { status: 403 });
    }

    const status = new URL(req.url).searchParams.get("status") || null;
    const [reports, missing] = await Promise.all([
      listPortfolioReports(db, { status }),
      listPortfolioMissingClosingReports(db),
    ]);

    return NextResponse.json({ success: true, reports, journeys_missing_report: missing });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
