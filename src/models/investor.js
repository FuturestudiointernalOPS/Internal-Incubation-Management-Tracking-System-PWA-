
/**
 * Investor model — data access for the investor API controllers under
 * `src/app/api/investor/` (diligence, pipeline, dashboards, evaluation, KPIs,
 * ventures search, updates).
 *
 * Each exported function wraps exactly one SQL statement, and SQL is
 * byte-identical to the queries that used to live inline in the controllers,
 * so behavior is unchanged (see docs/MVC_REFACTOR.md §4).
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data/outcome it returns.
 *
 * Route → function-group mapping (extraction is strictly 1:1 with the
 * original inline call sites, so lookups that intentionally repeat the same
 * SQL — e.g. `SELECT id FROM investor_profiles WHERE user_id = ?` or the
 * `relationship_workspaces` id/assignee lookups — appear once per controller
 * call site, mirroring the pre-extraction code):
 *
 *  src/app/api/investor/diligence/route.js                → 26 functions
 *  src/app/api/investor/diligence/documents/route.js      →  8 functions
 *  src/app/api/investor/pipeline/route.js                 → 19 functions
 *  src/app/api/investor/dashboard/route.js                →  9 functions
 *  src/app/api/investor/executive-dashboard/route.js      →  1 function
 *  src/app/api/investor/admin-overview/route.js           →  4 functions
 *  src/app/api/investor/evaluation/route.js               →  4 functions
 *  src/app/api/investor/venture-kpis/route.js             →  3 functions
 *  src/app/api/investor/kpis/route.js                     →  2 functions
 *  src/app/api/investor/ventures/route.js                 →  2 functions
 *  src/app/api/investor/updates/route.js                  →  2 functions
 */



export * from "./investor/diligenceAndPipeline";
export * from "./investor/dashboardsAndKpis";
export * from "./investor/venturesAndUpdates";
