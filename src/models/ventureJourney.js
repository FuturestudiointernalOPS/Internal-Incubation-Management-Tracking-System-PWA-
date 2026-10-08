/**
 * Venture Journey model — data access for the venture journey/growth
 * controllers (`src/app/api/ventures/[id]/journey`, `/kpis`, `/lifecycle`,
 * `/lead`, `/validations`, `/investment-readiness`, `/business-model`,
 * `/playbook`, `/pmf`, `/interviews`, `/history`).
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `models/ventureJourney/` folder (the split convention: `x.js` + `x/`):
 *
 *   journeyStages.js — Journey stage CRUD + the milestone/deliverable spine reads
 *   kpis.js          — KPI assignments and the auto-calc source counters
 *   lifecycle.js     — pause/resume/archive transitions and lead-change writes
 *   validations.js   — venture validations + investment-readiness documents
 *   businessModel.js — the venture business-model reads and dynamic upsert
 *   playbook.js      — the facilitator playbook table guard and seed/read
 *   pmf.js           — PMF assessments + customer interviews
 *   history.js       — venture, previous-program and founder history
 *
 * Each function wraps exactly one SQL statement extracted 1:1 from the
 * controller it came from (SQL byte-identical, args order/count identical),
 * so behavior is unchanged. Queries that look duplicated are still extracted
 * one function per occurrence, per the MVC refactor extraction rules.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine (in the modules).
 *  - One function per query, named after the data it returns.
 */

export * from "./ventureJourney/journeyStages";
export * from "./ventureJourney/kpis";
export * from "./ventureJourney/lifecycle";
export * from "./ventureJourney/validations";
export * from "./ventureJourney/businessModel";
export * from "./ventureJourney/playbook";
export * from "./ventureJourney/pmf";
export * from "./ventureJourney/history";
