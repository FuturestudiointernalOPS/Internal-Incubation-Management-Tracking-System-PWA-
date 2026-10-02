/**
 * Tasks — update use case (SERVICE layer).
 *
 * The domain work behind PUT /api/tasks — the largest path of the monolith. The
 * CONTROLLER authenticates and shapes the HTTP answer; everything below is what
 * updating a task DOES:
 *
 *   - the access rule (owner / assignee / supervisor / Super Admin) and the
 *     finer status rule (only the creator or assignee may change status);
 *   - the lock: a locked task cannot have its title or description changed;
 *   - the completion guards: active blockers (on the task or its subtasks) need
 *     an explicit `force_complete`, and a completed task can never be flipped to
 *     carried-over;
 *   - the field assembly (link, priority, status, project, context, supervisor,
 *     intent) — including dropping `completed_at` when a completed task reopens;
 *   - project revalidation on change (resetting to pending approval), the
 *     assignment rules (un-assign / self-assign / pending assignment with the
 *     contact-group gate), and schedule drift detection;
 *   - the parent/subtask cascade, the carry-over ancestor walk, the reschedule
 *     increment, the date audit, the general audit and the standup rebuild.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import {
  getActiveBlockersForTaskWithTitle,
  getActiveBlockersOnSubtasks,
  getProjectMembership,
  insertProjectApprovalRequest,
  getPendingAssignmentId,
  insertTaskAssignment,
  getContactNameByCid,
  insertNotification,
  getIntentResponsibleId,
  completeSubtasks,
  getActiveSuperAdminCids,
  insertNotificationWithCreatedAt,
  countIncompleteSubtasks,
  getActiveBlockersForTask,
  markTaskCompleted,
  reopenCompletedTask,
  reopenCompletedSubtasks,
  updateTaskFields,
  incrementTaskRescheduleCount,
  insertTaskAuditLog,
  updateTaskEndDate,
  getTaskEndDateRowById,
} from "@/models/tasks";
// Kept on the compatibility facades the existing task suite mocks.
import { getTaskById, getTaskTitleById, getTaskEndDateById } from "@/models/tasks";
import { rebuildStandupTasks } from "@/models/standupUpsert";
import { logTaskEvent, ACTION_TYPES } from "@/models/taskAudit";
import { logAuditEvent, isTaskLocked } from "@/services/tasks/auditLog";
import { completeCarryoverAncestors } from "@/models/taskCarryover";
import { validateTaskAssignment } from "@/models/contactGroups";
import { seesWholePortfolio } from "@/services/authorization/listingScope";
import { isValidDateStr } from "./dates";

/**
 * Update a task.
 *
 * @param {{id: string|number, input: Object, role: string, sessionCid: string, sessionName: string}} args
 * @returns {Promise<{status: number, error?: string, body?: Object}>}
 */
export async function updateTaskRecord({ id, input, role, sessionCid, sessionName }) {
  const body = input;
  const {
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

  // Fetch the current task state.
  const task = await getTaskById(id);
  if (!task) {
    return { status: 404, error: "Task not found" };
  }

  // SECURITY: only the task owner, assignee, supervisor or Super Admin may update.
  const cid = String(sessionCid);
  if (
    role !== "super_admin" &&
    String(task.user_id) !== cid &&
    String(task.assigned_to || "") !== cid &&
    String(task.supervisor_id || "") !== cid
  ) {
    return {
      status: 403,
      error: "You do not have permission to update this task.",
    };
  }

  const locked = await isTaskLocked(id);

  const updateFields = [];
  const updateArgs = [];
  const changes = [];

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
    const effectiveUserId = user_id || sessionCid;
    if (
      role !== "super_admin" &&
      String(effectiveUserId) !== String(task.user_id) &&
      String(effectiveUserId) !== String(task.assigned_to || "")
    ) {
      return {
        status: 403,
        error: "Only the task creator or assignee can change its status.",
      };
    }
  }

  // Locking: title and description cannot be modified when locked.
  if (locked) {
    if (title !== undefined && title !== task.title) {
      const error =
        "Task is locked (older than 12 hours). Title cannot be modified.";
      return { status: 403, error, body: { success: false, error, locked: true } };
    }
    if (description !== undefined && description !== task.description) {
      const error =
        "Task is locked (older than 12 hours). Description cannot be modified.";
      return { status: 403, error, body: { success: false, error, locked: true } };
    }
  }

  // Completion protection: active blockers (on the task or its subtasks) need an
  // explicit force_complete.
  if (status === "completed") {
    const activeBlockers = await getActiveBlockersForTaskWithTitle(parseInt(id));
    const subtaskBlockers = await getActiveBlockersOnSubtasks(parseInt(id));

    const allBlockers = [
      ...activeBlockers.rows.map((blocker) => ({ ...blocker, source: "task" })),
      ...subtaskBlockers.rows.map((blocker) => ({ ...blocker, source: "subtask" })),
    ];

    if (allBlockers.length > 0) {
      if (!force_complete) {
        return {
          status: 200,
          body: {
            success: false,
            error:
              "This task has active blockers. Please confirm completion or resolve the blocker before proceeding.",
            hasActiveBlockers: true,
            blockers: allBlockers,
          },
        };
      }
    }
  }

  // Carry-over safety: a completed task must never be flipped back to carried_over.
  if (status === "carried_over" && task.status === "completed") {
    return {
      status: 409,
      error: "Completed tasks cannot be marked as carried over.",
    };
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
      // Phase 5: re-validate the project assignment on change.
      const memberCheck = await getProjectMembership(
        project_id,
        user_id || task.user_id,
      );

      if (memberCheck.rows.length === 0) {
        // Not a member — reset to pending approval. The reset REPLACES a status
        // the caller sent: a SET list naming the same column twice is refused by
        // Postgres ("multiple assignments to same column"), which lost the whole
        // save, and the reset is the point of this branch.
        const statusAt = updateFields.findIndex((field) =>
          field.startsWith("status ="),
        );
        if (statusAt >= 0) {
          updateFields.splice(statusAt, 1);
          updateArgs.splice(statusAt, 1);
        }
        updateFields.push("status = 'pending_project_approval'");
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
    seesWholePortfolio(role) &&
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
    // Auto-populate the supervisor from the intent if not explicitly set.
    if (intent_id && !supervisor_id && !task.supervisor_id) {
      try {
        const intentResult = await getIntentResponsibleId(intent_id);
        if (intentResult.rows.length > 0 && intentResult.rows[0].responsible_id) {
          updateFields.push("supervisor_id = ?");
          updateArgs.push(intentResult.rows[0].responsible_id);
          changes.push("supervisor inherited from intent");
        }
      } catch {
        /* inheritance is best-effort */
      }
    }
  }

  // ─── ASSIGNMENT MANAGEMENT ───
  let pendingAssignmentCreated = false;
  if (assigned_to !== undefined) {
    const assignmentChanged =
      String(assigned_to) !== String(task.assigned_to || "");
    const effectiveUserId = user_id || sessionCid;

    // Un-assign: clear directly (no pending workflow needed).
    if (assignmentChanged && !assigned_to) {
      updateFields.push("assigned_to = ?");
      updateArgs.push(null);
      changes.push("assignment removed");
      auditDetails = `Assignment removed for task "${task.title}"`;
    }
    // Self-assign: set directly.
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
    // Assign to another user: open a pending assignment (accept/decline).
    else if (assignmentChanged && assigned_to) {
      // Contact Group enforcement.
      if (role !== "super_admin") {
        const groupCheck = await validateTaskAssignment(
          effectiveUserId,
          assigned_to,
          {
            context_type: task.context_type || "staff",
            context_id: task.context_id || null,
          },
        );
        if (!groupCheck.allowed) {
          return {
            status: 403,
            error: `Cannot assign task outside your Contact Group. ${groupCheck.reason || "No shared group found."}`,
          };
        }
      }

      // The task stays unassigned until acceptance.
      pendingAssignmentCreated = true;
      changes.push(`pending assignment to user ${assigned_to}`);
      auditDetails = `Task "${task.title}" pending assignment to user ${assigned_to}`;

      // Guard against duplicate pending rows.
      const duplicateCheck = await getPendingAssignmentId(parseInt(id), assigned_to);
      if (duplicateCheck.rows.length === 0) {
        await insertTaskAssignment(parseInt(id), effectiveUserId, assigned_to);
      }

      let notifyName = user_name || sessionName;
      if (!notifyName) {
        try {
          const nameResult = await getContactNameByCid(effectiveUserId);
          if (nameResult.rows.length > 0) notifyName = nameResult.rows[0].name;
        } catch {
          /* the name probe is best-effort */
        }
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
      // First schedule is immutable once set.
      if (!task.first_scheduled_start_date && start_date) {
        updateFields.push("first_scheduled_start_date = ?");
        updateArgs.push(start_date);
        changes.push("first schedule captured");
      } else if (
        task.first_scheduled_start_date &&
        start_date !== task.first_scheduled_start_date
      ) {
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
      if (!task.first_scheduled_end_date && end_date) {
        updateFields.push("first_scheduled_end_date = ?");
        updateArgs.push(end_date);
        changes.push("first schedule captured");
      } else if (
        task.first_scheduled_end_date &&
        end_date !== task.first_scheduled_end_date
      ) {
        needsRescheduleInc = true;
        changes.push("schedule drift detected");
      }
    }
  }

  // ─── DATE VALIDATION (Phase 13) ───
  if (start_date !== undefined && start_date && !isValidDateStr(start_date)) {
    return {
      status: 400,
      error: "Invalid start_date. Expected format YYYY-MM-DD.",
    };
  }
  if (end_date !== undefined && end_date && !isValidDateStr(end_date)) {
    return {
      status: 400,
      error: "Invalid end_date. Expected format YYYY-MM-DD.",
    };
  }
  const effStartDate =
    start_date !== undefined ? start_date || null : task.start_date;
  const effEndDate = end_date !== undefined ? end_date || null : task.end_date;
  if (effStartDate && effEndDate && effEndDate < effStartDate) {
    return {
      status: 400,
      error: "Due date cannot be earlier than the start date.",
    };
  }

  if (updateFields.length === 0 && !pendingAssignmentCreated) {
    return { status: 400, error: "No fields to update" };
  }

  if (updateFields.length === 0 && pendingAssignmentCreated) {
    return { status: 200, body: { success: true, message: "Pending assignment created" } };
  }

  updateFields.push("updated_at = CURRENT_TIMESTAMP");
  updateArgs.push(parseInt(id));

  await updateTaskFields(updateFields, updateArgs);

  // ─── Sync parent end_date if the subtask extends further ───
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
          await updateTaskEndDate(
            end_date || task.end_date,
            parseInt(task.parent_task_id),
          );
        }
      }
    } catch {
      /* the parent stretch is best-effort */
    }
  }

  // ─── Auto-complete sub-tasks when the parent is completed ───
  if (status === "completed" && status !== task.status) {
    try {
      const updatedSubtasks = await completeSubtasks(parseInt(id));

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
    } catch {
      /* the auto-complete fan-out is best-effort */
    }

    // Walk the carryover chain backwards and mark the ancestors completed, so a
    // finished clone stops appearing as a carry-over.
    await completeCarryoverAncestors(id);
  }

  // ─── SUBTASK ⇄ PARENT CASCADE (Phase 13) ───
  if (task.parent_task_id) {
    try {
      const incompleteSubtasks = await countIncompleteSubtasks(parseInt(task.parent_task_id));
      if ((Number(incompleteSubtasks.rows[0]?.total) || 0) === 0) {
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
            } catch {
              /* the parent audit is best-effort */
            }
          }
        }
      } else {
        await reopenCompletedTask(parseInt(task.parent_task_id));
      }
    } catch {
      /* the cascade is best-effort */
    }
  }

  // Reopening a parent task reopens its completed subtasks (state consistency).
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
    } catch {
      /* best-effort */
    }
  }

  // ─── Log the assignment event to task_assignment_log ───
  if (assigned_to !== undefined) {
    const assignmentChanged =
      String(assigned_to) !== String(task.assigned_to || "");
    if (assignmentChanged) {
      const effectiveUserId = user_id || sessionCid;
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
        // Pending assignment: tasks.assigned_to stays NULL until acceptance.
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

  // SECURITY: status changes are allowed for collaborative workflows; only
  // metadata changes (title, description, project) are blocked by non-owners.
  const isTaskOwner = String(task.user_id) === cid;
  const isAssignee =
    task.assigned_to && String(task.assigned_to) === cid;
  const isOnlyStatusChange =
    Object.keys(body).filter(
      (key) => key !== "id" && key !== "status" && key !== "force_complete",
    ).length === 0;
  if (
    role !== "super_admin" &&
    !isTaskOwner &&
    !isAssignee &&
    !isOnlyStatusChange
  ) {
    return { status: 403, error: "You can only update your own tasks." };
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

  // ─── Rebuild the standup task list after the update ───
  if (status !== undefined || title !== undefined) {
    try {
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
    } catch {
      /* the parent stretch is best-effort */
    }
  }

  return {
    status: 200,
    body: { success: true, id: parseInt(id), action: "updated", locked },
  };
}
