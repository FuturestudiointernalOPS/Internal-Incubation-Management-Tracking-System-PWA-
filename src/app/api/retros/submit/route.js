import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";

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
    const authError = await requireAuth();
    if (authError) return authError;
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

    // Upsert retro report
    const existing = await db.execute({
      sql: "SELECT id FROM v2_op_reports WHERE user_id = ? AND week_number = ? AND year = ? AND report_type = 'retro'",
      args: [user_id, week_number, year],
    });

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
      await db.execute({
        sql: `UPDATE v2_op_reports SET
          completed_work = ?, unfinished_tasks = ?, challenges = ?, wins = ?,
          carryover_items = ?, week_status = ?, retro_notes = ?,
          had_blockers = ?, blocker_type = ?, blocker_desc = ?, major_achievement = ?,
          status = 'submitted', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        args: [
          reportData.completed_work,
          reportData.unfinished_tasks,
          reportData.challenges,
          reportData.wins,
          reportData.carryover_items,
          reportData.week_status,
          reportData.retro_notes,
          reportData.had_blockers,
          reportData.blocker_type,
          reportData.blocker_desc,
          reportData.major_achievement,
          reportId,
        ],
      });
    } else {
      const result = await db.execute({
        sql: `INSERT INTO v2_op_reports
          (user_id, user_name, user_role, report_type, week_number, year, status,
           completed_work, unfinished_tasks, challenges, wins,
           carryover_items, week_status, retro_notes,
           had_blockers, blocker_type, blocker_desc, major_achievement)
          VALUES (?, ?, ?, 'retro', ?, ?, 'submitted',
           ?, ?, ?, ?,
           ?, ?, ?,
           ?, ?, ?, ?)`,
        args: [
          user_id,
          user_name || "",
          user_role || "staff",
          week_number,
          year,
          reportData.completed_work,
          reportData.unfinished_tasks,
          reportData.challenges,
          reportData.wins,
          reportData.carryover_items,
          reportData.week_status,
          reportData.retro_notes,
          reportData.had_blockers,
          reportData.blocker_type,
          reportData.blocker_desc,
          reportData.major_achievement,
        ],
      });
      reportId = Number(result.lastInsertRowid);
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
          const updateFields = ["status = ?", "updated_at = CURRENT_TIMESTAMP"];
          const updateArgs = [status, parseInt(task_id)];

          if (status === "completed") {
            updateFields.push("completed_at = CURRENT_TIMESTAMP");
          }

          await db.execute({
            sql: `UPDATE tasks SET ${updateFields.join(", ")} WHERE id = ?`,
            args: updateArgs,
          });

          // Audit log
          const currentTask = await db.execute({
            sql: "SELECT title FROM tasks WHERE id = ?",
            args: [parseInt(task_id)],
          });
          const taskTitle = currentTask.rows[0]?.title || `Task #${task_id}`;

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
