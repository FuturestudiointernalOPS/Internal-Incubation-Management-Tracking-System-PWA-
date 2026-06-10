import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/tasks/reconcile
 *
 * Batch reconcile tasks during retro submission.
 * Body: { user_id, user_name, tasks: [{ id, status, force_complete }] }
 *
 * Status options: 'completed', 'carried_over', 'in_progress' (for partially completed)
 *
 * Uses same-task-record persist rule — no duplicates created.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { user_id, user_name, tasks } = await req.json();

    if (!user_id || !tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { success: false, error: "user_id and tasks array are required" },
        { status: 400 },
      );
    }

    const results = [];

    for (const task of tasks) {
      const { id, status, force_complete } = task;

      if (!id || !status) {
        results.push({ id, success: false, error: "id and status required" });
        continue;
      }

      if (!["completed", "carried_over", "in_progress"].includes(status)) {
        results.push({
          id,
          success: false,
          error: `Invalid status: ${status}`,
        });
        continue;
      }

      try {
        const updateBody = { id, user_id, user_name, status };
        if (force_complete) updateBody.force_complete = true;

        // Fetch current task for audit
        const currentTask = await db.execute({
          sql: "SELECT title FROM tasks WHERE id = ?",
          args: [parseInt(id)],
        });

        const taskTitle = currentTask.rows[0]?.title || `Task #${id}`;

        // Update via the existing PUT logic by calling through DB directly
        const updateFields = ["status = ?", "updated_at = CURRENT_TIMESTAMP"];
        const updateArgs = [status, parseInt(id)];

        if (status === "completed") {
          updateFields.push("completed_at = CURRENT_TIMESTAMP");
        }

        await db.execute({
          sql: `UPDATE tasks SET ${updateFields.join(", ")} WHERE id = ?`,
          args: updateArgs,
        });

        // Audit log
        await logAuditEvent({
          entity_type: "task",
          entity_id: parseInt(id),
          user_id,
          user_name: user_name || "",
          action:
            status === "completed"
              ? "completed"
              : status === "carried_over"
                ? "carried_over"
                : "updated",
          details: `Task "${taskTitle}" reconciled as ${status}`,
          metadata: { status },
        });

        results.push({ id, success: true, status });
      } catch (e) {
        results.push({ id, success: false, error: e.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("POST reconcile error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
