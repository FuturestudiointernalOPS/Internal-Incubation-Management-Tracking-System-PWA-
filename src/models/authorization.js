
/**
 * Authorization model — data access for the access-control controllers
 * (`/api/org-membership`, `/api/access-profiles/**`,
 * `/api/engineering/permissions/**`).
 *
 * Each function wraps exactly one SQL statement that used to live inline in a
 * controller. SQL is byte-identical to the original queries, so behavior is
 * unchanged — the API jest suites (which mock @/lib/db with SQL string
 * matching) act as the regression net. Statements several controllers run are
 * mirrored 1:1 here: one exported function per former call site.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it operates on.
 */


export * from "./authorization/membershipAndProfiles";
export * from "./authorization/engineeringAndAudit";
