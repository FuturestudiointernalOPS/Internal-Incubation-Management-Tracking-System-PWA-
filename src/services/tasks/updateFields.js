/**
 * Tasks — the PUT /api/tasks FIELD ASSEMBLY (SERVICE layer).
 *
 * The update is written as one `UPDATE … SET` built column by column, so this
 * module is the place where "what does this change actually mean" is decided:
 *
 *   - the link / priority fields, and the title / description pair;
 *   - the status field, its audit action, and the `completed_at` stamp — dropped
 *     again when a completed task reopens, so a later status change can never
 *     resurrect a "completed but carried over" state;
 *   - the project reassignment and its revalidation: a member keeps their status,
 *     a non-member is reset to `pending_project_approval` and an approval request
 *     is opened;
 *   - the context pair (type / id) and the intent link, including the best-effort
 *     supervisor inheritance from the intent's responsible;
 *   - the three assignment branches — un-assign (direct), self-assign (direct),
 *     and assign-to-someone (a PENDING assignment the target must accept, gated
 *     by the contact-group rule and notified);
 *   - the schedule drift detection: the first schedule is captured once and any
 *     later change counts as a reschedule;
 *   - the date rules.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions only, no SQL, no HTTP. It reads and
 * writes through `@/models/**`.
 *
 * Every helper mutates the `patch` accumulator passed in rather than returning a
 * column list: the SET order and the `changes` order are part of the audit
 * trail the client reads back, so the assembly is deliberately sequential.
 */

import {
  getProjectMembership,
  insertProjectApprovalRequest,
  getPendingAssignmentId,
  insertTaskAssignment,
  getContactNameByCid,
  insertNotification,
  getIntentResponsibleId,
} from "@/models/tasks";
import { validateTaskAssignment } from "@/models/contactGroups";
import { isValidDateStr } from "./dates";

const PRIORITIES = ["critical", "high", "medium", "low"];

/**
 * A fresh SET accumulator. `auditAction` / `auditDetails` travel with it because
 * the assignment branches refine what the status block decided.
 */
export function newTaskFieldPatch() {
  return {
    fields: [],
    args: [],
    changes: [],
    auditAction: "updated",
    auditDetails: "",
  };
}

/**
 * Push one column onto the SET. Exported because the orchestrator owns the
 * supervisor gate itself (it is pinned by a security suite on this file).
 */
export function pushTaskField(patch, column, value, change) {
  patch.fields.push(`${column} = ?`);
  patch.args.push(value);
  if (change) patch.changes.push(change);
}

/** The link and the priority — the two cheap, purely descriptive columns. */
export function applyLinkAndPriority(patch, { task, input }) {
  const { link, priority } = input;

  if (link !== undefined && link !== task.link) {
    pushTaskField(patch, "link", link || null, "link updated");
  }
  if (
    priority !== undefined &&
    PRIORITIES.includes(priority) &&
    priority !== task.priority
  ) {
    pushTaskField(patch, "priority", priority, `priority changed to ${priority}`);
  }
}

/**
 * Title, description, status, project and the context pair — everything that
 * describes the task itself.
 */
export async function applyContentFields(patch, { id, task, input }) {
  const {
    title,
    description,
    status,
    project_id,
    user_id,
    user_name,
    context_type,
    context_id,
  } = input;

  if (title !== undefined && title !== task.title) {
    pushTaskField(patch, "title", title, `title changed to "${title}"`);
  }

  if (description !== undefined && description !== task.description) {
    pushTaskField(patch, "description", description, "description updated");
  }

  if (status !== undefined && status !== task.status) {
    pushTaskField(patch, "status", status, `status changed to ${status}`);

    if (status === "completed") {
      patch.fields.push("completed_at = CURRENT_TIMESTAMP");
      patch.auditAction = "completed";
      patch.auditDetails = `Task "${task.title}" marked as completed`;
    } else if (status === "carried_over") {
      patch.auditAction = "carried_over";
      patch.auditDetails = `Task "${task.title}" carried over to next week`;
    } else if (status === "archived") {
      patch.auditAction = "archived";
      patch.auditDetails = `Task "${task.title}" archived`;
    } else {
      patch.auditDetails = `Task "${task.title}" status changed from ${task.status} to ${status}`;
    }

    // Reopening a completed task drops its completion timestamp, so a later
    // status change can never resurrect a "completed but carried over" state.
    if (task.status === "completed" && status !== "completed") {
      patch.fields.push("completed_at = NULL");
    }
  }

  if (project_id !== undefined) {
    const projectChanged = String(project_id) !== String(task.project_id);
    pushTaskField(
      patch,
      "project_id",
      project_id || null,
      "project reassigned",
    );

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
        const statusAt = patch.fields.findIndex((field) =>
          field.startsWith("status ="),
        );
        if (statusAt >= 0) {
          patch.fields.splice(statusAt, 1);
          patch.args.splice(statusAt, 1);
        }
        patch.fields.push("status = 'pending_project_approval'");
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
        patch.changes.push("project reassignment requires approval");
      }
    }
  }

  // ── PHASE 1: Context fields ──
  if (context_type !== undefined && context_type !== (task.context_type || null)) {
    pushTaskField(
      patch,
      "context_type",
      context_type || null,
      `context_type changed to ${context_type}`,
    );
  }
  if (
    context_id !== undefined &&
    String(context_id) !== String(task.context_id || "")
  ) {
    pushTaskField(patch, "context_id", context_id || null, `context_id changed`);
  }
}

/** The intent link, with the best-effort supervisor inheritance from it. */
export async function applyIntentField(patch, { task, input }) {
  const { intent_id, supervisor_id } = input;

  if (
    intent_id === undefined ||
    String(intent_id) === String(task.intent_id || "")
  ) {
    return;
  }

  pushTaskField(patch, "intent_id", intent_id || null, "intent linked");

  // Auto-populate the supervisor from the intent if not explicitly set.
  if (intent_id && !supervisor_id && !task.supervisor_id) {
    try {
      const intentResult = await getIntentResponsibleId(intent_id);
      if (intentResult.rows.length > 0 && intentResult.rows[0].responsible_id) {
        pushTaskField(
          patch,
          "supervisor_id",
          intentResult.rows[0].responsible_id,
          "supervisor inherited from intent",
        );
      }
    } catch {
      /* inheritance is best-effort */
    }
  }
}

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

/**
 * The schedule columns plus the drift detection: the first schedule is captured
 * once, and any later change is counted as a reschedule.
 */
export function applyScheduleFields(patch, { task, input }) {
  const { start_date, end_date } = input;
  let needsRescheduleInc = false;
  let dateChangeLog = null; // { field, old_val, new_val } for task_audit_logs

  if (start_date !== undefined) {
    const dateChanged = start_date !== (task.start_date || null);
    pushTaskField(patch, "start_date", start_date || null);

    if (dateChanged) {
      dateChangeLog = {
        field: "start_date",
        old_val: task.start_date,
        new_val: start_date,
      };
      patch.changes.push("start date updated");
      // First schedule is immutable once set.
      if (!task.first_scheduled_start_date && start_date) {
        pushTaskField(
          patch,
          "first_scheduled_start_date",
          start_date,
          "first schedule captured",
        );
      } else if (
        task.first_scheduled_start_date &&
        start_date !== task.first_scheduled_start_date
      ) {
        needsRescheduleInc = true;
        patch.changes.push("schedule drift detected");
      }
    }
  }

  if (end_date !== undefined) {
    const dateChanged = end_date !== (task.end_date || null);
    pushTaskField(patch, "end_date", end_date || null);

    if (dateChanged) {
      dateChangeLog = {
        field: "end_date",
        old_val: task.end_date,
        new_val: end_date,
      };
      patch.changes.push("end date updated");
      if (!task.first_scheduled_end_date && end_date) {
        pushTaskField(
          patch,
          "first_scheduled_end_date",
          end_date,
          "first schedule captured",
        );
      } else if (
        task.first_scheduled_end_date &&
        end_date !== task.first_scheduled_end_date
      ) {
        needsRescheduleInc = true;
        patch.changes.push("schedule drift detected");
      }
    }
  }

  return { needsRescheduleInc, dateChangeLog };
}

/** ─── DATE VALIDATION (Phase 13) ─── */
export function validateTaskDates({ task, input }) {
  const { start_date, end_date } = input;

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

  return null;
}