
/**
 * Curriculum model — data access for the PM curriculum controller
 * (`src/app/api/pm/curriculum/route.js`): program sessions, session
 * requirements/deliverables, attendance, weekly PM reports.
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controller, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data/outcome it returns.
 *  - Schema-maintenance DDL (the ensure* helpers in the controller) stays
 *    additive and idempotent; callers keep their own try/catch.
 */



export * from "./curriculum/sessionsAndSelfHealing";
export * from "./curriculum/updatesAndDeletes";
