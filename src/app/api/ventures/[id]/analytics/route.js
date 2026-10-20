import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { isStaffActorForVenture } from "@/lib/ventureAuth";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { getPipelineAnalytics } from "@/services/ventures/fundraising";
import { getInvestmentAnalytics, getInvestmentReportSummary } from "@/services/ventures/investmentAnalytics";
import { getVentureMatches } from "@/services/ventures/investorMatching";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) return access.error;
  const { session } = access;
  if (!(await isStaffActorForVenture(id, session))) {
    return NextResponse.json({ success: false, error: "errors.ventureStaffOnly" }, { status: 403 });
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
