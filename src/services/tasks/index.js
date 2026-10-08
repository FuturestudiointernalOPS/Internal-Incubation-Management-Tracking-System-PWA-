/**
 * services/tasks — the tasks SERVICE layer.
 *
 * Use-case and decision code for the tasks domain. It reads and writes through
 * `@/models/**` (the repository layer) and never runs SQL itself (enforced by
 * `src/__tests__/server/services-boundaries.test.js`).
 *
 *   blockers.js        — the blockers use cases (/api/blockers and its discuss
 *                        route): read scope, create/resolve/edit/delete rules
 *   carryover.js       — carry-over: ownership, chain walk, the completed and
 *                        idempotency guards, the migration order
 *   approval.js        — approve/reject a pending-project-approval task
 *   reconcile.js       — the retro batch reconciliation
 *   assignments.js     — assignment list + accept/decline/reassign
 *   assignmentAction.js — the assigned person's accept/decline/complete
 *   access.js          — the shared task-access rule (owner/assignee/supervisor)
 *   comments.js        — comment list/post (+ fan-out) and the author-only rules
 *   resources.js       — task resource add/remove
 *   duplicate.js       — task (and subtask) duplication
 *   logs.js            — the assignment log
 *   deadlines.js       — the 24-hour deadline reminders
 *   query.js           — the GET read path (listing scope, id lookup, enrichment)
 *   remove.js          — the DELETE guards and order
 *   create.js          — the POST creation decisions and follow-on effects
 *   update.js          — the PUT update: the ORDER of the decisions
 *   updateGuards.js    — the PUT entry guards (access, lock, blockers, carry-over)
 *   updateFields.js    — the PUT field assembly (SET, project, assignment, dates)
 *   updateEffects.js   — the PUT follow-on effects (cascade, carry-over, audits)
 *   teamBoard.js       — the per-team board (/api/team-tasks): scope rule,
 *                        writable columns and the list/create/update/delete cases
 *   dates.js           — the shared date helpers
 */

export * from "./blockers";
export * from "./carryover";
export * from "./approval";
export * from "./reconcile";
export * from "./assignments";
export * from "./assignmentAction";
export * from "./access";
export * from "./comments";
export * from "./resources";
export * from "./duplicate";
export * from "./logs";
export * from "./deadlines";
export * from "./query";
export * from "./remove";
export * from "./create";
export * from "./update";
export * from "./updateGuards";
export * from "./updateFields";
export * from "./updateEffects";
export * from "./teamBoard";
export * from "./dates";
