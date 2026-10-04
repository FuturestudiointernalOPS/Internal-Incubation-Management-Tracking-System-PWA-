
/**
 * Programs model — data access for the program-domain controllers:
 * `src/app/api/programs/route.js`,
 * `src/app/api/pm/programs/route.js`,
 * `src/app/api/pm/programs/[id]/route.js`,
 * `src/app/api/pm/programs/assignment/route.js`,
 * `src/app/api/pm/programs/templates/route.js`, and
 * `src/app/api/program-types/route.js`.
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 * Where the original handlers ran the same query at multiple call sites, the
 * model keeps one function per call site (1:1 extraction — see the duplicated
 * facilitators-group/segment-sync helpers below, and docs/MVC_REFACTOR.md §4).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */


export * from "./programs/core";
export * from "./programs/extended";
