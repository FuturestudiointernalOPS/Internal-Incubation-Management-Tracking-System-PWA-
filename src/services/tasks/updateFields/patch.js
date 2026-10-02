/**
 * Tasks — the PUT field-assembly accumulator.
 *
 * `patch` is the SET list under construction: `fields`/`args` are the SQL column
 * list the model writes, `changes` is the human-readable change log the client
 * reads back, and `auditAction` / `auditDetails` travel with it because the
 * assignment branches refine what the status block decided.
 *
 * Part of the `updateFields` field assembly (see docs/LAYER_SPLIT.md). Decisions
 * only, no SQL, no HTTP.
 */

/** A fresh SET accumulator. */
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
