/**
 * Platform — the one-click seeds (SERVICE layer).
 *
 * The domain work behind `/api/platform/seed/*`: the Founder Fit Score
 * assessment (its question bank, the scoring config, the conditional logic and
 * the publish snapshot) and the single Investor intake (form + run, behind the
 * single-active-investor guard).
 *
 * The CONTROLLER keeps `initDb`, the `super_admin` gate, the CSRF same-origin
 * guard on the state-changing GET and the response envelope.
 *
 * Split (see docs/LAYER_SPLIT.md): the code lives in `./seed/` —
 * `founderAssessment`, `investorApplication`. This file re-exports the same
 * public surface, so importers and tests are unchanged.
 *
 * Layer: decisions and orchestration, no SQL, no HTTP. It reads and writes
 * through `@/models/**` and `@/lib/**`.
 */

export * from "./seed/founderAssessment";
export * from "./seed/investorApplication";
