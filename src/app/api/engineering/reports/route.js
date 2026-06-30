import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/engineering/reports?period=week|month|quarter|year
 *
 * Returns aggregated engineering metrics for reporting.
 */
export async function GET(req) {
  try {
    const authError = await requireAuth(["super_admin", "developer"]);
    if (authError) return authError;

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
    const totalErrors = await db.execute({
      sql: "SELECT COUNT(*) as count FROM error_logs WHERE created_at >= ?",
      args: [startStr],
    });

    const resolvedErrors = await db.execute({
      sql: "SELECT COUNT(*) as count FROM error_logs WHERE created_at >= ? AND resolved = true",
      args: [startStr],
    });

    const unresolvedErrors = await db.execute({
      sql: "SELECT COUNT(*) as count FROM error_logs WHERE created_at >= ? AND (resolved IS NULL OR resolved = false)",
      args: [startStr],
    });

    // 2. Average resolution time (in hours)
    const avgResolution = await db.execute({
      sql: `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600), 0) as avg_hours
            FROM error_logs
            WHERE created_at >= ? AND resolved = true AND resolved_at IS NOT NULL`,
      args: [startStr],
    });

    // 3. Most recurring errors (grouped by message)
    const topErrors = await db.execute({
      sql: `SELECT message, COUNT(*) as count, MAX(created_at) as last_occurrence,
                   COUNT(CASE WHEN resolved = true THEN 1 END) as resolved_count,
                   MIN(severity) as severity
            FROM error_logs
            WHERE created_at >= ?
            GROUP BY message
            ORDER BY count DESC
            LIMIT 20`,
      args: [startStr],
    });

    // 4. Errors by severity
    const bySeverity = await db.execute({
      sql: `SELECT severity, COUNT(*) as count
            FROM error_logs
            WHERE created_at >= ?
            GROUP BY severity
            ORDER BY count DESC`,
      args: [startStr],
    });

    // 5. Errors by page
    const byPage = await db.execute({
      sql: `SELECT COALESCE(page, 'unknown') as page, COUNT(*) as count
            FROM error_logs
            WHERE created_at >= ?
            GROUP BY page
            ORDER BY count DESC
            LIMIT 15`,
      args: [startStr],
    });

    // 6. Weekly trend (last 8 weeks)
    const weeklyTrend = await db.execute({
      sql: `SELECT DATE_TRUNC('week', created_at) as week,
                   COUNT(*) as total,
                   SUM(CASE WHEN resolved = true THEN 1 ELSE 0 END) as resolved
            FROM error_logs
            WHERE created_at >= NOW() - INTERVAL '8 weeks'
            GROUP BY DATE_TRUNC('week', created_at)
            ORDER BY week ASC`,
    });

    // 7. Dev task stats
    const devTasks = await db.execute({
      sql: `SELECT
              COUNT(*) as total_tasks,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
              SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) as critical_tasks
            FROM tasks
            WHERE category = 'development'
              AND created_at >= ?`,
      args: [startStr],
    });

    // 8. Top buggy pages (most error-prone)
    const topPages = await db.execute({
      sql: `SELECT COALESCE(page, 'unknown') as page,
                   COUNT(*) as total_errors,
                   COUNT(DISTINCT user_id) as affected_users,
                   MAX(created_at) as last_error
            FROM error_logs
            WHERE created_at >= ?
            GROUP BY page
            ORDER BY total_errors DESC
            LIMIT 10`,
      args: [startStr],
    });

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
