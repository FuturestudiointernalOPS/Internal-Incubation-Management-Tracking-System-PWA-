/**
 * PROFILE CATALOGUE SEED — direct, without the access-profile layer.
 *
 * Tranche 6 of docs/PROFILES_TAKEOVER_MIGRATION.md. Until now the initial
 * profiles and their capabilities were created by `seedDefaultAccessProfiles`
 * (into `access_profiles`) and then converted by the transfer migration. That
 * makes a FRESH database depend on the retired layer.
 *
 * This module is the profiles' own seed: it writes `profiles` +
 * `profile_capabilities` directly, insert-only (`ON CONFLICT DO NOTHING`), so
 *   • a new database gets the catalogue even with no `access_profiles` at all;
 *   • an existing database keeps every administrator edit (the transfer
 *     migration ran first and its rows win).
 *
 * The values mirror the former access-profile catalogue, with the agreed
 * decisions: `program_manager` is PROGRAM-ONLY (the portfolio set is gone), and
 * the ad-hoc templates are profiles too. After the seed, the database owns these
 * rows — the UI edits them.
 */

import db from "@/lib/db";
import { CAPABILITY_CATALOG } from "@/models/authorization/constants/feature-module-capability";
import { ACCESS_LEVELS } from "@/server/authz/capabilities";
import { ensureProfileCapabilitiesSchema } from "./profileCapabilitiesStore";
import {
  PROFILE_CATALOGUE_SEED,
  ROLE_PROFILE_DEFAULTS_SEED,
  DELEGATED_PROFILE_CAPABILITY_ROWS,
  VENTURE_PORTFOLIO_CAPABILITY_ROWS,
  VENTURE_MEMBER_EDIT_CAPABILITY,
} from "./seedData";

// The catalogue is data now (./seedData). Re-exported so the historic tests and
// screens keep their import path.
export { PROFILE_CATALOGUE_SEED, ROLE_PROFILE_DEFAULTS_SEED };

/**
 * Every catalog capability at FULL — the platform-wide profile.
 *
 * The WHOLE catalogue is used (not `PERMISSION_MODULES`): a `registryOnly`
 * module is not writable from other profiles but the Super Admin profile holds
 * it, so the owner's rights and their revocation are expressed in the same
 * matrix as every other right. Built LAZILY (at seed time, never at module
 * load) so importing this module never reads the capability registry before its
 * consumer has set up.
 */
function fullMatrix() {
  const matrix = {};
  for (const [module, definition] of Object.entries(CAPABILITY_CATALOG)) {
    matrix[module] = {};
    for (const capability of Object.keys(definition.capabilities || {})) {
      matrix[module][capability] = ACCESS_LEVELS.FULL;
    }
  }
  return matrix;
}


/** Insert-only catalogue rows for the supplied profile definitions. */
async function seedProfileDefinitions(definitions) {
  let profiles = 0;
  let capabilities = 0;
  for (const def of definitions) {
    const inserted = await db.execute({
      sql: `INSERT INTO profiles (key, context, allowed_roles, is_active, label)
            VALUES (?, ?, ?, 1, ?)
            ON CONFLICT (key) DO NOTHING`,
      args: [def.key, def.context, JSON.stringify(def.allowedRoles || []), def.label],
    });
    profiles += inserted?.rowsAffected ?? 0;

    const caps = def.allCapabilities ? fullMatrix() : def.capabilities || {};
    for (const [module, capsForModule] of Object.entries(caps)) {
      for (const [capability, level] of Object.entries(capsForModule)) {
        const capInsert = await db.execute({
          sql: `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (profile_key, module, capability) DO NOTHING`,
          args: [def.key, module, capability, level],
        });
        capabilities += capInsert?.rowsAffected ?? 0;
      }
    }
  }
  return { profiles, capabilities };
}

/** One-time, idempotent, administrator-respecting. */
export async function ensureProfileCatalogueSeed() {
  await ensureProfileCapabilitiesSchema();

  const { profiles, capabilities } = await seedProfileDefinitions(PROFILE_CATALOGUE_SEED);

  // The role → profile defaults. Insert-only: an existing default (possibly
  // administrator-edited from the Profiles screen) is never overwritten.
  let roleDefaults = 0;
  for (const [roleName, profileKey] of Object.entries(ROLE_PROFILE_DEFAULTS_SEED)) {
    const inserted = await db.execute({
      sql: `INSERT INTO role_profile_defaults (role_name, profile_key)
            VALUES (?, ?)
            ON CONFLICT (role_name) DO NOTHING`,
      args: [roleName, profileKey],
    });
    roleDefaults += inserted?.rowsAffected ?? 0;
  }

  return { success: true, profiles, capabilities, roleDefaults };
}

/**
 * Lot 3.4 / D-5 — the facilitator PROFILE seeds on databases that bootstrapped
 * before it existed. `ensureProfileCatalogueSeed` is recorded once per database,
 * so adding an entry to the catalogue is not enough for an existing one; this
 * runs under its own migration key and is insert-only (administrator edits win).
 */
export async function ensureFacilitatorProfileSeed() {
  await ensureProfileCapabilitiesSchema();
  const definitions = PROFILE_CATALOGUE_SEED.filter((def) => def.key === "facilitator");
  const seeded = await seedProfileDefinitions(definitions);
  return { success: true, ...seeded };
}

/**
 * The VENTURE OPS CONTRIBUTOR profile, on databases seeded before it existed.
 *
 * Same reason as the facilitator seed above: `ensureProfileCatalogueSeed` is
 * recorded once per database, so a profile added later never reaches an
 * existing one. Insert-only — an administrator's edit is never overwritten.
 */
export async function ensureVentureOpsProfileSeed() {
  await ensureProfileCapabilitiesSchema();
  const definitions = PROFILE_CATALOGUE_SEED.filter((def) => def.key === "venture_ops_contributor");
  const seeded = await seedProfileDefinitions(definitions);
  return { success: true, ...seeded };
}

/**
 * Lot 5 / D-7 — `ventures.edit` on the Venture Member profile.
 *
 * The catalogue seed is recorded once per database, so a capability added to an
 * existing profile never reaches a database seeded before it. This runs under
 * its own migration key and is insert-only (an administrator's explicit level
 * is never overwritten).
 *
 * The right is bounded by the `venture_own` perimeter: it lets a member write
 * inside the Ventures they belong to, and nowhere else.
 */
export async function ensureVentureMemberEditBackfill() {
  await ensureProfileCapabilitiesSchema();
  const [profileKey, module, capability, level] = VENTURE_MEMBER_EDIT_CAPABILITY;
  const inserted = await db.execute({
    sql: `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (profile_key, module, capability) DO NOTHING`,
    args: [profileKey, module, capability, level],
  });
  return { success: true, inserted: inserted?.rowsAffected ?? 0 };
}

/**
 * The capabilities that replaced a ROLE LIST in an action, granted to the
 * profiles that already held the access.
 *
 * Why a backfill: the catalogue seed is recorded once per database, so adding a
 * capability to `staff_default` / `program_manager` above never reaches a
 * database seeded before it. Without these rows the route switch would DENY the
 * staff and program managers who can do the work today.
 *
 * Insert-only: an administrator's explicit level (or removal) is never
 * overwritten. Every entry below replaces a `requireAuth([...])` that admitted
 * the profile's baseline role.
 */
export async function ensureDelegatedCapabilityDefaults() {
  await ensureProfileCapabilitiesSchema();

  let inserted = 0;
  for (const [profileKey, module, capability, level] of DELEGATED_PROFILE_CAPABILITY_ROWS) {
    const result = await db.execute({
      sql: `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (profile_key, module, capability) DO NOTHING`,
      args: [profileKey, module, capability, level],
    });
    inserted += result?.rowsAffected ?? 0;
  }

  return { success: true, inserted };
}

/**
 * The SUPER ADMIN full matrix, on databases seeded before the owner's rights
 * were exhaustive.
 *
 * `fullMatrix()` now covers the whole catalogue, including the `registryOnly`
 * modules (`duplicates`, `bulk_upload`) that are absent from
 * `PERMISSION_MODULES`. On an existing database the catalogue seed is already
 * recorded, so those rows would never arrive — and because the decision layer no
 * longer grants them by role, the owner would lose the queues. This backfill
 * adds only MISSING rows: an administrator's revocation is never re-added.
 */
export async function ensureSuperAdminFullMatrix() {
  await ensureProfileCapabilitiesSchema();

  const matrix = fullMatrix();
  let inserted = 0;
  for (const [module, capabilities] of Object.entries(matrix)) {
    for (const [capability, level] of Object.entries(capabilities)) {
      const result = await db.execute({
        sql: `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
              VALUES ('super_admin_default', ?, ?, ?)
              ON CONFLICT (profile_key, module, capability) DO NOTHING`,
        args: [module, capability, level],
      });
      inserted += result?.rowsAffected ?? 0;
    }
  }
  return { success: true, inserted };
}

/**
 * The PORTFOLIO perimeter rights (`ventures.view_all` / `ventures.edit_all`),
 * granted to the Super Admin's default profile.
 *
 * They replace the old Super Admin bypass on Venture routes, so an existing
 * database needs the rows or the platform owner would lose the whole Venture
 * directory on deploy. Staff receive the READ perimeter (the directory and the
 * portfolio roll-up); writing every Venture stays an explicit grant. Insert-only,
 * like every backfill here: an administrator's later revocation is never
 * overwritten on the next boot.
 */
export async function ensureVenturePortfolioCapabilityDefaults() {
  await ensureProfileCapabilitiesSchema();

  let inserted = 0;
  for (const [profileKey, module, capability, level] of VENTURE_PORTFOLIO_CAPABILITY_ROWS) {
    const result = await db.execute({
      sql: `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (profile_key, module, capability) DO NOTHING`,
      args: [profileKey, module, capability, level],
    });
    inserted += result?.rowsAffected ?? 0;
  }

  return { success: true, inserted };
}
