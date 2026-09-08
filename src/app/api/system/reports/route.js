import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { getSystemReports, generateSystemReport } from "@/lib/ventures";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const s = new URL(req.url).searchParams;
    const type = s.get("type");
    const limit = s.get("limit") ? parseInt(s.get("limit"), 10) : undefined;
    const offset = s.get("offset") ? parseInt(s.get("offset"), 10) : undefined;

    if (type === "generate") {
      const reportType = s.get("report_type");
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
