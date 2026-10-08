/**
 * Curriculum model — sessions, their requirements, and the weekly PM reports
 * (REPOSITORY layer).
 *
 * Thin BARREL over cohesive modules in the sibling
 * `models/curriculum/sessionsAndSelfHealing/` folder (the split convention:
 * `x.js` + `x/`):
 *
 *   sessionSchema.js           — DDL guards for the session/requirement columns
 *   weeklyReportSchema.js      — DDL guards for the weekly-report columns
 *   sessionVersioning.js       — session version snapshots (read/insert/advance)
 *   sessionCreation.js         — add_session: conflict guard, session/requirement inserts
 *   sessionStateAndMaterials.js— participant count, status/team/completion, materials
 *   weeklyReports.js           — weekly PM report list and upsert
 *
 * Each function wraps exactly one SQL statement, byte-identical to the queries
 * that used to sit in this module, so behavior is unchanged.
 * Importers keep the same path (`@/models/curriculum/sessionsAndSelfHealing`).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md §4):
 *  - No HTTP / Next.js imports in the modules — only the db engine.
 *  - One function per query, named after the data/outcome it returns.
 */

export * from "./sessionsAndSelfHealing/sessionSchema";
export * from "./sessionsAndSelfHealing/weeklyReportSchema";
export * from "./sessionsAndSelfHealing/sessionVersioning";
export * from "./sessionsAndSelfHealing/sessionCreation";
export * from "./sessionsAndSelfHealing/sessionStateAndMaterials";
export * from "./sessionsAndSelfHealing/weeklyReports";
