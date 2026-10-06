/**
 * Venture workspace model — data access for the venture workspace controllers
 * (`src/app/api/ventures/route.js` and the `[id]` routes for members, dashboard,
 * progress, tasks, blockers, standups, retros, calendar, milestones, followups
 * and action-plans).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 *
 * Note: extraction is strictly 1:1 with the original inline call sites, so a
 * handful of lookups (e.g. the ventures.id-by-code resolvers) intentionally
 * repeat the same SQL across functions. Queries that also exist in
 * "@/lib/ventures" are kept here without cross-file coupling.
 */


export * from "./ventureWorkspace/journeyAndReports";
export * from "./ventureWorkspace/dashboardAndCheckins";
export * from "./ventureWorkspace/milestonesAndAccess";
