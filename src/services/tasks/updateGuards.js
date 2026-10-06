/**
 * Tasks — the PUT /api/tasks ENTRY GUARDS (SERVICE layer).
 *
 * Everything that can refuse an update before a single field is assembled, in
 * the order the original monolith applied it:
 *
 *   1. the access rule — owner, assignee, supervisor or Super Admin;
 *   2. the lock — a locked task (older than 12 hours) cannot have its title or
 *      description changed (the refusal carries `locked: true`);
 *   3. the finer status rule — only the creator or the assignee may move the
 *      status, even when the caller otherwise has access (a supervisor does not);
 *   4. the completion guard — active blockers on the task OR on its subtasks
 *      need an explicit `force_complete`;
 *   5. the carry-over safety — a completed task can never be flipped back to
 *      carried-over.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions only, no SQL, no HTTP. It reads
 * through `@/models/**` and `@/lib/audit`.
 *
 * The order matters and is part of the contract: the lock is read once, before
 * the field assembly, and the blockers are only queried when the caller is
 * actually completing the task.
 */

import {
  getActiveBlockersForTaskWithTitle,
  getActiveBlockersOnSubtasks,
} from "@/models/tasks";
import { isTaskLocked } from "@/services/tasks/auditLog";

/**
 * Run the entry guards of an update.
 *
 * @param {{id: string|number, task: Object, input: Object, role: string, sessionCid: string}} args
 * @returns {Promise<{failure?: {status: number, error?: string, body?: Object}, locked?: boolean}>}
 *   `failure` is the decision the controller turns into the HTTP answer; without
 *   it, `locked` is the lock state the answer reports back.
 */
export async function runUpdateGuards({ id, task, input, role, sessionCid }) {
  const { title, description, status, user_id, force_complete } = input;

  // SECURITY: only the task owner, assignee, supervisor or Super Admin may update.
  const cid = String(sessionCid);
  if (
    role !== "super_admin" &&
    String(task.user_id) !== cid &&
    String(task.assigned_to || "") !== cid &&
    String(task.supervisor_id || "") !== cid
  ) {
    return {
      failure: {
        status: 403,
        error: "You do not have permission to update this task.",
      },
    };
  }

  const locked = await isTaskLocked(id);

  // The status rule is finer than the access rule above: a supervisor may read
  // the task but not move it.
  if (status !== undefined && status !== task.status) {
    const effectiveUserId = user_id || sessionCid;
    if (
      role !== "super_admin" &&
      String(effectiveUserId) !== String(task.user_id) &&
      String(effectiveUserId) !== String(task.assigned_to || "")
    ) {
      return {
        failure: {
          status: 403,
          error: "Only the task creator or assignee can change its status.",
        },
      };
    }
  }

  // Locking: title and description cannot be modified when locked.
  if (locked) {
    if (title !== undefined && title !== task.title) {
      const error =
        "Task is locked (older than 12 hours). Title cannot be modified.";
      return {
        failure: {
          status: 403,
          error,
          body: { success: false, error, locked: true },
        },
      };
    }
    if (description !== undefined && description !== task.description) {
      const error =
        "Task is locked (older than 12 hours). Description cannot be modified.";
      return {
        failure: {
          status: 403,
          error,
          body: { success: false, error, locked: true },
        },
      };
    }
  }

  // Completion protection: active blockers (on the task or its subtasks) need
  // an explicit force_complete. The task and its subtasks are merged into one
  // list so the client can show every blocker behind the confirmation.
  if (status === "completed") {
    const activeBlockers = await getActiveBlockersForTaskWithTitle(parseInt(id));
    const subtaskBlockers = await getActiveBlockersOnSubtasks(parseInt(id));

    const allBlockers = [
      ...activeBlockers.rows.map((blocker) => ({ ...blocker, source: "task" })),
      ...subtaskBlockers.rows.map((blocker) => ({
        ...blocker,
        source: "subtask",
      })),
    ];

    if (allBlockers.length > 0 && !force_complete) {
      return {
        failure: {
          status: 200,
          body: {
            success: false,
            error:
              "This task has active blockers. Please confirm completion or resolve the blocker before proceeding.",
            hasActiveBlockers: true,
            blockers: allBlockers,
          },
        },
      };
    }
  }

  // Carry-over safety: a completed task must never be flipped back to carried_over.
  if (status === "carried_over" && task.status === "completed") {
    return {
      failure: {
        status: 409,
        error: "Completed tasks cannot be marked as carried over.",
      },
    };
  }

  return { locked };
}