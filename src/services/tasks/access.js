/**
 * Tasks — task access (SERVICE layer).
 *
 * The one rule every task sub-resource (comments, resources, logs, duplication,
 * carry-over, reconcile) asks before reading or writing: may this caller touch
 * this task? Portfolio roles always may; everyone else must be the task's owner,
 * its assignee or its supervisor.
 *
 * Extracted once so the rule cannot drift between the endpoints that share it.
 *
 * Layer (see docs/LAYER_SPLIT.md): a pure decision — no SQL, no HTTP.
 */

import { seesWholePortfolio } from "@/services/authorization/listingScope";

/** Is this person the task's owner, its assignee, or its supervisor? */
export function ownsTask(task, cid) {
  return (
    String(task.user_id) === String(cid) ||
    String(task.assigned_to || "") === String(cid) ||
    String(task.supervisor_id || "") === String(cid)
  );
}

/** May this caller see or act on this task? */
export function canAccessTask({ task, role, cid }) {
  return seesWholePortfolio(role) || ownsTask(task, cid);
}
