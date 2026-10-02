/**
 * Tasks — the PUT /api/tasks POST-WRITE EFFECTS (SERVICE layer).
 *
 * What happens once the SET has been written, in the order the original monolith
 * applied it:
 *
 *   - the parent's `end_date` is stretched when a subtask now reaches further
 *     than the parent;
 *   - completing a parent completes its subtasks (and tells the Super Admins),
 *     then walks the carry-over chain backwards so a finished clone stops
 *     appearing as a carry-over;
 *   - the parent/subtask cascade: a parent whose last subtask is done is
 *     completed too (and audited), a parent with work left is reopened;
 *   - reopening a parent reopens the subtasks it had completed;
 *   - the assignment event enters the immutable `task_assignment_log`;
 *   - the strict-owner check (metadata changes belong to the owner or the
 *     assignee), the reschedule increment, the date audit, the general audit,
 *     the status audit event, and the standup rebuild.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions only, no SQL, no HTTP.
 *
 * Two behaviours here look surprising but are the contract the tests pin, so
 * they must not be tidied up in passing:
 *
 *   1. `assertStrictOwnerChange` runs AFTER the write — the update has already
 *      landed when a supervisor's metadata change is refused;
 *   2. the parent's end date is stretched twice, by two different reads: once
 *      right after the write (row read) and once at the very end (facade read,
 *      and on a start-date change too).
 */

import {
  completeSubtasks,
  getActiveSuperAdminCids,
  insertNotificationWithCreatedAt,
  countIncompleteSubtasks,
  getActiveBlockersForTask,
  markTaskCompleted,
  reopenCompletedTask,
  reopenCompletedSubtasks,
  incrementTaskRescheduleCount,
  insertTaskAuditLog,
  updateTaskEndDate,
  getTaskEndDateRowById,
} from "@/models/tasks";
import { getTaskTitleById, getTaskEndDateById } from "@/models/tasks";
import { rebuildStandupTasks } from "@/models/standupUpsert";
import { logTaskEvent, ACTION_TYPES } from "@/models/taskAudit";
import { logAuditEvent } from "@/services/tasks/auditLog";
import { completeCarryoverAncestors } from "@/models/taskCarryover";

/**
 * Stretch the parent's end date when this subtask now reaches further than it.
 * Runs right after the write, on an end-date change. Best-effort.
 */
export async function stretchParentEndDateAfterWrite({ task, end_date }) {
  if (!task.parent_task_id || end_date === undefined) return;

  try {
    const parentEndResult = await getTaskEndDateRowById(
      parseInt(task.parent_task_id),
    );
    if (parentEndResult.rows.length === 0) return;

    const subtaskEndDate = new Date(end_date || task.end_date);
    const currentParentEndStr = parentEndResult.rows[0].end_date;

    const shouldUpdateParent =
      !currentParentEndStr || subtaskEndDate > new Date(currentParentEndStr);

    if (shouldUpdateParent) {
      await updateTaskEndDate(
        end_date || task.end_date,
        parseInt(task.parent_task_id),
      );
    }
  } catch {
    /* the parent stretch is best-effort */
  }
}

/**
 * Completing a parent completes its subtasks, notifies the Super Admins of the
 * fan-out, and completes the carried-over ancestors of the clone.
 */
export async function completeSubtasksWithFanOut({ id, task, status }) {
  if (status !== "completed" || status === task.status) return;

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

/** ─── SUBTASK ⇄ PARENT CASCADE (Phase 13) ─── */
export async function cascadeParentCompletion({ task, input }) {
  if (!task.parent_task_id) return;

  const { user_id, user_name } = input;

  try {
    const incompleteSubtasks = await countIncompleteSubtasks(
      parseInt(task.parent_task_id),
    );
    if ((Number(incompleteSubtasks.rows[0]?.total) || 0) === 0) {
      const parentBlockersResult = await getActiveBlockersForTask(
        parseInt(task.parent_task_id),
      );
      if (parentBlockersResult.rows.length === 0) {
        const parentResult = await markTaskCompleted(
          parseInt(task.parent_task_id),
        );
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

/** Reopening a parent task reopens its completed subtasks (state consistency). */
export async function reopenSubtasksOnParentReopen({ id, task, input }) {
  const { status } = input;

  if (
    task.parent_task_id ||
    status === undefined ||
    status === task.status ||
    task.status !== "completed" ||
    status === "completed" ||
    status === "archived" ||
    status === "carried_over"
  ) {
    return;
  }

  try {
    await reopenCompletedSubtasks(parseInt(id));
  } catch {
    /* best-effort */
  }
}

/**
 * ─── Log the assignment event to task_assignment_log ───
 *
 * A pending assignment is logged with `assigned_to: null` — the column only
 * moves once the target accepts.
 */
export async function logAssignmentChange({ id, task, input, sessionCid }) {
  const { assigned_to, project_id, user_id } = input;
  if (assigned_to === undefined) return;

  const assignmentChanged =
    String(assigned_to) !== String(task.assigned_to || "");
  if (!assignmentChanged) return;

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

/**
 * SECURITY: status changes are allowed for collaborative workflows; only
 * metadata changes (title, description, project) are blocked by non-owners.
 *
 * The caller runs this AFTER the write — that ordering is the tested contract.
 *
 * @returns {{status: number, error: string}|null}
 */
export function assertStrictOwnerChange({ task, input, role, sessionCid }) {
  const cid = String(sessionCid);
  const isTaskOwner = String(task.user_id) === cid;
  const isAssignee = task.assigned_to && String(task.assigned_to) === cid;
  const isOnlyStatusChange =
    Object.keys(input).filter(
      (key) => key !== "id" && key !== "status" && key !== "force_complete",
    ).length === 0;

  if (role !== "super_admin" && !isTaskOwner && !isAssignee && !isOnlyStatusChange) {
    return { status: 403, error: "You can only update your own tasks." };
  }

  return null;
}

/**
 * The reschedule increment, the date audit row, the general audit and the status
 * event of the immutable trail.
 */
export async function recordUpdateAudits({
  id,
  task,
  input,
  patch,
  needsRescheduleInc,
  dateChangeLog,
}) {
  const { title, status, project_id, user_id, user_name } = input;

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
    action: patch.auditAction,
    details: patch.auditDetails || patch.changes.join("; "),
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
}

/**
 * ─── Rebuild the standup task list after the update ───
 *
 * A renamed task or a moved one must show up under its new name in the next
 * standup, so this is not optional housekeeping.
 */
export async function rebuildStandupsAfterUpdate({ task, input }) {
  const { status, title } = input;
  if (status === undefined && title === undefined) return;

  try {
    await rebuildStandupTasks(task.user_id, task.created_week, task.created_year);
  } catch (error) {
    console.error("Standup rebuild failed (non-blocking):", error.message);
  }
}

/**
 * ─── Sync parent end_date if this (sub)task extends further ───
 *
 * The last effect of the update: on a start-date change too, so the subtask is
 * compared on the whole schedule rather than on its end date alone.
 */
export async function stretchParentEndDateOnScheduleChange({
  task,
  input,
}) {
  const { start_date, end_date } = input;
  if (!task.parent_task_id || (end_date === undefined && start_date === undefined)) {
    return;
  }

  try {
    const effectiveEnd = end_date || task.end_date;
    if (!effectiveEnd) return;

    const parentEndStr = await getTaskEndDateById(task.parent_task_id);
    if (!parentEndStr) return;

    if (new Date(effectiveEnd) > new Date(parentEndStr)) {
      await updateTaskEndDate(effectiveEnd, task.parent_task_id);
    }
  } catch {
    /* the parent stretch is best-effort */
  }
}