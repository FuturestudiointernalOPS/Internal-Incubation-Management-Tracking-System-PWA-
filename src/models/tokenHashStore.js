/**
 * Token-hash schema self-heal — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/platform/tokenHash`: the token_hash column
 * self-heal runs bare SQL strings, as before.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/token-hashing.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, no decisions.
 */

import db from "@/lib/db";

/** Run one token-hash migration statement (bare string form, as before). */
export function runTokenHashMigration(sql) {
  return db.execute(sql);
}
