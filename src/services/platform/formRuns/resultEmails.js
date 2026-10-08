/**
 * Platform — form runs: the decision/result email and document cluster (SERVICE layer).
 *
 * The workflow emails one Run sends to its respondents: the tracked decision
 * (approval/rejection) email, the participant-facing RESULT document and email
 * (answers, evaluation feedback, final score; the composed-report path when the
 * run carries an Output Instruction or an attached reference document) and the
 * scheduled dispatcher that delivers results once each run's own delay has
 * elapsed. `logTimeline` is the shared fire-and-forget audit entry.
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `formRuns/resultEmails/` folder (the `x.js` + `x/` convention):
 *
 *   decisionEmail.js  — the tracked decision email + the shared timeline entry
 *   resultDocument.js — the participant-facing result document builder
 *   resultEmail.js    — the result email and its scheduled dispatch
 *
 * The review, respondent and action slices import `logTimeline` and the two
 * senders from here; the barrel re-exports the exact same surface.
 *
 * Layer: decisions and shaping, no SQL, no HTTP. It reads through `@/models/**`
 * and `@/lib/**`; the PDF renderer and the composed-report builder are imported
 * lazily at their call sites.
 */

export { logTimeline, sendDecisionEmailForSubmission } from "./resultEmails/decisionEmail";
export { buildResultDocument } from "./resultEmails/resultDocument";
export { sendResultEmailForSubmission, dispatchScheduledResultEmails } from "./resultEmails/resultEmail";
