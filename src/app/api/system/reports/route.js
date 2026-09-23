import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { getSystemReports, generateSystemReport } from "@/lib/ventures";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const searchParams = new URL(req.url).searchParams;
    const type = searchParams.get("type");
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit"), 10) : undefined;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset"), 10) : undefined;

    if (type === "generate") {
      const reportType = searchParams.get("report_type");
      if (!reportType || !["daily", "weekly", "monthly"].includes(reportType)) {
        return NextResponse.json(
          { success: false, error: "Invalid report_type. Must be daily, weekly, or monthly." },
          { status: 400 }
        );
      }
      const result = await generateSystemReport(reportType);
      return NextResponse.json({ success: true, result });
    }

    const results = await getSystemReports({
      reportType: type || undefined,
      limit,
      offset,
    });
    return NextResponse.json({ success: true, results });
  }
);
