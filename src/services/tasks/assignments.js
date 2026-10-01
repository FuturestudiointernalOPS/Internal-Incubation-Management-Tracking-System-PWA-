/**
 * Tasks — assignment use cases (SERVICE layer).
 *
 * The domain work behind `/api/tasks/assignments`: listing a caller's
 * assignments and responding to one (accept / decline / reassign).
 *
 * The CONTROLLER authenticates and validates; everything below is the rule set:
 *
 *   - who may list whose assignments (the shared listing-scope rule);
 *   - accept/decline is only valid while the assignment is pending, and only the
 *     assignee may act;
 *   - reassign belongs to the assigner (or Super Admin) and, for everyone else,
 *     must stay inside the caller's contact group;
 *   - accepting points the task at its assignee and syncs the assignee's
 *     standup; declining/reassigning clear the old assignment so it drops off
 *     the old assignee's list.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import {
  getAssignments,
  getAssignmentById,
  getTaskAssignmentMeta,
  declineAssignment,
  createAssignmentDeclinedNotification,
  acceptAssignment,
  updateTaskAssignedTo,
  getContactById,
  createAssignmentAcceptedNotification,
  getTaskAssignmentContext,
  declineAssignmentForReassign,
  clearTaskAssignee,
  createAssignment,
  createAssignmentReassignedNotification,
} from "@/models/taskAssignments";
import { standupUpsert } from "@/models/standupUpsert";
import { validateTaskAssignment } from "@/models/contactGroups";
import {
  getPendingAssignmentById,
  getPendingAssignmentByTaskAndAssignee,
  updateAssignmentStatus,
  assignTaskToUser,
  getTaskTitleRowById,
  insertNotification,
} from "@/models/tasks";
import { logAuditEvent } from "@/lib/audit";
import { resolveListingScope } from "@/services/authorization/listingScope";

/** The assignments a caller may see (their own unless they hold a portfolio role). */
export async function listTaskAssignments({
  role,
  sessionCid,
  requestedCid,
  status,
}) {
  const scope = resolveListingScope({
    role,
    sessionCid,
    requestedCid,
    denialMessage: "You can only view your own assignments.",
  });
  if (scope.denied) return { status: 403, error: scope.denied };

  const result = await getAssignments(scope.cid, status || "pending");
  return { status: 200, body: { success: true, assignments: result.rows } };
}

/**
 * Accept, decline or reassign a task assignment.
 *
 * @returns {Promise<{status: number, error?: string, body?: Object}>}
 */
export async function respondToTaskAssignment({
  assignmentId,
  action,
  newAssigneeId,
  sessionCid,
  sessionName,
  role,
}) {
  const assignmentResult = await getAssignmentById(assignmentId);
  if (assignmentResult.rows.length === 0) {
    return { status: 404, error: "Assignment not found" };
  }
  const assignment = assignmentResult.rows[0];

  // Accept/decline are only valid while the assignment is pending. Reassign
  // works on any assignment (it supersedes the current one).
  if (action !== "reassign" && assignment.status !== "pending") {
    return { status: 400, error: "Assignment no longer pending" };
  }

  const userCid = sessionCid;

  if (action === "reassign") {
    if (!newAssigneeId) {
      return { status: 400, error: "new_assignee_id required for reassign" };
    }
    if (role !== "super_admin" && assignment.assigner_id !== userCid) {
      return { status: 403, error: "Only the assigner can reassign" };
    }
  } else if (assignment.assignee_id !== userCid) {
    // Accept/decline: only the assignee can respond.
    return { status: 403, error: "Only the assignee can respond" };
  }

  const taskResult = await getTaskAssignmentMeta(assignment.task_id);
  const task = taskResult.rows[0];
  const taskLabel = task?.title || `#${assignment.task_id}`;
  const actor = sessionName || userCid;

  if (action === "decline") {
    await declineAssignment(assignmentId);
    await createAssignmentDeclinedNotification(
      assignment.assigner_id,
      "Assignment Declined",
      `${actor} declined task "${taskLabel}"`,
      "task_assignment",
    );
    return { status: 200, body: { success: true, action: "declined" } };
  }

  if (action === "accept") {
    await acceptAssignment(assignmentId);
    await updateTaskAssignedTo(assignment.assignee_id, assignment.task_id);

    // Sync the accepted task into the assignee's standup (best effort).
    if (task) {
      const contactResult = await getContactById(assignment.assignee_id);
      const contact = contactResult.rows[0] || {};
      try {
        await standupUpsert({
          user_id: assignment.assignee_id,
          user_name: contact.name || assignment.assignee_id,
          user_role: contact.role || "staff",
          week_number: task.created_week || 0,
          year: task.created_year || 0,
          taskContext: { title: task.title, status: "in_progress" },
        });
      } catch {
        /* the standup sync is best-effort */
      }
    }

    await createAssignmentAcceptedNotification(
      assignment.assigner_id,
      "Assignment Accepted",
      `${actor} accepted task "${taskLabel}"`,
      "task_assignment",
    );
    return { status: 200, body: { success: true, action: "accepted" } };
  }

  if (action === "reassign") {
    // Permission checked above — only the assigner/Super Admin reaches here.
    // Contact-group enforcement for everyone but Super Admin: you may only
    // reassign within your own group.
    if (role !== "super_admin") {
      const taskContextResult = await getTaskAssignmentContext(assignment.task_id);
      const taskContext = taskContextResult.rows[0] || {};
      const groupCheck = await validateTaskAssignment(userCid, newAssigneeId, {
        context_type: taskContext.context_type || "staff",
        context_id: taskContext.context_id || null,
      });
      if (!groupCheck.allowed) {
        return {
          status: 403,
          error: `Cannot reassign outside your Contact Group. ${groupCheck.reason || "No shared group found."}`,
        };
      }
    }

    // Retire the old assignment: a pending one is declined; an accepted one has
    // the task's assignee cleared.
    if (assignment.status === "pending") {
      await declineAssignmentForReassign(assignmentId);
    }
    if (assignment.status === "accepted") {
      await clearTaskAssignee(assignment.task_id);
    }

    await createAssignment(assignment.task_id, userCid, newAssigneeId);

    await createAssignmentReassignedNotification(
      newAssigneeId,
      "New Task Assignment",
      `${actor} reassigned you task "${taskLabel}"`,
      "task_assignment",
    );
    return { status: 200, body: { success: true, action: "reassigned" } };
  }

  return { status: 400, error: "Invalid action" };
}

/**
 * Accept or decline a PENDING assignment (the PATCH /api/tasks endpoint).
 *
 * The assignment is located either by its own id, or by the task id plus the
 * session user (their pending assignment on that task). Only the assignee may
 * respond.
 *
 * @returns {Promise<{status: number, error?: string, body?: Object}>}
 */
export async function respondToPendingAssignment({
  action,
  taskAssignmentId,
  taskId,
  sessionCid,
  sessionName,
}) {
  let assignment;
  if (taskAssignmentId) {
    const res = await getPendingAssignmentById(parseInt(taskAssignmentId));
    assignment = res.rows[0];
  } else {
    const res = await getPendingAssignmentByTaskAndAssignee(
      parseInt(taskId),
      sessionCid,
    );
    assignment = res.rows[0];
  }

  if (!assignment) {
    return { status: 404, error: "No pending assignment found." };
  }

  // Only the assignee can accept or decline.
  if (String(assignment.assignee_id) !== String(sessionCid)) {
    return {
      status: 403,
      error: "You can only respond to your own assignments.",
    };
  }

  const newStatus = action === "accept" ? "accepted" : "declined";
  await updateAssignmentStatus(newStatus, assignment.id);

  // Accepting points the task at its assignee.
  if (action === "accept") {
    await assignTaskToUser(assignment.assignee_id, assignment.task_id);
  }

  // The current title, for the notification and the audit entry.
  let taskTitle = `Task #${assignment.task_id}`;
  try {
    const taskResult = await getTaskTitleRowById(assignment.task_id);
    if (taskResult.rows.length > 0) {
      taskTitle = taskResult.rows[0].title;
    }
  } catch {
    /* title lookup is best-effort */
  }

  const actor = sessionName || sessionCid;
  const notificationTitle =
    action === "accept"
      ? "Task Assignment Accepted"
      : "Task Assignment Declined";
  const notificationMessage =
    action === "accept"
      ? `${actor} accepted your assignment for task "${taskTitle}"`
      : `${actor} declined your assignment for task "${taskTitle}"`;

  try {
    await insertNotification(
      assignment.assigner_id,
      notificationTitle,
      notificationMessage,
      "task_assignment",
    );
  } catch (notifErr) {
    console.error(
      "Assignment response notification failed:",
      notifErr.message,
    );
  }

  await logAuditEvent({
    entity_type: "task",
    entity_id: assignment.task_id,
    user_id: sessionCid,
    user_name: sessionName || "",
    action:
      action === "accept" ? "assignment_accepted" : "assignment_declined",
    details: `Task "${taskTitle}" assignment ${action === "accept" ? "accepted" : "declined"} by ${actor}`,
    metadata: {
      task_id: assignment.task_id,
      assigner_id: assignment.assigner_id,
    },
  });

  return { status: 200, body: { success: true, action: newStatus } };
}
