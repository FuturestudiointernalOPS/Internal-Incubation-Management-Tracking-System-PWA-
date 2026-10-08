/**
 * DELIVERABLE SUBMISSIONS — the submit / review / list / score use-cases.
 *
 * This file is a barrel: it re-exports the same public surface as before the
 * split, so `@/services/ventures/submissions` importers are unchanged. The code
 * lives in `./submissions/`:
 *
 *   createSubmission.js — the submit use-case (identity binding, versioning)
 *   review.js — the review decision + its follow-ups (notices, team, KPI)
 *   scope.js — own / team / facilitator scope helpers
 *   read.js — the row-shaping and version-grouping helpers
 *   score.js — the score write
 *
 * Nothing here runs SQL; reads and writes go through `@/models/**`.
 * See docs/LAYER_SPLIT.md.
 */

export * from "./submissions/createSubmission";
export * from "./submissions/review";
export * from "./submissions/scope";
export * from "./submissions/read";
export * from "./submissions/score";
