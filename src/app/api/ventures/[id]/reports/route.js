import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { isStaffActorForVenture } from "@/lib/ventureAuth";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { getSession } from "@/server/auth/session";
import { hasHistoricalVentureAccess } from "@/services/authorization/historicalReadScope";
import { resolveVentureDbId } from "@/lib/ventureOwnership";
import { getVentureAnalytics, getMilestonesReport, getTasksReport, getTeamProductivity, getExportData } from "@/services/ventures/analytics";

/**
 * GET /api/ventures/[id]/reports?type=analytics|milestones|tasks|productivity|export&format=csv
 */
export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  // The canonical read gate, plus D1 — an ex-manager keeps a READ-ONLY
  // consultation of the Venture they ran (documents and reports). It never
  // authorises a write: only GET reaches here. The fallback only applies to a
  // real refusal (403), never to a 401 or a system failure.
  let session = null;
  let historyOnly = false;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) {
    if (access.error.status !== 403) return access.error;
    const viewer = await getSession();
    if (viewer && (await hasHistoricalVentureAccess(viewer.cid, id))) {
      session = viewer;
      historyOnly = true;
    } else {
      return access.error;
    }
  } else {
    session = access.session;
  }
  if (!historyOnly && !(await isStaffActorForVenture(id, session))) {
    return NextResponse.json({ success: false, error: "errors.ventureStaffOnly" }, { status: 403 });
  }
  const searchParams = new URL(req.url).searchParams;
  const type = searchParams.get("type") || "analytics";

  // The report queries key on the Venture's internal id, not the VNT-… code the
  // address carries: handing them the code failed every report with a 500.
  const dbId = await resolveVentureDbId(id);
  if (!dbId) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  if (type === "analytics") {
    const data = await getVentureAnalytics(dbId);
    return NextResponse.json({ success: true, ...data });
  }

  if (type === "milestones") {
    const milestones = await getMilestonesReport(dbId);
    return NextResponse.json({ success: true, milestones });
  }

  if (type === "tasks") {
    const tasks = await getTasksReport(dbId, {
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
    const team = await getTeamProductivity(dbId);
    return NextResponse.json({ success: true, team });
  }

  if (type === "export") {
    const format = searchParams.get("format") || "json";
    const exportType = searchParams.get("export_type") || "tasks";
    const data = await getExportData(dbId, exportType);

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
