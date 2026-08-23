import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";
import {
  getVentureAnalytics,
  getMilestonesReport,
  getTasksReport,
  getTeamProductivity,
  getExportData,
} from "@/lib/ventures";

/**
 * GET /api/ventures/[id]/reports?type=analytics|milestones|tasks|productivity|export&format=csv
 */
export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const s = new URL(req.url).searchParams;
  const type = s.get("type") || "analytics";

  if (type === "analytics") {
    const data = await getVentureAnalytics(id);
    return NextResponse.json({ success: true, ...data });
  }

  if (type === "milestones") {
    const milestones = await getMilestonesReport(id);
    return NextResponse.json({ success: true, milestones });
  }

  if (type === "tasks") {
    const tasks = await getTasksReport(id, {
      status: s.get("status"),
      priority: s.get("priority"),
      assigned_cid: s.get("assigned_cid"),
      due_before: s.get("due_before"),
      due_after: s.get("due_after"),
      limit: s.get("limit"),
    });
    return NextResponse.json({ success: true, tasks });
  }

  if (type === "productivity") {
    const team = await getTeamProductivity(id);
    return NextResponse.json({ success: true, team });
  }

  if (type === "export") {
    const format = s.get("format") || "json";
    const exportType = s.get("export_type") || "tasks";
    const data = await getExportData(id, exportType);

    if (format === "csv") {
      if (data.length === 0) return NextResponse.json({ success: true, data: [], format: "csv" });
      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(",")];
      for (const row of data) {
        csvRows.push(headers.map((h) => `"${(row[h] || "").replace(/"/g, '""')}"`).join(","));
      }
      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="ventures-${exportType}-${id}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, data, format: "json" });
  }

  return NextResponse.json({ success: false, error: "Invalid report type." }, { status: 400 });
});
