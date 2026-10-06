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
 * Split (see docs/LAYER_SPLIT.md): the code lives in `./updateFields/` —
 * `patch`, `descriptive`, `intent`, `assignment`, `schedule`. This file
 * re-exports the same public surface, so `update.js` and its tests are unchanged.
 *
 * Layer: decisions only, no SQL, no HTTP. It reads and writes through
 * `@/models/**`.
 *
 * Every helper mutates the `patch` accumulator passed in rather than returning a
 * column list: the SET order and the `changes` order are part of the audit
 * trail the client reads back, so the assembly is deliberately sequential.
 */

export * from "./updateFields/patch";
export * from "./updateFields/descriptive";
export * from "./updateFields/intent";
export * from "./updateFields/assignment";
export * from "./updateFields/schedule";
