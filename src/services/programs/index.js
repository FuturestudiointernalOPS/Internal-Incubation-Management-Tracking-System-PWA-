/**
 * services/programs — the programs SERVICE layer.
 *
 * Use-case and decision code for the programs domain. It reads and writes
 * through `@/models/**` (the repository layer) and never runs SQL itself
 * (enforced by `src/__tests__/server/services-boundaries.test.js`).
 *
 *   kpiProgress.js — objective (KPI) progress: the rate and the cache policy
 *   programList.js — the program list read and its completion index
 *   programCreate.js — program creation (slug, duplicate/date rules, defaults)
 *   programUpdate.js — the archive shortcut, the field update, the segment sync
 *   programDelete.js — the protected-data guard and the delete
 *   programV2.js — the v2 create / directory / whitelisted update
 *   workspace.js — the aggregator the lifecycle controllers import from
 *   fullState.js — the program workspace bundle assembly
 *   export.js — the program export types, filenames and serialisation
 *   weeklyReports.js — the weekly-report read (own-scope) and write (score)
 *   teams.js — the program team roster, creation and PATCH actions
 *   curriculum.js — the session/requirement actions, the field update, the delete
 */

export * from "./kpiProgress";
export * from "./programList";
export * from "./programCreate";
export * from "./programUpdate";
export * from "./programDelete";
export * from "./programV2";
export * from "./fullState";
export * from "./export";
export * from "./weeklyReports";
export * from "./teams";
export * from "./curriculum";
