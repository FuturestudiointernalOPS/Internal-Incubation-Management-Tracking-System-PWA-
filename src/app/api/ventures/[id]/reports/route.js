import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess, isStaffActorForVenture } from "@/lib/ventureAuth";
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
  if (!(await isStaffActorForVenture(db, id, session))) {
    return NextResponse.json({ success: false, error: "This operation requires staff access to the Venture." }, { status: 403 });
  }
  const searchParams = new URL(req.url).searchParams;
  const type = searchParams.get("type") || "analytics";

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
      status: searchParams.get("status"),
      priority: searchParams.get("priority"),
      assigned_cid: searchParams.get("assigned_cid"),
      due_before: searchParams.get("due_before"),
      due_after: searchParams.get("due_after"),
      limit: searchParams.get("limit"),
    });
    return NextResponse.json({ success: true, tasks });
  }

  if (type === "productivity") {
    const team = await getTeamProductivity(id);
    return NextResponse.json({ success: true, team });
  }

  if (type === "export") {
    const format = searchParams.get("format") || "json";
    const exportType = searchParams.get("export_type") || "tasks";
    const data = await getExportData(id, exportType);

    if (format === "csv") {
      if (data.length === 0) return NextResponse.json({ success: true, data: [], format: "csv" });
      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(",")];
      for (const row of data) {
        csvRows.push(headers.map((header) => `"${(row[header] || "").replace(/"/g, '""')}"`).join(","));
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
