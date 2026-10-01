/**
 * Venture schema bootstrap — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/schema`: the raw migration runner
 * and the two backfill UPDATEs that keep `ventures.name` and
 * `ventures.company_name` in step.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`
 * (the migration runner is called with a bare SQL string, as before).
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, no decisions.
 */

import db from "@/lib/db";

/** Run one migration statement (bare string form, as the schema block used). */
export function runVentureMigration(sql) {
  return db.execute(sql);
}

/** Copy the legacy `name` into `company_name` where the canonical is unset. */
export function syncVentureNameToCompanyName() {
  return db.execute(
    "UPDATE ventures SET company_name = name WHERE company_name IS NULL AND name IS NOT NULL"
  );
}

/** Copy the canonical `company_name` back into the legacy `name` when it drifted. */
export function syncVentureCompanyNameToName() {
  return db.execute(
    "UPDATE ventures SET name = company_name WHERE company_name IS NOT NULL AND name IS DISTINCT FROM company_name"
  );
}
