import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import {
  getWeeklyDevelopmentCompletionStats,
  listActiveBlockers,
  listActiveDevelopmentTasks,
  listEngineeringDevelopers,
  listOverdueDevelopmentTasks,
  listUnresolvedErrorLogs,
} from "@/models/engineering";

/**
 * GET /api/engineering/dashboard
 *
 * Returns operational data for the Head of Development dashboard.
 * Shows: active devs, assignments, overdue tasks, unresolved bugs, blockers.
 */
export async function GET(request) {
  try {
    const capError = await requireAuthorization("engineering", "view");
    if (capError) return capError;

    await initDb();

    // 1. Active Developers & Interns
    const devsRes = await listEngineeringDevelopers();

    // 2. Development tasks (tagged with category='development')
    const tasksRes = await listActiveDevelopmentTasks();

    // 3. Unresolved error logs
    const errorsRes = await listUnresolvedErrorLogs();

    // 4. Overdue development tasks
    const today = new Date().toISOString().split("T")[0];
    const overdueRes = await listOverdueDevelopmentTasks(today);

    // 5. Active blockers
    const blockerRes = await listActiveBlockers();

    // 6. Weekly completion stats for each developer
    const weekNumber = getWeekNumber(new Date());
    const year = new Date().getFullYear();

    const weeklyRes = await getWeeklyDevelopmentCompletionStats(weekNumber, year);

    return NextResponse.json({
      success: true,
      developers: devsRes.rows,
      activeTasks: tasksRes.rows,
      unresolvedErrors: errorsRes.rows,
      overdueTasks: overdueRes.rows,
      activeBlockers: blockerRes.rows,
      weeklyStats: weeklyRes.rows,
      weekNumber,
      year,
    });
  } catch (err) {
    console.error("[API engineering] GET dashboard failed:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}
