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

    const w = week_number ? parseInt(week_number) : null;
    const y = year ? parseInt(year) : null;

    // ── 1. Fetch existing standup report ──
    let report = null;
    if (w && y) {
      const reportRes = await getStandupReportByWeek(
        user_id,
        w,
        y,
        context_id,
        context_type,
      );
      if (reportRes.rows.length > 0) report = reportRes.rows[0];
    }

    // ── 2. Fetch current-week tasks ──
    // These are tasks created in the target week (owned OR assigned to the user).
    const weekTaskRes = await getStandupWeekTasks(
      user_id,
      w,
      y,
      context_type,
      context_id,
      showAll,
    );

    // ── 3. Fetch carried-over tasks (prior weeks, still active) ──
    // These are uncompleted tasks from earlier weeks that still need work.
    // If show_all is true, include ALL tasks. Otherwise only active ones.
    let carryoverTasks = [];
    if (w && y) {
      const carryRes = await getStandupCarryoverTasks(
        user_id,
        w,
        y,
        context_type,
        context_id,
        showAll,
      );
      carryoverTasks = carryRes.rows || [];
    }

    // ── 4. Merge tasks and deduplicate by ID ──
    const seenIds = new Set();
    const allTasks = [];

    for (const task of [...weekTaskRes.rows, ...carryoverTasks]) {
      if (!seenIds.has(task.id)) {
        seenIds.add(task.id);
        allTasks.push(task);
      }
    }

    // ── 5. Batch fetch blockers (1 query instead of N+1) ──
    const taskIds = allTasks.map((t) => t.id);
    let blockersByTask = {};
    if (taskIds.length > 0) {
      const blockerRes = await getBlockersByTaskIds(taskIds);
      for (const b of blockerRes.rows || []) {
        if (!blockersByTask[b.task_id]) blockersByTask[b.task_id] = [];
        blockersByTask[b.task_id].push({
          id: b.id,
          title: b.title,
          status: b.status,
          severity: b.severity,
        });
      }
    }

    const tasksWithBlockers = allTasks.map((task) => ({
      ...task,
      blockers: blockersByTask[task.id] || [],
      is_carryover:
        task.created_week !== w || task.created_year !== y,
    }));

    return NextResponse.json({
      success: true,
      report,
      tasks: tasksWithBlockers,
      weekTasks: weekTaskRes.rows.length,
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
