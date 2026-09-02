import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth, isSupervisorOf } from "@/lib/auth";
import { getTaskTitleById } from "@/lib/db/queries/tasks";
import {
  createBlocker,
  deleteBlocker,
  getAllBlockers,
  getBlockerById,
  getBlockersForUser,
  getOtherActiveBlockersForTask,
  getTaskForBlockerCheck,
  markTaskBlocked,
  notifySuperAdminsOfBlocker,
  resolveBlocker,
  revertTaskFromBlocked,
  updateBlockerFields,
} from "@/models/blockers";

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
    // (Phase 3B): a supervisor may also read their supervisee's blockers.
    if (session.role !== "super_admin") {
      const viewingOther = user_id && String(user_id) !== String(session.cid);
      const isSupervisor = viewingOther
        ? await isSupervisorOf(session.cid, user_id)
        : false;
      if (viewingOther && !isSupervisor) {
        return NextResponse.json(
          { success: false, error: "You can only view your own blockers." },
          { status: 403 },
        );
      }
      // Scope to blockers where the task belongs to, assigned to, or supervised
      // by the user; when acting as a supervisor, scope to the supervisee's tasks.
      const scopeCid = isSupervisor ? String(user_id) : String(session.cid);
      const result = await getBlockersForUser(scopeCid, {
        id,
        task_id,
        user_id,
        status,
        isSupervisor,
      });
      return NextResponse.json({ success: true, blockers: result.rows });
    }

    // SA: unrestricted access with optional filters
    const result = await getAllBlockers({ id, task_id, user_id, status });
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
    const taskCheck = await getTaskForBlockerCheck(task_id);

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

    const result = await createBlocker({
      task_id,
      user_id,
      user_name,
      title,
      description,
      severity,
      reference_url,
      notes,
    });

    // Auto-mark the task as blocked
    await markTaskBlocked(task_id);

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
      await notifySuperAdminsOfBlocker({
        user_name,
        user_id,
        title,
        task_title: taskTitle,
        now,
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
    const blockerCheck = await getBlockerById(id);

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

      await resolveBlocker({ id, resolvedBy: session.cid });

      // Check if the task has any other active blockers
      const activeBlockers = await getOtherActiveBlockersForTask(
        blocker.task_id,
        id,
      );

      if (activeBlockers.rows.length === 0) {
        // No more active blockers, revert task to carried_over or in_progress
        await revertTaskFromBlocked(blocker.task_id);
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

    await updateBlockerFields(id, { title, description, severity });

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
    const blockerCheck = await getBlockerById(id);

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

      await deleteBlocker(id);
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
