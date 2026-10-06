/**
 * Platform — the CSV/XLSX import (SERVICE layer).
 *
 * The domain work behind `/api/platform/import/{preview,execute,review-flags}`:
 * the file parsing and column→question fuzzy matching (preview), the lookup-first
 * contact resolution and the row loop (execute), and the identity-review flag
 * read/write. The CONTROLLER keeps `initDb`, the `super_admin` gate, the body
 * parsing and the response envelope.
 *
 * Split (see docs/LAYER_SPLIT.md): the code lives in `./import/` — `preview`,
 * `execute`, `reviewFlags`. This file re-exports the same public surface, so
 * importers and tests are unchanged.
 *
 * Layer: decisions and orchestration, no SQL, no HTTP. It reads and writes
 * through `@/models/**` and `@/lib/**`.
 */

export * from "./import/preview";
export * from "./import/execute";
export * from "./import/reviewFlags";
