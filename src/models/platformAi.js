/**
 * Platform AI + seed model — data access for the platform AI & seed controllers:
 *   - `src/app/api/platform/ai/evaluate-submission/route.js`   (24 queries)
 *   - `src/app/api/platform/ai/evaluation-scores/route.js`     (7 queries)
 *   - `src/app/api/platform/ai/generate-all/route.js`          (5 queries)
 *   - `src/app/api/platform/ai/analyze/route.js`               (4 queries)
 *   - `src/app/api/platform/ai/evaluation-config/route.js`     (3 queries)
 *   - `src/app/api/platform/seed/founder-assessment/route.js`  (22 queries)
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `models/platformAi/` folder (the `x.js` + `x/` convention):
 *
 *   evaluation.js        — the batch evaluation engine (claims, failures, progress)
 *   scores.js            — the run-scoped scoreboard
 *   generation.js        — AI form generation, analysis log and framework config
 *   founderAssessment.js — the Founder Fit Score form seed
 *
 * Each function wraps exactly one SQL statement that used to live inline in a
 * controller. SQL is byte-identical to the original queries, so behavior is
 * unchanged — the API jest suites (which mock @/lib/db with SQL string
 * matching) act as the regression net. Importers keep the same path
 * (`@/models/platformAi`).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it operates on.
 */

export * from "./platformAi/evaluation";
export * from "./platformAi/scores";
export * from "./platformAi/generation";
export * from "./platformAi/founderAssessment";
