import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAuditEvent, isTaskLocked } from "@/lib/audit";
import { logTaskEvent, ACTION_TYPES } from "@/lib/taskAudit";
import { requireAuth } from "@/lib/auth";
import { completeCarryoverAncestors } from "@/lib/taskCarryover";
import {
  getTaskById,
  getTaskTitleById,
  getTaskEndDateById,
} from "@/lib/db/queries/tasks";
import {
  completeSubtasks,
  countIncompleteSubtasks,
  getActiveBlockersForTask,
  getActiveBlockersForTaskWithTitle,
  getActiveBlockersOnSubtasks,
  getActiveSuperAdminCids,
  getContactNameByCid,
  getIntentResponsibleId,
  getPendingAssignmentId,
  getProjectMembership,
  getTaskEndDateRowById,
  incrementTaskRescheduleCount,
  insertNotification,
  insertNotificationWithCreatedAt,
  insertProjectApprovalRequest,
  insertTaskAssignment,
  insertTaskAuditLog,
  markTaskCompleted,
  reopenCompletedTask,
  reopenCompletedSubtasks,
  updateTaskEndDate,
  updateTaskFields,
} from "@/models/tasks";
import { listTasks } from "@/services/tasks/query";
import { deleteTaskRecord } from "@/services/tasks/remove";
import { respondToPendingAssignment } from "@/services/tasks/assignments";
import { createTaskRecord } from "@/services/tasks/create";
import { isValidDateStr } from "@/services/tasks/dates";

/**
 * TASKS API
 *
 * GET   /api/tasks?user_id=X&status=in_progress&week=12&year=2026
 * POST  /api/tasks
 * PUT   /api/tasks
 * DELETE /api/tasks?id=X
 *
 * Locking Rule (Phase 6):
 *   After 12 hours, task title/description cannot be modified and task cannot be deleted.
 *   Status updates, progress updates, and blocker updates are still allowed.
 *
 * Audit Trail (Phase 10):
 *   All lifecycle events are logged.
 */

/**
 * Roles that may set the MANAGEMENT fields of a task. `supervisor_id` grants
 * read/edit access to a task, so setting it is a management action: a
 * participant must not be able to grant supervision, to themselves or to
 * anyone else.
 */
const STAFF_SIDE_ROLES = ["super_admin", "staff", "program_manager"];

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

    const result = await listTasks({
      userId: searchParams.get("user_id"),
      assignedTo: searchParams.get("assigned_to"),
      projectId: searchParams.get("project_id"),
      status: searchParams.get("status"),
      weekNumber: searchParams.get("week"),
      year: searchParams.get("year"),
      id: searchParams.get("id"),
      sort: searchParams.get("sort"),
      limit: searchParams.get("limit"),
      brief: searchParams.get("brief") === "true",
      priority: searchParams.get("priority"),
      role: session.role,
      sessionCid: session.cid,
    });

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("GET tasks error:", error);
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
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    const body = await req.json();

    if (!body.user_id || !body.title || !body.created_week || !body.created_year) {
      return NextResponse.json(
        {
          success: false,
          error: "user_id, title, created_week, and created_year are required",
        },
        { status: 400 },
      );
    }

    const result = await createTaskRecord({
      input: body,
      role: session.role,
      sessionCid: session.cid,
    });
    if (result.error) {
      return NextResponse.json(
        result.body || { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST tasks error:", error);
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
    const {
      id,
      title,
      description,
      status,
      project_id,
      user_id,
      user_name,
      start_date,
      end_date,
      assigned_to,
      link,
      priority,
      force_complete,
      context_type,
      context_id,
      supervisor_id,
      intent_id,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    // Fetch current task state
    const task = await getTaskById(id);

    if (!task) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 },
      );
    }

    // SECURITY (Phase 0/6): Only the task owner, assignee, supervisor, or SA can update.
    const sessionCid = String(session.cid);
    if (
      session.role !== "super_admin" &&
      String(task.user_id) !== sessionCid &&
      String(task.assigned_to || "") !== sessionCid &&
      String(task.supervisor_id || "") !== sessionCid
    ) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to update this task." },
        { status: 403 },
      );
    }

    const locked = await isTaskLocked(id);

    const updateFields = [];
    const updateArgs = [];
    const changes = [];

    // Ownership enforcement: only the task creator or super_admin can change status
    if (link !== undefined && link !== task.link) {
      updateFields.push("link = ?");
      updateArgs.push(link || null);
      changes.push("link updated");
    }
    if (
      priority !== undefined &&
      ["critical", "high", "medium", "low"].includes(priority) &&
      priority !== task.priority
    ) {
      updateFields.push("priority = ?");
      updateArgs.push(priority);
      changes.push(`priority changed to ${priority}`);
    }
    if (status !== undefined && status !== task.status) {
      const effectiveUserId = user_id || session.cid;
      if (
        session.role !== "super_admin" &&
        String(effectiveUserId) !== String(task.user_id) &&
        String(effectiveUserId) !== String(task.assigned_to || "")
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Only the task creator or assignee can change its status.",
          },
          { status: 403 },
        );
      }
    }

    // Phase 6: Locking enforcement
    if (locked) {
      // Title and description cannot be modified when locked
      if (title !== undefined && title !== task.title) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Task is locked (older than 12 hours). Title cannot be modified.",
            locked: true,
          },
          { status: 403 },
        );
      }
      if (description !== undefined && description !== task.description) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Task is locked (older than 12 hours). Description cannot be modified.",
            locked: true,
          },
          { status: 403 },
        );
      }
    }

    // Phase 5/7: Task completion protection
    if (status === "completed") {
      const activeBlockers = await getActiveBlockersForTaskWithTitle(parseInt(id));

      // Also check blockers on subtasks (Rule 25)
      const subtaskBlockers = await getActiveBlockersOnSubtasks(parseInt(id));

      const allBlockers = [
        ...activeBlockers.rows.map((blocker) => ({ ...blocker, source: "task" })),
        ...subtaskBlockers.rows.map((blocker) => ({ ...blocker, source: "subtask" })),
      ];

      if (allBlockers.length > 0) {
        if (!force_complete) {
          return NextResponse.json({
            success: false,
            error:
              "This task has active blockers. Please confirm completion or resolve the blocker before proceeding.",
            hasActiveBlockers: true,
            blockers: allBlockers,
          });
        }
      }
    }

    // Carry-over safety (Phase 1): a completed task must never be flipped back
    // to 'carried_over' — that is what made finished tasks reappear as
    // carry-overs in the weekly stand-up/retro flow.
    if (status === "carried_over" && task.status === "completed") {
      return NextResponse.json(
        {
          success: false,
          error: "Completed tasks cannot be marked as carried over.",
        },
        { status: 409 },
      );
    }

    let auditAction = "updated";
    let auditDetails = "";
    let needsRescheduleInc = false;
    let dateChangeLog = null; // { field, old_val, new_val } for task_audit_logs

    if (title !== undefined && title !== task.title) {
      updateFields.push("title = ?");
      updateArgs.push(title);
      changes.push(`title changed to "${title}"`);
    }
    if (description !== undefined && description !== task.description) {
      updateFields.push("description = ?");
      updateArgs.push(description);
      changes.push("description updated");
    }
    if (status !== undefined && status !== task.status) {
      updateFields.push("status = ?");
      updateArgs.push(status);

      if (status === "completed") {
        updateFields.push("completed_at = CURRENT_TIMESTAMP");
        auditAction = "completed";
        auditDetails = `Task "${task.title}" marked as completed`;
      } else if (status === "carried_over") {
        auditAction = "carried_over";
        auditDetails = `Task "${task.title}" carried over to next week`;
      } else if (status === "archived") {
        auditAction = "archived";
        auditDetails = `Task "${task.title}" archived`;
      } else {
        auditDetails = `Task "${task.title}" status changed from ${task.status} to ${status}`;
      }
      // Reopening a completed task drops its completion timestamp, so a later
      // status change can never resurrect a "completed but carried over" state.
      if (task.status === "completed" && status !== "completed") {
        updateFields.push("completed_at = NULL");
      }
      changes.push(`status changed to ${status}`);
    }
    if (project_id !== undefined) {
      const projectChanged = String(project_id) !== String(task.project_id);
      updateFields.push("project_id = ?");
      updateArgs.push(project_id || null);
      changes.push("project reassigned");

      if (projectChanged && project_id) {
        // Phase 5: Re-validate project assignment on change
        const memberCheck = await getProjectMembership(project_id, user_id || task.user_id);

        if (memberCheck.rows.length === 0) {
          // Staff not assigned — reset to pending approval. The reset REPLACES a
          // status the caller sent: a SET list naming the same column twice is
          // refused by Postgres ("multiple assignments to same column"), which
          // lost the whole save, and the reset is the point of this branch.
          const statusAt = updateFields.findIndex((field) => field.startsWith("status ="));
          if (statusAt >= 0) {
            updateFields.splice(statusAt, 1);
            updateArgs.splice(statusAt, 1);
          }
          updateFields.push("status = 'pending_project_approval'");
          // Create new approval request
          try {
            await insertProjectApprovalRequest(
              parseInt(id),
              user_id || task.user_id,
              user_name || task.user_name || "",
              project_id,
            );
          } catch (error) {
            console.error(
              "Failed to insert project_approval_request:",
              error.message,
            );
          }
          changes.push("project reassignment requires approval");
        }
      }
    }

    // ── PHASE 1: Context fields ──
    if (context_type !== undefined && context_type !== (task.context_type || null)) {
      updateFields.push("context_type = ?");
      updateArgs.push(context_type || null);
      changes.push(`context_type changed to ${context_type}`);
    }
    if (context_id !== undefined && String(context_id) !== String(task.context_id || "")) {
      updateFields.push("context_id = ?");
      updateArgs.push(context_id || null);
      changes.push(`context_id changed`);
    }
    if (
      STAFF_SIDE_ROLES.includes(session.role) &&
      supervisor_id !== undefined &&
      String(supervisor_id) !== String(task.supervisor_id || "")
    ) {
      updateFields.push("supervisor_id = ?");
      updateArgs.push(supervisor_id || null);
      changes.push(`supervisor updated`);
    }
    if (intent_id !== undefined && String(intent_id) !== String(task.intent_id || "")) {
      updateFields.push("intent_id = ?");
      updateArgs.push(intent_id || null);
      changes.push(`intent linked`);
      // Auto-populate supervisor from intent if not explicitly set
      if (intent_id && !supervisor_id && !task.supervisor_id) {
        try {
          const intentResult = await getIntentResponsibleId(intent_id);
          if (intentResult.rows.length > 0 && intentResult.rows[0].responsible_id) {
            updateFields.push("supervisor_id = ?");
            updateArgs.push(intentResult.rows[0].responsible_id);
            changes.push("supervisor inherited from intent");
          }
        } catch (_) {}
      }
    }

    // ─── ASSIGNMENT MANAGEMENT ───
    let pendingAssignmentCreated = false;
    if (assigned_to !== undefined) {
      const assignmentChanged =
        String(assigned_to) !== String(task.assigned_to || "");
      const effectiveUserId = user_id || session.cid;

      // Un-assign: clear directly (no pending workflow needed)
      if (assignmentChanged && !assigned_to) {
        updateFields.push("assigned_to = ?");
        updateArgs.push(null);
        changes.push("assignment removed");
        auditDetails = `Assignment removed for task "${task.title}"`;
      }
      // Self-assign: set directly (no pending workflow needed)
      else if (
        assignmentChanged &&
        assigned_to &&
        String(assigned_to) === String(effectiveUserId)
      ) {
        updateFields.push("assigned_to = ?");
        updateArgs.push(assigned_to);
        changes.push(`self-assigned`);
        auditDetails = `Task "${task.title}" self-assigned`;
      }
      // Assign to another user: create pending assignment (requires accept/decline)
      else if (assignmentChanged && assigned_to) {
        // PHASE 2: Contact Group enforcement
        if (session.role !== "super_admin") {
          const { validateTaskAssignment } = await import("@/lib/contactGroups");
          const groupCheck = await validateTaskAssignment(
            effectiveUserId,
            assigned_to,
            {
              context_type: task.context_type || "staff",
              context_id: task.context_id || null,
            },
          );
          if (!groupCheck.allowed) {
            return NextResponse.json(
              {
                success: false,
                error: `Cannot assign task outside your Contact Group. ${groupCheck.reason || "No shared group found."}`,
              },
              { status: 403 },
            );
          }
        }

        // Do NOT push assigned_to to updateFields — task stays unassigned until acceptance
        pendingAssignmentCreated = true;
        changes.push(`pending assignment to user ${assigned_to}`);
        auditDetails = `Task "${task.title}" pending assignment to user ${assigned_to}`;

        // Guard against duplicate pending rows
        const duplicateCheck = await getPendingAssignmentId(parseInt(id), assigned_to);

        if (duplicateCheck.rows.length === 0) {
          await insertTaskAssignment(parseInt(id), effectiveUserId, assigned_to);
        }

        // Notify assignee via v2_notifications with richer messaging
        let notifyName = user_name || session.name;
        if (!notifyName) {
          try {
            const nameResult = await getContactNameByCid(effectiveUserId);
            if (nameResult.rows.length > 0) notifyName = nameResult.rows[0].name;
          } catch (_) {}
        }
        try {
          await insertNotification(
            assigned_to,
            "New Task Assignment",
            `${notifyName || effectiveUserId} assigned you task "${task.title}" — please accept or decline this assignment.`,
            "task_assignment",
          );
        } catch (notifErr) {
          console.error("Assignment notification failed:", notifErr.message);
        }
      }
    }
    // ─── SCHEDULE DRIFT DETECTION (Phase 2/11) ───
    if (start_date !== undefined) {
      const dateChanged = start_date !== (task.start_date || null);
      updateFields.push("start_date = ?");
      updateArgs.push(start_date || null);

      if (dateChanged) {
        dateChangeLog = {
          field: "start_date",
          old_val: task.start_date,
          new_val: start_date,
        };
        changes.push("start date updated");
        // First schedule: immutable once set
        if (!task.first_scheduled_start_date && start_date) {
          updateFields.push("first_scheduled_start_date = ?");
          updateArgs.push(start_date);
          changes.push("first schedule captured");
        } else if (
          task.first_scheduled_start_date &&
          start_date !== task.first_scheduled_start_date
        ) {
          // Drift detected — increment reschedule count via separate update
          needsRescheduleInc = true;
          changes.push("schedule drift detected");
        }
      }
    }
    if (end_date !== undefined) {
      const dateChanged = end_date !== (task.end_date || null);
      updateFields.push("end_date = ?");
      updateArgs.push(end_date || null);

      if (dateChanged) {
        dateChangeLog = {
          field: "end_date",
          old_val: task.end_date,
          new_val: end_date,
        };
        changes.push("end date updated");
        // First schedule: immutable once set
        if (!task.first_scheduled_end_date && end_date) {
          updateFields.push("first_scheduled_end_date = ?");
          updateArgs.push(end_date);
          changes.push("first schedule captured");
        } else if (
          task.first_scheduled_end_date &&
          end_date !== task.first_scheduled_end_date
        ) {
          // Drift detected — increment reschedule count via separate update
          needsRescheduleInc = true;
          changes.push("schedule drift detected");
        }
      }
    }

    // ─── DATE VALIDATION (Phase 13) ───
    if (start_date !== undefined && start_date && !isValidDateStr(start_date)) {
      return NextResponse.json(
        { success: false, error: "Invalid start_date. Expected format YYYY-MM-DD." },
        { status: 400 },
      );
    }
    if (end_date !== undefined && end_date && !isValidDateStr(end_date)) {
      return NextResponse.json(
        { success: false, error: "Invalid end_date. Expected format YYYY-MM-DD." },
        { status: 400 },
      );
    }
    const effStartDate =
      start_date !== undefined ? start_date || null : task.start_date;
    const effEndDate = end_date !== undefined ? end_date || null : task.end_date;
    if (effStartDate && effEndDate && effEndDate < effStartDate) {
      return NextResponse.json(
        { success: false, error: "Due date cannot be earlier than the start date." },
        { status: 400 },
      );
    }

    if (updateFields.length === 0 && !pendingAssignmentCreated) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      );
    }

    if (updateFields.length === 0 && pendingAssignmentCreated) {
      return NextResponse.json({
        success: true,
        message: "Pending assignment created",
      });
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    updateArgs.push(parseInt(id));

    await updateTaskFields(updateFields, updateArgs);

    // ─── Sync parent end_date if subtask extends further ───
    if (task.parent_task_id && end_date !== undefined) {
      try {
        const parentEndResult = await getTaskEndDateRowById(parseInt(task.parent_task_id));
        if (parentEndResult.rows.length > 0) {
          const subtaskEndDate = new Date(end_date || task.end_date);
          const currentParentEndStr = parentEndResult.rows[0].end_date;
          let shouldUpdateParent = false;

          if (!currentParentEndStr) {
            shouldUpdateParent = true;
          } else {
            const parentEndDate = new Date(currentParentEndStr);
            if (subtaskEndDate > parentEndDate) {
              shouldUpdateParent = true;
            }
          }

          if (shouldUpdateParent) {
            await updateTaskEndDate(end_date || task.end_date, parseInt(task.parent_task_id));
          }
        }
      } catch (_) {}
    }

    // ─── Auto-complete sub-tasks when parent is completed ───
    if (status === "completed" && status !== task.status) {
      try {
        const updatedSubtasks = await completeSubtasks(parseInt(id));

        // Notify super admins when sub-tasks are auto-completed
        if (updatedSubtasks.rowsAffected > 0) {
          const superAdminsResult = await getActiveSuperAdminCids();
          for (const superAdmin of superAdminsResult.rows) {
            await insertNotificationWithCreatedAt(
              superAdmin.cid,
              "Sub-tasks Auto-completed",
              `Sub-tasks for task "${task.title}" were auto-completed by completing the parent task.`,
              "subtask_auto_complete",
            );
          }
        }
      } catch (_) {}

      // ─── Walk carryover chain backwards and mark ancestors as completed ───
      // When a cloned task is completed, its originals (carried_over status)
      // should also be marked completed so they stop appearing in carryover.
      await completeCarryoverAncestors(id);
    }

    // ─── SUBTASK ⇄ PARENT CASCADE (Phase 13) ───
    // Keep parent/subtask completion consistent:
    //   - All non-archived subtasks complete → parent completes (respecting blockers)
    //   - Any incomplete subtask exists → completed parent reopens to in_progress
    if (task.parent_task_id) {
      try {
        const incompleteSubtasks = await countIncompleteSubtasks(parseInt(task.parent_task_id));
        if ((Number(incompleteSubtasks.rows[0]?.total) || 0) === 0) {
          // All subtasks complete → auto-complete the parent (unless it has active blockers)
          const parentBlockersResult = await getActiveBlockersForTask(parseInt(task.parent_task_id));
          if (parentBlockersResult.rows.length === 0) {
            const parentResult = await markTaskCompleted(parseInt(task.parent_task_id));
            if (parentResult.rowsAffected > 0) {
              try {
                const parentTitle =
                  (await getTaskTitleById(task.parent_task_id)) ||
                  `Task #${task.parent_task_id}`;
                await logAuditEvent({
                  entity_type: "task",
                  entity_id: parseInt(task.parent_task_id),
                  user_id: user_id || task.user_id,
                  user_name: user_name || task.user_name,
                  action: "completed",
                  details: `Parent task "${parentTitle}" auto-completed (all subtasks completed)`,
                  metadata: { status: "completed", auto: true },
                });
              } catch (_) {}
            }
          }
        } else {
          // Some subtasks incomplete → reopen parent if it was completed
          await reopenCompletedTask(parseInt(task.parent_task_id));
        }
      } catch (_) {}
    }

    // Reopening a parent task reopens its completed subtasks (keeps state consistent)
    if (
      !task.parent_task_id &&
      status !== undefined &&
      status !== task.status &&
      task.status === "completed" &&
      status !== "completed" &&
      status !== "archived" &&
      status !== "carried_over"
    ) {
      try {
        await reopenCompletedSubtasks(parseInt(id));
      } catch (_) {}
    }

    // ─── Log assignment event to task_assignment_log ───
    if (assigned_to !== undefined) {
      const assignmentChanged =
        String(assigned_to) !== String(task.assigned_to || "");
      if (assignmentChanged) {
        const effectiveUserId = user_id || session.cid;
        const isPendingAssignment =
          assigned_to && String(assigned_to) !== String(effectiveUserId);
        await logTaskEvent({
          task_id: parseInt(id),
          project_id: project_id || task.project_id,
          actor_id: user_id || task.user_id,
          target_user_id: assigned_to || null,
          action_type: assigned_to
            ? ACTION_TYPES.TASK_ASSIGNED
            : ACTION_TYPES.TASK_UPDATED,
          previous_state: { assigned_to: task.assigned_to },
          // Pending assignment: tasks.assigned_to stays NULL until acceptance
          new_state: {
            assigned_to: isPendingAssignment ? null : assigned_to || null,
          },
          description: isPendingAssignment
            ? `Pending assignment to ${assigned_to} (awaiting acceptance)`
            : assigned_to
              ? `Task assigned to ${assigned_to}`
              : `Assignment removed from task`,
        });
      }
    }

    // SECURITY: Status changes (complete, carry-over) are allowed for collaborative workflows
    // Only block metadata changes (title, description, project) by non-owners
    const isTaskOwner = String(task.user_id) === String(session.cid);
    const isAssignee =
      task.assigned_to && String(task.assigned_to) === String(session.cid);
    const isOnlyStatusChange =
      Object.keys(body).filter(
        (key) => key !== "id" && key !== "status" && key !== "force_complete",
      ).length === 0;
    if (
      session.role !== "super_admin" &&
      !isTaskOwner &&
      !isAssignee &&
      !isOnlyStatusChange
    ) {
      return NextResponse.json(
        { success: false, error: "You can only update your own tasks." },
        { status: 403 },
      );
    }

    // ─── Reschedule increment (Phase 2/11) ───
    if (needsRescheduleInc) {
      await incrementTaskRescheduleCount(parseInt(id));
    }

    // ─── Task audit log for date changes (Phase 11) ───
    if (dateChangeLog) {
      await insertTaskAuditLog(
        parseInt(id),
        user_id || task.user_id,
        dateChangeLog.field,
        String(dateChangeLog.old_val || ""),
        String(dateChangeLog.new_val || ""),
        needsRescheduleInc
          ? JSON.stringify({
              drift: true,
              reschedule_count_incremented: true,
            })
          : null,
      );
    }

    // Audit log
    await logAuditEvent({
      entity_type: "task",
      entity_id: parseInt(id),
      user_id: user_id || task.user_id,
      user_name: user_name || task.user_name,
      action: auditAction,
      details: auditDetails || changes.join("; "),
      metadata: {
        title: title || task.title,
        status: status || task.status,
        project_id: project_id || task.project_id,
      },
    });

    // Immutable task audit trail
    if (status !== undefined && status !== task.status) {
      const actionType =
        status === "completed"
          ? ACTION_TYPES.TASK_COMPLETED
          : status === "carried_over"
            ? ACTION_TYPES.TASK_CARRIED_OVER
            : status === "archived"
              ? ACTION_TYPES.TASK_UPDATED
              : ACTION_TYPES.TASK_UPDATED;
      await logTaskEvent({
        task_id: parseInt(id),
        project_id: project_id || task.project_id,
        actor_id: user_id || task.user_id,
        target_user_id: user_id || task.user_id,
        action_type: actionType,
        previous_state: { status: task.status },
        new_state: { status, title: title || task.title },
        description: `Task status changed from ${task.status} to ${status}`,
      });
    }

    // ─── Rebuild standup task list after task update ───
    if (status !== undefined || title !== undefined) {
      try {
        const { rebuildStandupTasks } = await import("@/lib/standupUpsert");
        await rebuildStandupTasks(
          task.user_id,
          task.created_week,
          task.created_year,
        );
      } catch (error) {
        console.error("Standup rebuild failed (non-blocking):", error.message);
      }
    }

    // ─── Sync parent end_date if this (sub)task extends further ───
    if (
      task.parent_task_id &&
      (end_date !== undefined || start_date !== undefined)
    ) {
      try {
        const effectiveEnd = end_date || task.end_date;
        if (effectiveEnd) {
          const parentEndStr = await getTaskEndDateById(task.parent_task_id);
          if (parentEndStr) {
            const parentEndDate = new Date(parentEndStr);
            const subtaskEndDate = new Date(effectiveEnd);
            if (subtaskEndDate > parentEndDate) {
              await updateTaskEndDate(effectiveEnd, task.parent_task_id);
            }
          }
        }
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      id: parseInt(id),
      action: "updated",
      locked,
    });
  } catch (error) {
    console.error("PUT tasks error:", error);
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

    const result = await deleteTaskRecord({
      id,
      role: session.role,
      sessionCid: session.cid,
      sessionName: session.name,
    });
    if (result.error) {
      return NextResponse.json(
        result.body || { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("DELETE tasks error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/tasks
 *
 * Accept or decline a pending task assignment.
 * Body: { action: "accept" | "decline", task_assignment_id?: number, task_id?: number }
 *
 * If task_assignment_id is provided, it looks up that specific record.
 * Otherwise, it uses task_id + the authenticated user's session cid.
 */
export async function PATCH(req) {
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
    const { action, task_assignment_id, task_id } = body;

    if (!action || !["accept", "decline"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid action ('accept' or 'decline') is required.",
        },
        { status: 400 },
      );
    }

    if (!task_assignment_id && !task_id) {
      return NextResponse.json(
        {
          success: false,
          error: "task_assignment_id or task_id is required.",
        },
        { status: 400 },
      );
    }

    const result = await respondToPendingAssignment({
      action,
      taskAssignmentId: task_assignment_id,
      taskId: task_id,
      sessionCid: session.cid,
      sessionName: session.name,
    });
    if (result.error) {
      return NextResponse.json(
        result.body || { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("PATCH tasks error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
