/**
 * VENTURE SCHEMA BOOTSTRAP.
 *
 * Keeps the Venture tables up to date: a fixed, idempotent list of
 * `ADD COLUMN IF NOT EXISTS` migrations (plus two `name`/`company_name`
 * backfills), then seeds the configurable Venture permission catalog.
 *
 * There is no per-request decision here — the migration list is data. Every
 * statement is in `@/models/ventureSchemaStore`; nothing here runs SQL. The
 * statements are split by domain under `./schema/` and concatenated here in the
 * original order.
 *
 * This module used to be re-exported through `@/lib/ventures`; that barrel is
 * gone (CH-4) and importers read this module directly. See docs/LAYER_SPLIT.md.
 */

import {
  runVentureMigration,
  syncVentureNameToCompanyName,
  syncVentureCompanyNameToName,
} from "@/models/ventureSchemaStore";
import core from "./schema/core";
import security from "./schema/security";
import infrastructure from "./schema/infrastructure";
import foundation from "./schema/foundation";
import operatingModel from "./schema/operatingModel";
import governance from "./schema/governance";
import journey from "./schema/journey";

/**
 * Ensure venture schema is up to date.
 * Adds missing columns safely using ALTER TABLE IF NOT EXISTS.
 * This is safe to call on every request; it's a no-op if columns exist.
 */
export async function ensureVentureSchema() {
  const migrations = [
    ...core,
    ...security,
    ...infrastructure,
    ...foundation,
    ...operatingModel,
    ...governance,
    ...journey,
  ];

  for (const sql of migrations) {
    try {
      await runVentureMigration(sql);
    } catch (_) {
      // Table might not exist yet; that's ok
    }
  }

  // Copy name -> company_name for any existing rows
  try {
    await syncVentureNameToCompanyName();
  } catch (_) {}

  // …and the other way, for rows where BOTH are set but the legacy `name`
  // drifted. Renames used to write only company_name (the profile screens), so a
  // Venture created by an intake Run kept that Run's name in `name` and every
  // surface still reading it (the founder's My Ventures card) showed the Run
  // instead of the company. company_name is the canonical label.
  try {
    await syncVentureCompanyNameToName();
  } catch (_) {}

  // Seed the configurable Venture permission catalog (idempotent — only when empty)
  try {
    const { seedVenturePermissions } = await import("@/services/ventures/permissions");
    await seedVenturePermissions();
  } catch (_) {}
}
