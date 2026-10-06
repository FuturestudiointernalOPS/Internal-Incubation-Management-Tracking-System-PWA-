/**
 * Programs — the program lifecycle use cases (SERVICE layer).
 *
 * This module is the entry point the lifecycle controllers import from. The use
 * cases are split by concern:
 *
 *   programList.js    — the list read and its completion index
 *   programCreate.js  — creation (slug, duplicate/date rules, defaults, audit)
 *   programUpdate.js  — the archive shortcut, the field update, the segment sync
 *   programDelete.js  — the protected-data guard and the delete
 *   programV2.js      — the v2 create / directory / whitelisted update
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` and returns a plain
 * `{ status, body }` the controller renders.
 */

export * from "./programList";
export * from "./programCreate";
export * from "./programUpdate";
export * from "./programDelete";
export * from "./programV2";
