/**
 * Tasks — the assignment branches of the PUT field assembly.
 *
 * Part of the `updateFields` field assembly (see docs/LAYER_SPLIT.md). Decisions
 * only, no SQL, no HTTP. It reads and writes through `@/models/**`.
 */

import {
  getPendingAssignmentId,
  insertTaskAssignment,
  getContactNameByCid,
  insertNotification,
} from "@/models/tasks";
import { validateTaskAssignment } from "@/models/contactGroups";
import { pushTaskField } from "./patch";

/**
 * The assignment branches. Only the un-assign and self-assign branches write the
 * column; assigning someone else opens a pending assignment instead, so the task
 * stays unassigned until the target accepts.
 *
 * @returns {Promise<{pendingAssignmentCreated: boolean, failure?: Object}>}
 */
export async function applyAssignmentChange(patch, {
  id,
  task,
  input,
  role,
  sessionCid,
  sessionName,
}) {
  const { assigned_to, user_id, user_name } = input;
  const pendingAssignmentCreated = false;

  if (assigned_to === undefined) {
    return { pendingAssignmentCreated };
  }

  const assignmentChanged = String(assigned_to) !== String(task.assigned_to || "");
  const effectiveUserId = user_id || sessionCid;

  // Un-assign: clear directly (no pending workflow needed).
  if (assignmentChanged && !assigned_to) {
    pushTaskField(patch, "assigned_to", null, "assignment removed");
    patch.auditDetails = `Assignment removed for task "${task.title}"`;
    return { pendingAssignmentCreated };
  }

  // Self-assign: set directly.
  if (
    assignmentChanged &&
    assigned_to &&
    String(assigned_to) === String(effectiveUserId)
  ) {
    pushTaskField(patch, "assigned_to", assigned_to, `self-assigned`);
    patch.auditDetails = `Task "${task.title}" self-assigned`;
    return { pendingAssignmentCreated };
  }

  if (!assignmentChanged || !assigned_to) {
    return { pendingAssignmentCreated };
  }

  // Assign to another user: open a pending assignment (accept/decline).
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
        pendingAssignmentCreated,
        failure: {
          status: 403,
          error: `Cannot assign task outside your Contact Group. ${groupCheck.reason || "No shared group found."}`,
        },
      };
    }
  }

  // The task stays unassigned until acceptance.
  patch.changes.push(`pending assignment to user ${assigned_to}`);
  patch.auditDetails = `Task "${task.title}" pending assignment to user ${assigned_to}`;

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

  return { pendingAssignmentCreated: true };
}
