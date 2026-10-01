/**
 * services/platform — the platform SERVICE layer.
 *
 * Use-case and decision code for the platform AI surfaces. It reads and writes
 * through `@/models/**` (the repository layer) and never runs SQL itself
 * (enforced by `src/__tests__/server/services-boundaries.test.js`).
 *
 *   report.js — composing a Run's AI report from its Output Instruction and
 *               attached reference document
 *   formRunList.js — one page of runs and its matching total
 *   evaluation.js — the AI submission evaluation: the claim/release batch,
 *               the progress counts and the single evaluation
 *   formRuns.js — the Run-detail read assembly (auto-close, the one-wave
 *               bundle, the respondent enrichment, the anonymous rule)
 */

export * from "./report";
export * from "./formRunList";
export * from "./evaluation";
export * from "./formRuns";
