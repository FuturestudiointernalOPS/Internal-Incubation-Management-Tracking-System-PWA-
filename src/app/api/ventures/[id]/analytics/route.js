import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";
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
  const s = new URL(req.url).searchParams;
  const type = s.get("type") || "overview";

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
    const format = s.get("format") || "json";
    const report = await getInvestmentReportSummary(id);

    if (format === "csv") {
      const rows = [["KPI", "Value"]];
      for (const [k, v] of Object.entries(report.kpis)) rows.push([k, String(v)]);
      const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
      return new NextResponse(csv, {
        headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="investment-analytics-${id}.csv"` },
      });
    }

    return NextResponse.json({ success: true, report });
  }

  return NextResponse.json({ success: false, error: "Invalid type." }, { status: 400 });
});
