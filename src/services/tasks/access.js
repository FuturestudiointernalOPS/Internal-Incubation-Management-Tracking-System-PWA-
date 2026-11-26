/**
 * Tasks — task access (SERVICE layer).
 *
 * The one rule every task sub-resource (comments, resources, logs, duplication,
 * carry-over, reconcile, blocker discussion) asks before reading or writing:
 * may this caller touch this task? Holders of `tasks.act_any` always may;
 * everyone else must be the task's owner, its assignee or its supervisor.
 *
 * Extracted once so the rule cannot drift between the endpoints that share it.
 * The verdict is resolved through the authorization engine — never from the
 * role label — and the pure rule stays pure so it is testable on its own.
 *
 * Layer (see docs/LAYER_SPLIT.md): a decision plus its resolution; no SQL, no
 * HTTP. The context read goes through `@/models/authorization`.
 */

import {
  getAuthorizationContext,
  authorize,
} from "@/models/authorization/index";

/** Is this person the task's owner, its assignee, or its supervisor? */
export function ownsTask(task, cid) {
  return (
    String(task.user_id) === String(cid) ||
    String(task.assigned_to || "") === String(cid) ||
    String(task.supervisor_id || "") === String(cid)
  );
}

/** May this caller see or act on this task, given the resolved verdict? */
export function canAccessTask({ task, cid, canActAny = false }) {
  return canActAny || ownsTask(task, cid);
}

/**
 * Resolve one task right for a session-shaped identity (`role` + `cid`).
 *
 * The context is cached per identity (10s) and shared across callers, so the
 * services below pay one read, not one per question. A resolution failure is a
 * closed door.
 */
export async function resolveTaskRight({ role, cid }, capability) {
  if (!cid) return false;
  try {
    return authorize(
      await getAuthorizationContext({ cid, role }),
      "tasks",
      capability,
    );
  } catch (_) {
    return false;
  }
}

/** `tasks.act_any` — may this caller act on a task it does not own? */
export function resolveTaskActAny({ role, cid }) {
  return resolveTaskRight({ role, cid }, "act_any");
}

/** `tasks.moderate` — may this caller moderate somebody else's sub-resources? */
export function resolveTaskModerate({ role, cid }) {
  return resolveTaskRight({ role, cid }, "moderate");
}

/** The whole rule, for the services that hold only `role` + `sessionCid`. */
export async function canAccessTaskFor({ task, role, cid }) {
  return canAccessTask({
    task,
    cid,
    canActAny: await resolveTaskActAny({ role, cid }),
  });
}
