import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";

/**
 * BLOCKERS API
 *
 * GET    /api/blockers?task_id=X&user_id=X&status=active
 *   - Returns blockers, filtered by query params
 *
 * POST   /api/blockers
 *   - Creates a new blocker (must be tied to a task)
 *
 * PUT    /api/blockers
 *   - Updates a blocker (only creator can resolve)
 *
 * DELETE /api/blockers?id=X
 *   - Deletes a blocker by ID
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const task_id = searchParams.get("task_id");
    const user_id = searchParams.get("user_id");
    const status = searchParams.get("status");
    const id = searchParams.get("id");

    let sql = "SELECT * FROM blockers WHERE 1=1";
    const args = [];

    if (id) {
      sql += " AND id = ?";
      args.push(parseInt(id));
    }

    if (task_id) {
      sql += " AND task_id = ?";
      args.push(parseInt(task_id));
    }

    if (user_id) {
      sql += " AND user_id = ?";
      args.push(user_id);
    }

    if (status) {
      sql += " AND status = ?";
      args.push(status);
    }

    sql += " ORDER BY created_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, blockers: result.rows });
  } catch (error) {
    console.error("GET blockers error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const body = await req.json();
    const { task_id, user_id, user_name, title, description, severity } = body;

    if (!task_id || !user_id || !title) {
      return NextResponse.json(
        {
          success: false,
          error: "task_id, user_id, and title are required",
        },
        { status: 400 },
      );
    }

    // Verify the task exists and is not closed
    const taskCheck = await db.execute({
      sql: "SELECT id, status FROM tasks WHERE id = ?",
      args: [parseInt(task_id)],
    });

    if (taskCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 },
      );
    }

    const task = taskCheck.rows[0];
    const closedStatuses = ["completed", "archived", "carried_over"];
    if (closedStatuses.includes(task.status)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot add a blocker to a closed task. The task is already " +
            task.status +
            ".",
        },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: `INSERT INTO blockers
        (task_id, user_id, user_name, title, description, severity)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        parseInt(task_id),
        user_id,
        user_name || "",
        title,
        description || null,
        severity || "medium",
      ],
    });

    // Auto-mark the task as blocked
    await db.execute({
      sql: "UPDATE tasks SET status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'blocked'",
      args: [parseInt(task_id)],
    });

    const blockerId = Number(result.lastInsertRowid);

    // Audit log: Blocker Created
    await logAuditEvent({
      entity_type: "blocker",
      entity_id: blockerId,
      user_id,
      user_name: user_name || "",
      action: "created",
      details: `Blocker "${title}" created for task #${task_id}`,
      metadata: { title, task_id, severity: severity || "medium" },
    });

    return NextResponse.json({
      success: true,
      id: blockerId,
      action: "created",
    });
  } catch (error) {
    console.error("POST blockers error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const body = await req.json();
    const { id, user_id, title, description, severity, status, resolved_by } =
      body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    // Fetch the blocker to check ownership
    const blockerCheck = await db.execute({
      sql: "SELECT * FROM blockers WHERE id = ?",
      args: [parseInt(id)],
    });

    if (blockerCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Blocker not found" },
        { status: 404 },
      );
    }

    const blocker = blockerCheck.rows[0];

    // Resolving a blocker: the blocker creator OR the task owner can resolve
    if (status === "resolved") {
      // Fetch task owner to check if resolver is the task owner
      const taskOwnerRes = await db.execute({
        sql: "SELECT user_id FROM tasks WHERE id = ?",
        args: [blocker.task_id],
      });
      const taskOwnerId = taskOwnerRes.rows[0]?.user_id;

      const isBlockerCreator = !resolved_by || resolved_by === blocker.user_id;
      const isTaskOwner = resolved_by && resolved_by === taskOwnerId;

      if (!isBlockerCreator && !isTaskOwner) {
        return NextResponse.json(
          {
            success: false,
            error: "Only the blocker creator or the task owner can mark it as resolved",
          },
          { status: 403 },
        );
      }

      await db.execute({
        sql: "UPDATE blockers SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ?",
        args: [resolved_by || blocker.user_id, parseInt(id)],
      });

      // Check if the task has any other active blockers
      const activeBlockers = await db.execute({
        sql: "SELECT id FROM blockers WHERE task_id = ? AND status = 'active' AND id != ?",
        args: [blocker.task_id, parseInt(id)],
      });

      if (activeBlockers.rows.length === 0) {
        // No more active blockers, revert task to carried_over or in_progress
        await db.execute({
          sql: "UPDATE tasks SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'blocked'",
          args: [blocker.task_id],
        });
      }

      // Audit log: Blocker Resolved
      await logAuditEvent({
        entity_type: "blocker",
        entity_id: parseInt(id),
        user_id: resolved_by || blocker.user_id,
        user_name: blocker.user_name || "",
        action: "resolved",
        details: `Blocker "${blocker.title}" resolved`,
        metadata: { title: blocker.title, task_id: blocker.task_id },
      });

      return NextResponse.json({
        success: true,
        action: "resolved",
      });
    }

    // Non-resolve updates: only creator can edit
    if (user_id && user_id !== blocker.user_id) {
      return NextResponse.json(
        { success: false, error: "Only the blocker creator can edit it" },
        { status: 403 },
      );
    }

    const updateFields = [];
    const updateArgs = [];

    if (title !== undefined) {
      updateFields.push("title = ?");
      updateArgs.push(title);
    }
    if (description !== undefined) {
      updateFields.push("description = ?");
      updateArgs.push(description);
    }
    if (severity !== undefined) {
      updateFields.push("severity = ?");
      updateArgs.push(severity);
    }

    if (updateFields.length > 0) {
      updateArgs.push(parseInt(id));
      await db.execute({
        sql: `UPDATE blockers SET ${updateFields.join(", ")} WHERE id = ?`,
        args: updateArgs,
      });
    }

    return NextResponse.json({
      success: true,
      action: "updated",
    });
  } catch (error) {
    console.error("PUT blockers error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const user_id = searchParams.get("user_id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id query parameter is required" },
        { status: 400 },
      );
    }

    // Fetch blocker to check ownership
    const blockerCheck = await db.execute({
      sql: "SELECT * FROM blockers WHERE id = ?",
      args: [parseInt(id)],
    });

    if (blockerCheck.rows.length > 0) {
      const blocker = blockerCheck.rows[0];

      // Only creator can delete
      if (user_id && user_id !== blocker.user_id) {
        return NextResponse.json(
          { success: false, error: "Only the blocker creator can delete it" },
          { status: 403 },
        );
      }

      await db.execute({
        sql: "DELETE FROM blockers WHERE id = ?",
        args: [parseInt(id)],
      });
    }

    return NextResponse.json({
      success: true,
      action: "deleted",
    });
  } catch (error) {
    console.error("DELETE blockers error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
