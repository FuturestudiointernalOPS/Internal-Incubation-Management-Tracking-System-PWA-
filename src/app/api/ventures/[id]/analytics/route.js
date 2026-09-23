import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess, isStaffActorForVenture } from "@/lib/ventureAuth";
import {
  getInvestmentAnalytics,
  getInvestmentReportSummary,
  getPipelineAnalytics,
  getVentureMatches,
} from "@/lib/ventures";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  if (!(await isStaffActorForVenture(db, id, session))) {
    return NextResponse.json({ success: false, error: "This operation requires staff access to the Venture." }, { status: 403 });
  }
  const searchParams = new URL(req.url).searchParams;
  const type = searchParams.get("type") || "overview";

  if (type === "overview") {
    const analytics = await getInvestmentAnalytics(id);
    return NextResponse.json({ success: true, ...analytics });
  }

  if (type === "pipeline") {
    const pipeline = await getPipelineAnalytics(id);
    return NextResponse.json({ success: true, ...pipeline });
  }

  if (type === "investors") {
    const matches = await getVentureMatches(id);
    return NextResponse.json({ success: true, matches: matches.slice(0, 10) });
  }

  if (type === "export") {
    const format = searchParams.get("format") || "json";
    const report = await getInvestmentReportSummary(id);

    if (format === "csv") {
      const rows = [["KPI", "Value"]];
      for (const [kpiName, kpiValue] of Object.entries(report.kpis)) rows.push([kpiName, String(kpiValue)]);
      const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
      return new NextResponse(csv, {
        headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="investment-analytics-${id}.csv"` },
      });
    }

    return NextResponse.json({ success: true, report });
  }

  return NextResponse.json({ success: false, error: "Invalid type." }, { status: 400 });
});
