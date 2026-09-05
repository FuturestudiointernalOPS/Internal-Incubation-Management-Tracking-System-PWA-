import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import {
  countErrorLogsSince,
  countErrorsByPage,
  countErrorsBySeverity,
  countResolvedErrorLogsSince,
  countUnresolvedErrorLogsSince,
  getAverageErrorResolutionHours,
  getDevelopmentTaskStats,
  getWeeklyErrorTrend,
  listMostRecurringErrors,
  listTopErrorPronePages,
} from "@/models/engineering";

/**
 * GET /api/engineering/reports?period=week|month|quarter|year
 *
 * Returns aggregated engineering metrics for reporting.
 */
export async function GET(req) {
  try {
    const capError = await requireAuthorization("engineering", "view");
    if (capError) return capError;

    await initDb();
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "month";

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // month
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const startStr = startDate.toISOString();

    // 1. Error summary
    const totalErrors = await countErrorLogsSince(startStr);

    const resolvedErrors = await countResolvedErrorLogsSince(startStr);

    const unresolvedErrors = await countUnresolvedErrorLogsSince(startStr);

    // 2. Average resolution time (in hours)
    const avgResolution = await getAverageErrorResolutionHours(startStr);

    // 3. Most recurring errors (grouped by message)
    const topErrors = await listMostRecurringErrors(startStr);

    // 4. Errors by severity
    const bySeverity = await countErrorsBySeverity(startStr);

    // 5. Errors by page
    const byPage = await countErrorsByPage(startStr);

    // 6. Weekly trend (last 8 weeks)
    const weeklyTrend = await getWeeklyErrorTrend();

    // 7. Dev task stats
    const devTasks = await getDevelopmentTaskStats(startStr);

    // 8. Top buggy pages (most error-prone)
    const topPages = await listTopErrorPronePages(startStr);

    const total = parseInt(totalErrors.rows[0]?.count || 0);
    const resolved = parseInt(resolvedErrors.rows[0]?.count || 0);
    const unresolved = parseInt(unresolvedErrors.rows[0]?.count || 0);
    const avgHours = parseFloat(avgResolution.rows[0]?.avg_hours || 0).toFixed(1);

    return NextResponse.json({
      success: true,
      period,
      summary: {
        total,
        resolved,
        unresolved,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
        avgResolutionHours: parseFloat(avgHours),
      },
      topErrors: topErrors.rows,
      bySeverity: bySeverity.rows,
      byPage: byPage.rows,
      weeklyTrend: weeklyTrend.rows,
      devTasks: devTasks.rows[0] || { total_tasks: 0, completed_tasks: 0, critical_tasks: 0 },
      topPages: topPages.rows,
    });
  } catch (err) {
    console.error("[Engineering Reports] GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
