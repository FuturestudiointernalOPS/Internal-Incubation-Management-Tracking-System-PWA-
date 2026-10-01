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
 *   import.js — the CSV/XLSX import: the file parse and column fuzzy match
 *               (preview), the lookup-first contact resolution and row loop
 *               (execute) and the identity-review flags
 *   seed.js — the one-click seeds: the Founder Fit Score question bank and
 *               the single Investor intake form + run
 *   formGeneration.js — generating a whole form + its evaluation framework
 *               from a document
 *   personalize.js — the two-tier email-template personalizer and its
 *               structure guarantee
 *   analysis.js — the advisory AI summary/analysis of one submission
 *   evaluationScores.js — the run-scoped evaluation scoreboard
 *   scoring.js — the assessment scoring (per-section, weighted, ranked)
 *   forms.js — the Forms CRUD + versioning (snapshot fallback, publish,
 *               the FK-safe builder save, the investor-intake guard)
 *   collections.js — the Collections CRUD (list + tree, slug, audit)
 */

export * from "./report";
export * from "./formRunList";
export * from "./evaluation";
export * from "./formRuns";
export * from "./import";
export * from "./seed";
export * from "./formGeneration";
export * from "./personalize";
export * from "./analysis";
export * from "./evaluationScores";
export * from "./scoring";
export * from "./forms";
export * from "./collections";
