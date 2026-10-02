/**
 * Tasks — BLOCKERS (SERVICE layer).
 *
 * The domain work behind `/api/blockers` and `/api/blockers/discuss`. A blocker
 * is always tied to a task, so it lives with the tasks domain. What lives here:
 *
 *   - the READ scope: a Super Admin sees everything; everyone else sees only the
 *     blockers of the tasks they own, are assigned to, or supervise, and a
 *     supervisor may additionally read a supervisee's blockers;
 *   - the CREATE rules: the task must exist and not be closed, and only the task
 *     owner, its assignee, its supervisor or a Super Admin may raise one; the
 *     creation also marks the task blocked, writes the audit entry and fans a
 *     best-effort bell notification out to the Super Admins;
 *   - the RESOLVE rule: only the blocker's creator may resolve it, and the task
 *     returns to `in_progress` once its last active blocker is gone;
 *   - the EDIT/DELETE rules: only the creator (or a Super Admin, for delete) may
 *     touch a blocker;
 *   - the discussion messages on a blocker and their two notifications.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`. The controller keeps auth and the
 * response envelope.
 */

import { isSupervisorOf } from "@/lib/auth";
import { getTaskTitleById } from "@/models/tasks";
import {
  createBlocker,
  createBlockerDiscussion,
  deleteBlocker,
  getAllBlockers,
  getBlockerById,
  getBlockerDiscussions,
  getBlockerForDiscussion,
  getBlockersForUser,
  getOtherActiveBlockersForTask,
  getTaskForBlockerCheck,
  markTaskBlocked,
  notifyBlockerCreatorOfDiscussion,
  notifySuperAdminOfDiscussion,
  notifySuperAdminsOfBlocker,
  resolveBlocker,
  revertTaskFromBlocked,
  updateBlockerFields,
} from "@/models/blockers";
import { logAuditEvent } from "./auditLog";

/** Task statuses on which a blocker may no longer be raised. */
const CLOSED_STATUSES = ["completed", "archived", "carried_over"];

/**
 * List blockers, scoped to what the caller may see.
 *
 * @param {{session: Object, filters: {id?: string, task_id?: string, user_id?: string, status?: string}}} args
 * @returns {Promise<{status: number, body?: Object, error?: string}>}
 */
export async function listBlockers({ session, filters }) {
  if (session.role !== "super_admin") {
    // SECURITY (Phase 0): Non-SA users can only see blockers on their own tasks
    // or tasks assigned to them. (Phase 3B): a supervisor may also read their
    // supervisee's blockers.
    const viewingOther =
      filters.user_id && String(filters.user_id) !== String(session.cid);
    const isSupervisor = viewingOther
      ? await isSupervisorOf(session.cid, filters.user_id)
      : false;
    if (viewingOther && !isSupervisor) {
      return { status: 403, error: "You can only view your own blockers." };
    }
    // Scope to blockers where the task belongs to, assigned to, or supervised by
    // the user; when acting as a supervisor, scope to the supervisee's tasks.
    const scopeCid = isSupervisor ? String(filters.user_id) : String(session.cid);
    const result = await getBlockersForUser(scopeCid, { ...filters, isSupervisor });
    return { status: 200, body: { success: true, blockers: result.rows } };
  }

  // SA: unrestricted access with optional filters
  const result = await getAllBlockers(filters);
  return { status: 200, body: { success: true, blockers: result.rows } };
}

/**
 * Create a blocker on a task: existence, permission and closed-status rules,
 * then the write, the task's blocked flip, the audit and the Super-Admin notice.
 *
 * @returns {Promise<{status: number, body?: Object, error?: string}>}
 */
export async function createBlockerForTask({ session, input }) {
  const {
    task_id,
    user_id,
    user_name,
    title,
    description,
    severity,
    reference_url,
    notes,
  } = input;

  if (!task_id || !user_id || !title) {
    return {
      status: 400,
      error: "task_id, user_id, and title are required",
    };
  }

  // Verify the task exists and is not closed
  const taskCheck = await getTaskForBlockerCheck(task_id);
  if (taskCheck.rows.length === 0) {
    return { status: 404, error: "Task not found" };
  }
  const task = taskCheck.rows[0];

  // SECURITY: Only task owner, assignee, supervisor, or SA can add a blocker
  if (
    session.role !== "super_admin" &&
    String(task.user_id) !== String(session.cid) &&
    String(task.assigned_to || "") !== String(session.cid) &&
    String(task.supervisor_id || "") !== String(session.cid)
  ) {
    return {
      status: 403,
      error: "You do not have permission to add a blocker to this task.",
    };
  }

  if (CLOSED_STATUSES.includes(task.status)) {
    return {
      status: 400,
      error:
        "Cannot add a blocker to a closed task. The task is already " +
        task.status +
        ".",
    };
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

  return { status: 200, body: { success: true, id: blockerId, action: "created" } };
}

/**
 * Resolve or edit a blocker. Resolving is creator-only and may return the task
 * to `in_progress`; editing (title/description/severity) is creator-only too.
 *
 * @returns {Promise<{status: number, body?: Object, error?: string}>}
 */
export async function updateBlockerRecord({ session, input }) {
  const { id, title, description, severity, status } = input;

  if (!id) {
    return { status: 400, error: "id is required" };
  }

  // Fetch the blocker to check ownership
  const blockerCheck = await getBlockerById(id);
  if (blockerCheck.rows.length === 0) {
    return { status: 404, error: "Blocker not found" };
  }
  const blocker = blockerCheck.rows[0];

  // Resolving a blocker: only the blocker creator may resolve
  if (status === "resolved") {
    if (String(blocker.user_id) !== String(session.cid)) {
      return {
        status: 403,
        error: "Only the blocker creator can mark it as resolved",
      };
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

    return { status: 200, body: { success: true, action: "resolved" } };
  }

  // Non-resolve updates: only creator can edit (using session identity)
  if (String(blocker.user_id) !== String(session.cid)) {
    return { status: 403, error: "Only the blocker creator can edit it" };
  }

  await updateBlockerFields(id, { title, description, severity });
  return { status: 200, body: { success: true, action: "updated" } };
}

/**
 * Delete a blocker. The creator may always delete it; a Super Admin may too. A
 * missing blocker is a no-op success (the original behaviour).
 *
 * @returns {Promise<{status: number, body?: Object, error?: string}>}
 */
export async function deleteBlockerRecord({ session, id }) {
  const blockerCheck = await getBlockerById(id);

  if (blockerCheck.rows.length > 0) {
    const blocker = blockerCheck.rows[0];

    // SECURITY: Only creator or SA can delete (using session identity)
    if (
      session.role !== "super_admin" &&
      String(blocker.user_id) !== String(session.cid)
    ) {
      return {
        status: 403,
        error: "Only the blocker creator can delete it",
      };
    }

    await deleteBlocker(id);
  }

  return { status: 200, body: { success: true, action: "deleted" } };
}

/** List a blocker's discussion messages, oldest first. */
export async function listBlockerDiscussions({ blocker_id }) {
  if (!blocker_id) {
    return { status: 400, error: "blocker_id is required" };
  }
  const result = await getBlockerDiscussions(blocker_id);
  return { status: 200, body: { success: true, messages: result.rows } };
}

/**
 * Post a discussion message on a blocker and fan the two notices out: to the
 * blocker's creator (unless they wrote it) and to the Super Admins (unless the
 * sender is one).
 *
 * @returns {Promise<{status: number, body?: Object, error?: string}>}
 */
export async function postBlockerDiscussion({ input }) {
  const { blocker_id, sender_id, sender_name, body: messageBody } = input;

  if (!blocker_id || !sender_id || !messageBody || !messageBody.trim()) {
    return {
      status: 400,
      error: "blocker_id, sender_id, and body are required",
    };
  }

  // Verify the blocker exists
  const blockerCheck = await getBlockerForDiscussion(blocker_id);
  if (blockerCheck.rows.length === 0) {
    return { status: 404, error: "Blocker not found" };
  }
  const blocker = blockerCheck.rows[0];

  const result = await createBlockerDiscussion({
    blocker_id,
    sender_id,
    body: messageBody,
  });

  // Notify the blocker creator (unless they're the one commenting)
  if (blocker.user_id && blocker.user_id !== sender_id) {
    try {
      await notifyBlockerCreatorOfDiscussion({
        user_id: blocker.user_id,
        sender_name,
        blocker_title: blocker.title,
      });
    } catch (_) {}
  }

  // Also notify super admin if they're not the sender
  if (sender_id !== "sa") {
    try {
      await notifySuperAdminOfDiscussion({
        sender_name,
        blocker_title: blocker.title,
      });
    } catch (_) {}
  }

  const row = result.rows[0] || {};
  return {
    status: 200,
    body: { success: true, id: Number(row.id), created_at: row.created_at },
  };
}
