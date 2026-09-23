import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, isSupervisorOf } from "@/lib/auth";
import {
  getRetroReportByWeek,
  getRetroActiveTasks,
  getBlockersByTaskIds,
} from "@/models/retros";

/**
 * GET /api/retros/current?user_id=X&week=12&year=2026&context_type=staff&context_id=X
 *
 * Returns the current week's retro report and active tasks.
 * SECURITY (Phase 0): Non-SA users can only view their own retro.
 * Unified (Phase 6): Supports context filtering.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");
    const week_number = searchParams.get("week");
    const year = searchParams.get("year");
    const context_type = searchParams.get("context_type") || "staff";
    const context_id = searchParams.get("context_id") || null;

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 },
      );
    }

    // SECURITY (Phase 0): Non-SA users can only view their own retro.
    // (Phase 3B): a supervisor may also view their supervisee's retro (read-only).
    if (
      session.role !== "super_admin" &&
      String(user_id) !== String(session.cid) &&
      !(await isSupervisorOf(session.cid, user_id))
    ) {
      return NextResponse.json(
        { success: false, error: "You can only view your own retro." },
        { status: 403 },
      );
    }

    const weekNumber = week_number ? parseInt(week_number) : null;
    const yearNumber = year ? parseInt(year) : null;

    let report = null;
    if (weekNumber && yearNumber) {
      const reportResult = await getRetroReportByWeek(
        user_id,
        weekNumber,
        yearNumber,
        context_id,
        context_type,
      );
      if (reportResult.rows.length > 0) report = reportResult.rows[0];
    }

    const taskResult = await getRetroActiveTasks(user_id);

    // Batch fetch blockers (2 queries instead of N+1)
    const taskIds = taskResult.rows.map((task) => task.id);
    let blockersByTask = {};
    if (taskIds.length > 0) {
      const blockersResult = await getBlockersByTaskIds(taskIds);
      for (const blocker of blockersResult.rows || []) {
        if (!blockersByTask[blocker.task_id]) blockersByTask[blocker.task_id] = [];
        blockersByTask[blocker.task_id].push({ id: blocker.id, title: blocker.title, status: blocker.status, severity: blocker.severity });
      }
    }

    const tasks = taskResult.rows.map((task) => ({
      ...task,
      blockers: blockersByTask[task.id] || [],
    }));

    return NextResponse.json({ success: true, report, tasks });
  } catch (error) {
    console.error("GET retros/current error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
