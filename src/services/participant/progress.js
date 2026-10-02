/**
 * Participant service — the participant progress report.
 *
 * Layer (see docs/LAYER_SPLIT.md): every DECISION of the progress report lives in
 * `./progress/` — the per-program metrics, milestones and history (`program`),
 * the cross-program aggregation (`summary`) and the assembly (`build`). The
 * unlock / week rules come from `../rules`, shared with the home dashboard so the
 * two views can never disagree. This file re-exports the same public surface, so
 * importers and tests are unchanged.
 *
 * Every statement lives in `@/models/participantPortal`. No SQL, no HTTP.
 */

export { computeProgramProgress } from "./progress/program";
export { summarizeProgress } from "./progress/summary";
export { buildParticipantProgress } from "./progress/build";