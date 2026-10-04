/**
 * Investor model — due diligence and pipeline (REPOSITORY layer).
 *
 * Thin BARREL over cohesive modules in the sibling
 * `models/investor/diligenceAndPipeline/` folder (the split convention:
 * `x.js` + `x/`):
 *
 *   diligence.js — the due-diligence workspace, requests, notes and follow-ups
 *   documents.js — the due-diligence document rows and upload/download timelines
 *   pipeline.js  — the investment pipeline list, stage changes and investments
 *
 * Each function wraps exactly one SQL statement, byte-identical to the queries
 * that used to sit inline in the controllers, so behavior is unchanged.
 * Importers keep the same path (`@/models/investor/diligenceAndPipeline`).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md §4):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data/outcome it returns.
 */

export * from "./diligenceAndPipeline/diligence";
export * from "./diligenceAndPipeline/documents";
export * from "./diligenceAndPipeline/pipeline";
