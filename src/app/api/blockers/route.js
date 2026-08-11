import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { getTaskTitleById } from "@/lib/db/queries/tasks";

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
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const { searchParams } = new URL(req.url);
    const task_id = searchParams.get("task_id");
    const user_id = searchParams.get("user_id");
    const status = searchParams.get("status");
    const id = searchParams.get("id");

    // SECURITY (Phase 0): Non-SA users can only see blockers on their own tasks
    // or tasks assigned to them.
    if (session.role !== "super_admin") {
      if (user_id && String(user_id) !== String(session.cid)) {
        return NextResponse.json(
          { success: false, error: "You can only view your own blockers." },
          { status: 403 },
        );
      }
      // Scope to blockers where the task belongs to, assigned to, or supervised by the user
      let sql = `SELECT b.* FROM blockers b
        JOIN tasks t ON b.task_id = t.id
        WHERE (t.user_id = ? OR t.assigned_to = ? OR t.supervisor_id = ?)`;
      const args = [String(session.cid), String(session.cid), String(session.cid)];

      if (id) {
        sql += " AND b.id = ?";
        args.push(parseInt(id));
      }
      if (task_id) {
        sql += " AND b.task_id = ?";
        args.push(parseInt(task_id));
      }
      if (user_id) {
        sql += " AND b.user_id = ?";
        args.push(user_id);
      }
      if (status) {
        sql += " AND b.status = ?";
        args.push(status);
      }
      sql += " ORDER BY b.created_at DESC";

      const result = await db.execute({ sql, args });
      return NextResponse.json({ success: true, blockers: result.rows });
    }

    // SA: unrestricted access with optional filters
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
    const {
      task_id,
      user_id,
      user_name,
      title,
      description,
      severity,
      reference_url,
      notes,
    } = body;

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
      sql: "SELECT id, status, user_id, assigned_to, supervisor_id FROM tasks WHERE id = ?",
      args: [parseInt(task_id)],
    });

    if (taskCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 },
      );
    }

    const task = taskCheck.rows[0];

    // SECURITY: Only task owner, assignee, supervisor, or SA can add a blocker
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (
      session.role !== "super_admin" &&
      String(task.user_id) !== String(session.cid) &&
      String(task.assigned_to || "") !== String(session.cid) &&
      String(task.supervisor_id || "") !== String(session.cid)
    ) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to add a blocker to this task." },
        { status: 403 },
      );
    }
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
        (task_id, user_id, user_name, title, description, severity, reference_url, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [
        parseInt(task_id),
        user_id,
        user_name || "",
        title,
        description || null,
        severity || "medium",
        reference_url || null,
        notes || null,
      ],
    });

    // Auto-mark the task as blocked
    await db.execute({
      sql: "UPDATE tasks SET status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'blocked'",
      args: [parseInt(task_id)],
    });

    const blockerId = Number(result.rows[0]?.id ?? result.lastInsertRowid);

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

    // Notify all Super Admins (direct DB insert, recipient_id = "sa" for bell)
    try {
      const taskTitle =
        (await getTaskTitleById(parseInt(task_id))) || `#${task_id}`;
      const now = new Date().toISOString().split("T")[0];
      await db.execute({
        sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
        args: [
          "sa",
          "New Blocker Created",
          `${user_name || user_id} added blocker "${title}" on task "${taskTitle}" (${now})`,
          "blocker",
        ],
      });
    } catch (_) {
      // Notifications are non-blocking
    }

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
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const body = await req.json();
    const { id, title, description, severity, status } = body;

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

    // Resolving a blocker: only the blocker creator may resolve
    if (status === "resolved") {
      if (String(blocker.user_id) !== String(session.cid)) {
        return NextResponse.json(
          {
            success: false,
            error: "Only the blocker creator can mark it as resolved",
          },
          { status: 403 },
        );
      }

      await db.execute({
        sql: "UPDATE blockers SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ?",
        args: [session.cid, parseInt(id)],
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
        user_id: session.cid,
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

    // Non-resolve updates: only creator can edit (using session identity)
    if (String(blocker.user_id) !== String(session.cid)) {
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
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

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

      // SECURITY: Only creator or SA can delete (using session identity)
      if (
        session.role !== "super_admin" &&
        String(blocker.user_id) !== String(session.cid)
      ) {
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
