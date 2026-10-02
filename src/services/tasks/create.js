/**
 * Tasks — creation use case (SERVICE layer).
 *
 * The domain work behind POST /api/tasks. The CONTROLLER authenticates, checks
 * the required fields and shapes the HTTP answer; everything below is what
 * creating a task DOES:
 *
 *   - who the task may be created FOR (a non-privileged caller is pinned to
 *     themselves — the role list here includes `team`, unlike the narrower
 *     portfolio list used by the supervisor gate);
 *   - project/category inheritance from a parent task, and the "General"
 *     fallback when neither is given;
 *   - the guards: no tasks on a closed/archived project; strict date formats and
 *     ordering; a current-week task may not start in the past; no assignment to a
 *     Super Admin; a foreign assignment must share a contact group;
 *   - assigning to someone else becomes a PENDING assignment (not a direct
 *     assignee), defaulting an unassigned project task to its owner;
 *   - the completion cascade with the parent, the audit trail, the sub-task
 *     notification to Super Admins, the standup upsert and the parent deadline
 *     stretch.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import {
  getParentProjectCategory,
  getProjectStatus,
  getProjectOwnerId,
  getSuperAdminContact,
  createTask,
  countIncompleteSubtasks,
  getActiveBlockersForTask,
  markTaskCompleted,
  reopenCompletedTask,
  getActiveSuperAdmins,
  insertNotificationWithCreatedAt,
  getContactRoleByCid,
  insertTaskAssignment,
  insertNotification,
  getContactNameByCid,
  updateTaskEndDate,
} from "@/models/tasks";
// Kept on the compatibility facades the existing task suite mocks.
import { getTaskTitleById, getTaskEndDateById } from "@/models/tasks";
import { standupUpsert } from "@/models/standupUpsert";
import { logTaskEvent, ACTION_TYPES } from "@/models/taskAudit";
import { logAuditEvent } from "@/services/tasks/auditLog";
import { validateTaskAssignment } from "@/models/contactGroups";
import { seesWholePortfolio } from "@/services/authorization/listingScope";
import { isValidDateStr, todayStr, isCurrentWeek } from "./dates";

/**
 * Create a task (and run its follow-on effects).
 *
 * @param {{input: Object, role: string, sessionCid: string}} args
 * @returns {Promise<{status: number, error?: string, body?: Object}>}
 */
export async function createTaskRecord({ input, role, sessionCid }) {
  let { user_id } = input;
  const {
    user_name,
    title,
    description,
    status,
    project_id,
    category,
    created_week,
    created_year,
    carried_over_from_task_id,
    parent_task_id,
    start_date,
    end_date,
    assigned_to,
    link,
    priority,
    context_type,
    context_id,
    supervisor_id,
    intent_id,
  } = input;

  // Non-privileged users can only create tasks for themselves.
  if (
    !["super_admin", "staff", "program_manager", "team"].includes(role)
  ) {
    user_id = sessionCid;
  }

  // Phase 1: inherit project/category from the parent task on a sub-task.
  let finalProjectId = project_id;
  let finalCategory = category;
  if (parent_task_id && !finalProjectId && !finalCategory) {
    try {
      const parentResult = await getParentProjectCategory(parseInt(parent_task_id));
      if (parentResult.rows.length > 0) {
        const parentTask = parentResult.rows[0];
        if (!finalProjectId && parentTask.project_id) {
          finalProjectId = String(parentTask.project_id);
        }
        if (!finalCategory && parentTask.category) {
          finalCategory = parentTask.category;
        }
      }
    } catch {
      /* inheritance is best-effort */
    }
  }

  // A task must have a project OR a category — default to "General".
  if (!finalProjectId && !finalCategory) {
    finalCategory = "General";
  }

  // No task creation on a closed/archived project.
  if (finalProjectId) {
    try {
      const projectCheck = await getProjectStatus(finalProjectId);
      if (
        projectCheck.rows.length > 0 &&
        (projectCheck.rows[0].status === "Closed" ||
          projectCheck.rows[0].status === "Archived")
      ) {
        return {
          status: 400,
          error: "Cannot add tasks to a closed or archived project.",
        };
      }
    } catch {
      /* the project probe is best-effort */
    }
  }

  // ─── DATE VALIDATION (Phase 13) ───
  if (start_date && !isValidDateStr(start_date)) {
    return {
      status: 400,
      error: "Invalid start_date. Expected format YYYY-MM-DD.",
    };
  }
  if (end_date && !isValidDateStr(end_date)) {
    return {
      status: 400,
      error: "Invalid end_date. Expected format YYYY-MM-DD.",
    };
  }
  if (start_date && end_date && end_date < start_date) {
    return {
      status: 400,
      error: "Due date cannot be earlier than the start date.",
    };
  }
  // New tasks for the current reporting week cannot start in the past
  // (backfilled tasks for previous weeks and subtasks are exempt).
  const isCurrentWeekTask = isCurrentWeek(created_week, created_year);
  if (
    isCurrentWeekTask &&
    !parent_task_id &&
    !carried_over_from_task_id &&
    start_date &&
    start_date < todayStr()
  ) {
    return { status: 400, error: "Start date cannot be in the past." };
  }

  const finalStartDate = start_date || (isCurrentWeekTask ? todayStr() : null);
  const finalEndDate = end_date || null;
  let finalAssignedTo = assigned_to || null;

  // A task with a project but no assignee defaults to the project owner.
  if (!finalAssignedTo && finalProjectId) {
    try {
      const ownerResult = await getProjectOwnerId(finalProjectId);
      if (ownerResult.rows.length > 0 && ownerResult.rows[0].owner_id) {
        finalAssignedTo = ownerResult.rows[0].owner_id;
      }
    } catch {
      /* the owner probe is best-effort */
    }
  }

  // Cannot assign to a Super Admin (unless assigning to themselves).
  if (finalAssignedTo) {
    try {
      const superAdminCheck = await getSuperAdminContact(finalAssignedTo);
      if (superAdminCheck.rows.length > 0 && finalAssignedTo !== user_id) {
        return { status: 400, error: "Cannot assign tasks to a Super Admin." };
      }
    } catch {
      /* the probe is best-effort */
    }
  }

  const finalStatus = status || "in_progress";
  const pendingApproval = false;

  // Assigning to someone else does not set assigned_to directly — it opens a
  // pending assignment the assignee must accept.
  const needsAssignment = finalAssignedTo && finalAssignedTo !== user_id;
  const effectiveAssignedTo = needsAssignment ? null : finalAssignedTo;

  // Contact Group enforcement: the assigner and assignee must share a group.
  if (needsAssignment && role !== "super_admin") {
    const groupCheck = await validateTaskAssignment(user_id, finalAssignedTo, {
      context_type: context_type || "staff",
      context_id: context_id || null,
    });
    if (!groupCheck.allowed) {
      return {
        status: 403,
        error: `Cannot assign task outside your Contact Group. ${groupCheck.reason || "No shared group found."}`,
      };
    }
  }

  const finalPriority = ["critical", "high", "medium", "low"].includes(priority)
    ? priority
    : "medium";

  const result = await createTask({
    user_id,
    user_name,
    title,
    description,
    status: finalStatus,
    project_id: finalProjectId,
    category: finalCategory,
    created_week,
    created_year,
    carried_over_from_task_id,
    parent_task_id,
    start_date: finalStartDate,
    end_date: finalEndDate,
    assigned_to: effectiveAssignedTo,
    link,
    priority: finalPriority,
    context_type,
    context_id,
    // Management field: only a staff-side caller may set a supervisor (it grants
    // access to the task). A participant's value is ignored.
    supervisor_id: seesWholePortfolio(role) ? supervisor_id || null : null,
    intent_id,
  });

  const taskId = Number(result.rows[0]?.id || result.lastInsertRowid);

  // ─── SUBTASK ⇄ PARENT CASCADE on creation (Phase 13) ───
  if (parent_task_id) {
    try {
      const incompleteSubtasks = await countIncompleteSubtasks(parseInt(parent_task_id));
      if ((Number(incompleteSubtasks.rows[0]?.total) || 0) === 0) {
        const parentBlockersResult = await getActiveBlockersForTask(parseInt(parent_task_id));
        if (parentBlockersResult.rows.length === 0) {
          await markTaskCompleted(parseInt(parent_task_id));
        }
      } else {
        await reopenCompletedTask(parseInt(parent_task_id));
      }
    } catch {
      /* the cascade is best-effort */
    }
  }

  // Audit log: Task Created
  await logAuditEvent({
    entity_type: "task",
    entity_id: taskId,
    user_id,
    user_name: user_name || "",
    action: pendingApproval ? "created_pending_approval" : "created",
    details: `Task "${title}" created${pendingApproval ? " (pending project approval)" : ""} (Week ${created_week}, ${created_year})`,
    metadata: {
      title,
      status: finalStatus,
      project_id: finalProjectId,
      category: finalCategory,
      created_week,
      created_year,
    },
  });

  // Immutable task audit trail
  await logTaskEvent({
    task_id: taskId,
    project_id: finalProjectId,
    actor_id: user_id,
    target_user_id: user_id,
    action_type: pendingApproval
      ? ACTION_TYPES.TASK_UPDATED
      : ACTION_TYPES.TASK_CREATED,
    new_state: {
      title,
      status: finalStatus,
      project_id: finalProjectId,
      category: finalCategory,
    },
    description: `Task "${title}" created${pendingApproval ? " (pending project approval)" : ""}`,
  });

  // ─── Notify super admins about new sub-tasks ───
  if (parent_task_id) {
    try {
      const parentTitle = (await getTaskTitleById(parent_task_id)) || "Unknown";
      const superAdminsResult = await getActiveSuperAdmins();
      for (const superAdmin of superAdminsResult.rows) {
        await insertNotificationWithCreatedAt(
          superAdmin.cid,
          "New Sub-task Created",
          `${user_name || user_id} added sub-task "${title}" under "${parentTitle}"`,
          "subtask",
        );
      }
    } catch {
      /* the notification fan-out is best-effort */
    }
  }

  // ─── Auto-upsert weekly standup (unified task→standup sync) ───
  try {
    const userResult = await getContactRoleByCid(user_id);
    const userRole = userResult.rows[0]?.role || "staff";

    await standupUpsert({
      user_id,
      user_name: user_name || "Unknown",
      user_role: userRole,
      week_number: created_week,
      year: created_year,
      taskContext: { title, status: finalStatus },
    });
  } catch (error) {
    console.error("Standup upsert failed (non-blocking):", error.message);
  }

  // ─── Task Assignment Workflow ───
  if (needsAssignment) {
    try {
      await insertTaskAssignment(taskId, user_id, finalAssignedTo);
      // Notify the assignee — resolve a display name if none was given.
      const taskRef = title || "#" + taskId;
      let notifyName = user_name;
      if (!notifyName) {
        try {
          const nameResult = await getContactNameByCid(user_id);
          if (nameResult.rows.length > 0) notifyName = nameResult.rows[0].name;
        } catch {
          /* the name probe is best-effort */
        }
      }
      await insertNotification(
        finalAssignedTo,
        "New Task Assignment",
        `${notifyName || user_id} assigned you task "${taskRef}"`,
        "task_assignment",
      );
    } catch (error) {
      console.error("Task assignment creation failed:", error.message);
    }
  }

  // ─── Sync parent end_date if the subtask extends further ───
  if (parent_task_id && finalEndDate) {
    try {
      const parentEndStr = await getTaskEndDateById(parseInt(parent_task_id));
      if (parentEndStr) {
        const parentEndDate = new Date(parentEndStr);
        const subtaskEndDate = new Date(finalEndDate);
        if (subtaskEndDate > parentEndDate) {
          await updateTaskEndDate(finalEndDate, parseInt(parent_task_id));
        }
      }
    } catch {
      /* the parent stretch is best-effort */
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      id: taskId,
      action: pendingApproval ? "created_pending_approval" : "created",
      pendingApproval,
    },
  };
}
