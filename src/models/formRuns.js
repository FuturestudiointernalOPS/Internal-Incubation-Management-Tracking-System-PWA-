
/**
 * Platform form-run model — data access for the form-runs controller
 * (`src/app/api/platform/form-runs/route.js`).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controller, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */


export * from "./formRuns/readsAndHelpers";
export * from "./formRuns/writesPost";
export * from "./formRuns/writesPutDelete";
