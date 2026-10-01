/**
 * Communications — message visibility (REPOSITORY layer).
 *
 * The one statement that lists the messages a caller may see, assembled from the
 * visibility PLAN the service decided (`mode`, the caller's cid, and whether the
 * staff broadcast and the group/program scopes apply).
 *
 * SQL is byte-identical to what used to sit inline in
 * `models/communications.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions — the plan carries the decision, this only renders it.
 */

import db from "@/lib/db";

/**
 * List the messages a plan admits.
 *
 * `plan.mode === "all"` is the Super Admin view: everything (individual and
 * broadcasts), optionally narrowed to one participant. Every other mode is the
 * caller's own messages plus the group/program scopes they belong to; broadcasts
 * stay Super-Admin-only unless `includeStaffBroadcast` says otherwise.
 */
export function selectMessagesForScope(plan) {
  let query = "SELECT * FROM v2_messages";
  let args = [];

  if (plan.mode === "all") {
    if (plan.targetCid) {
      query += " WHERE (recipient_id = ? OR sender_id = ? OR target_type = 'all')";
      args = [plan.targetCid, plan.targetCid];
    }
  } else {
    const visibility = ["(recipient_id = ? OR sender_id = ?)"];
    const visArgs = [plan.targetCid, plan.targetCid];

    if (plan.includeStaffBroadcast) {
      visibility.push("(target_type = 'role' AND target_id = '__staff__')");
    }
    if (plan.groupIds.length > 0) {
      visibility.push(
        `(target_type = 'role' AND target_id IN (${plan.groupIds
          .map(() => "?")
          .join(",")}))`,
      );
      visArgs.push(...plan.groupIds);
    }
    if (plan.programIds.length > 0) {
      visibility.push(
        `(target_type = 'program' AND target_id IN (${plan.programIds
          .map(() => "?")
          .join(",")}))`,
      );
      visArgs.push(...plan.programIds);
    }

    query = `SELECT * FROM v2_messages WHERE (${visibility.join(" OR ")})`;
    args = visArgs;
  }

  query += " AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY created_at DESC";

  return db.execute({ sql: query, args });
}
