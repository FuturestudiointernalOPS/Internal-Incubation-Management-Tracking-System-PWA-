import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { requireAuthorization } from "@/lib/authorization";
import { getTaskTitleById } from "@/lib/db/queries/tasks";
import { completeCarryoverAncestors } from "@/lib/taskCarryover";
import {
  findRetroReportId,
  updateRetroReport,
  createRetroReport,
  reconcileTaskStatus,
} from "@/models/retros";

/**
 * POST /api/retros/submit
 *
 * Submits a Friday retro report with task reconciliation.
 * Wraps v2_op_reports POST + task status updates in one atomic operation.
 *
 * Body: { user_id, user_name, user_role, week_number, year,
 *         completed_work, unfinished_tasks, challenges, wins, ...,
 *         reconciliation: [{ task_id, status }] }
 *
 * Status options: 'completed', 'carried_over', 'in_progress'
 */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("reports", "create");
    if (capError) return capError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const body = await req.json();
    const {
      user_id,
      user_name,
      user_role,
      week_number,
      year,
      completed_work,
      unfinished_tasks,
      challenges,
      wins,
      carryover_items,
      week_status,
      retro_notes,
      had_blockers,
      blocker_type,
      blocker_desc,
      major_achievement,
      reconciliation,
      context_type,
      context_id,
    } = body;

    if (!user_id || !week_number || !year) {
      return NextResponse.json(
        {
          success: false,
          error: "user_id, week_number, and year are required",
        },
        { status: 400 },
      );
    }

    // SECURITY (Phase 0): Non-SA users can only submit their own retro.
    if (session.role !== "super_admin" && String(user_id) !== String(session.cid)) {
      return NextResponse.json(
        { success: false, error: "You can only submit your own retro." },
        { status: 403 },
      );
    }

    // Upsert retro report
    const existing = await findRetroReportId(
      user_id,
      week_number,
      year,
      context_id,
      context_type,
    );

    let reportId;
    const reportData = {
      completed_work: completed_work || null,
      unfinished_tasks: unfinished_tasks || null,
      challenges: challenges || null,
      wins: wins || null,
      carryover_items: carryover_items || null,
      week_status: week_status || null,
      retro_notes: retro_notes || null,
      had_blockers: had_blockers != null ? (had_blockers ? 1 : 0) : null,
      blocker_type: blocker_type || null,
      blocker_desc: blocker_desc || null,
      major_achievement: major_achievement || null,
    };

    if (existing.rows.length > 0) {
      reportId = existing.rows[0].id;
      await updateRetroReport({
        reportData,
        context_type,
        context_id,
        reportId,
      });
    } else {
      const result = await createRetroReport({
        reportData,
        user_id,
        user_name,
        user_role,
        week_number,
        year,
        context_type,
        context_id,
      });
      reportId = Number(result.rows[0]?.id ?? result.lastInsertRowid);
    }

    // Process task reconciliation
    const reconciledTasks = [];
    if (reconciliation && Array.isArray(reconciliation)) {
      for (const item of reconciliation) {
        const { task_id, status } = item;
        if (!task_id || !status) continue;
        if (!["completed", "carried_over", "in_progress"].includes(status))
          continue;

        try {
          await reconcileTaskStatus(status, task_id);

          // Completing a cloned task must also complete its carried-over ancestors
          if (status === "completed") {
            await completeCarryoverAncestors(task_id);
          }

          // Audit log
          const taskTitle =
            (await getTaskTitleById(task_id)) || `Task #${task_id}`;

          await logAuditEvent({
            entity_type: "task",
            entity_id: parseInt(task_id),
            user_id,
            user_name: user_name || "",
            action:
              status === "completed"
                ? "completed"
                : status === "carried_over"
                  ? "carried_over"
                  : "updated",
            details: `Task "${taskTitle}" reconciled as ${status} (via retro)`,
            metadata: { status, retro_week: week_number, retro_year: year },
          });

          reconciledTasks.push({
            id: parseInt(task_id),
            status,
            success: true,
          });
        } catch (e) {
          reconciledTasks.push({
            id: parseInt(task_id),
            status,
            success: false,
            error: e.message,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      reportId,
      reconciledTasks,
      action: existing.rows.length > 0 ? "updated" : "created",
    });
  } catch (error) {
    console.error("POST retros/submit error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
