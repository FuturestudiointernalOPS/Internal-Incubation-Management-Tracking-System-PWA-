/**
 * Platform form-run model — reads and helpers.
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `models/formRuns/readsAndHelpers/` folder (the split convention: `x.js` + `x/`):
 *
 *   helpers.js       — timeline logging, assignment enrichment, scoring settings
 *   reads.js         — submission/run lookups, dashboard stats, run-detail reads,
 *                      the Responses table source and respondent enrichment
 *   decisionEmails.js — the lookups behind sendDecisionEmailForSubmission
 *   reviews.js       — the statements behind processReviewInternal
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controller, so behavior is unchanged.
 * Importers keep the same path (`@/models/formRuns`).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine (in the modules).
 *  - One function per query, named after the data it returns.
 */

export * from "./readsAndHelpers/helpers";
export * from "./readsAndHelpers/reads";
export * from "./readsAndHelpers/decisionEmails";
export * from "./readsAndHelpers/reviews";

// ── Paginated run list ───────────────────────────────────────────────────────
// The filter definition, the count and the page query moved to
// `@/models/formRunListStore`; the total-resolution decision to
// `@/services/platform/formRunList`. Re-exported here so existing importers keep
// working — see docs/LAYER_SPLIT.md.

export { countFormRuns } from "@/models/formRunListStore";
export { listFormRunsPage } from "@/services/platform/formRunList";
