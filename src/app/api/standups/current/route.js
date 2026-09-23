import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, isSupervisorOf } from "@/lib/auth";
import {
  getStandupReportByWeek,
  getStandupWeekTasks,
  getStandupCarryoverTasks,
  getBlockersByTaskIds,
} from "@/models/standups";

/**
 * GET /api/standups/current
 *
 * UNIFIED STANDUP ENGINE (Phase 3)
 *
 * Query params:
 *   user_id       — required. The user whose standup to fetch.
 *   week, year    — required. The target week.
 *   context_type  — optional. 'staff', 'venture', or 'participant'.
 *   context_id    — optional. venture_id, program_id, or null.
 *   show_all      — include completed/archived tasks in the week view.
 *
 * Behavior:
 *   - Returns the standup report (from v2_op_reports) for the given user/week.
 *   - Returns ALL active tasks for the user (owned OR assigned),
 *     regardless of which week they were created in.
 *     Completed/archived tasks that match the target week are included
 *     for historical reference when show_all=true.
 *   - Tasks from prior weeks stay visible until completed — auto carry-over.
 *
 * Security:
 *   - Non-SA users can only view their own standup.
 *   - SA can view any standup (internal org oversight).
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
    const showAll = searchParams.get("show_all") === "true";
    const context_type = searchParams.get("context_type") || "staff";
    const context_id = searchParams.get("context_id") || null;

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 },
      );
    }

    // SECURITY (Phase 0): Non-SA users can only view their own standup.
    // (Phase 3B): a supervisor may also view their supervisee's standup (read-only).
    if (
      session.role !== "super_admin" &&
      String(user_id) !== String(session.cid) &&
      !(await isSupervisorOf(session.cid, user_id))
    ) {
      return NextResponse.json(
        { success: false, error: "You can only view your own standup." },
        { status: 403 },
      );
    }

    const weekNumber = week_number ? parseInt(week_number) : null;
    const yearNumber = year ? parseInt(year) : null;

    // ── 1. Fetch existing standup report ──
    let report = null;
    if (weekNumber && yearNumber) {
      const reportResult = await getStandupReportByWeek(
        user_id,
        weekNumber,
        yearNumber,
        context_id,
        context_type,
      );
      if (reportResult.rows.length > 0) report = reportResult.rows[0];
    }

    // ── 2. Fetch current-week tasks ──
    // These are tasks created in the target week (owned OR assigned to the user).
    const weekTasksResult = await getStandupWeekTasks(
      user_id,
      weekNumber,
      yearNumber,
      context_type,
      context_id,
      showAll,
    );

    // ── 3. Fetch carried-over tasks (prior weeks, still active) ──
    // These are uncompleted tasks from earlier weeks that still need work.
    // If show_all is true, include ALL tasks. Otherwise only active ones.
    let carryoverTasks = [];
    if (weekNumber && yearNumber) {
      const carryoverResult = await getStandupCarryoverTasks(
        user_id,
        weekNumber,
        yearNumber,
        context_type,
        context_id,
        showAll,
      );
      carryoverTasks = carryoverResult.rows || [];
    }

    // ── 4. Merge tasks and deduplicate by ID ──
    const seenIds = new Set();
    const allTasks = [];

    for (const task of [...weekTasksResult.rows, ...carryoverTasks]) {
      if (!seenIds.has(task.id)) {
        seenIds.add(task.id);
        allTasks.push(task);
      }
    }

    // ── 5. Batch fetch blockers (1 query instead of N+1) ──
    const taskIds = allTasks.map((task) => task.id);
    let blockersByTask = {};
    if (taskIds.length > 0) {
      const blockersResult = await getBlockersByTaskIds(taskIds);
      for (const blocker of blockersResult.rows || []) {
        if (!blockersByTask[blocker.task_id]) blockersByTask[blocker.task_id] = [];
        blockersByTask[blocker.task_id].push({
          id: blocker.id,
          title: blocker.title,
          status: blocker.status,
          severity: blocker.severity,
        });
      }
    }

    const tasksWithBlockers = allTasks.map((task) => ({
      ...task,
      blockers: blockersByTask[task.id] || [],
      is_carryover:
        task.created_week !== weekNumber || task.created_year !== yearNumber,
    }));

    return NextResponse.json({
      success: true,
      report,
      tasks: tasksWithBlockers,
      weekTasks: weekTasksResult.rows.length,
      carryoverTasks: carryoverTasks.length,
      totalTasks: tasksWithBlockers.length,
      context: { context_type, context_id },
    });
  } catch (error) {
    console.error("GET standups/current error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
