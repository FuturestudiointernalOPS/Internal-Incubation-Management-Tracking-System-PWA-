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
import { PERMISSION_MODULES, ACCESS_LEVELS } from "@/server/authz/capabilities";
import { ensureProfileCapabilitiesSchema } from "./profileCapabilitiesStore";

/**
 * Every module at FULL — the platform-wide profile. Built LAZILY (at seed time,
 * never at module load) so importing this module never reads the capability
 * registry before its consumer has set up.
 */
function fullMatrix() {
  const matrix = {};
  for (const [module, definition] of Object.entries(PERMISSION_MODULES)) {
    matrix[module] = {};
    for (const capability of definition.capabilities) {
      matrix[module][capability] = ACCESS_LEVELS.FULL;
    }
  }
  return matrix;
}

/** key, label, context, allowed baseline roles, capabilities. */
export const PROFILE_CATALOGUE_SEED = [
  { key: "super_admin_default", label: "Super Admin Default", context: "global", allowedRoles: ["super_admin"], allCapabilities: true },
  { key: "staff_default", label: "Staff Default", context: "global", allowedRoles: ["staff"], capabilities: {
    projects: { view: 1, create: 2, edit: 3 },
    programs: { view: 1 },
    ventures: { view: 1, edit: 3 },
    reports: { view: 1, create: 2 },
    messaging: { view: 1, send: 2 },
    contacts: { view: 1 },
  } },
  { key: "venture_member", label: "Venture Member", context: "venture", allowedRoles: ["member"], capabilities: {
    ventures: { view: 1 },
  } },
  { key: "participant", label: "Participant Default", context: "program", allowedRoles: ["member"], capabilities: {
    projects: { view: 1 },
    messaging: { view: 1, send: 2 },
  } },
  { key: "investor", label: "Mentor", context: "investor", allowedRoles: ["member"], capabilities: {
    programs: { view: 1 },
    projects: { view: 1 },
    messaging: { view: 1, send: 2 },
  } },
  { key: "founder", label: "Founder", context: "venture", allowedRoles: ["member"], capabilities: {
    ventures: { view: 1, edit: 3 },
  } },
  { key: "learner", label: "Learner", context: "lms", allowedRoles: ["member"], capabilities: {
    lms: { view: 1 },
  } },
  { key: "venture_manager", label: "Venture Manager", context: "venture", allowedRoles: ["staff"], capabilities: {
    ventures: { view: 1, edit: 3 },
  } },
  // PROGRAM-ONLY, by product decision: the role default and the assignment both
  // resolve to this one profile.
  { key: "program_manager", label: "Assigned Program Manager", context: "program", allowedRoles: ["staff"], capabilities: {
    programs: { view: 1, edit: 3, publish: 4 },
  } },
  { key: "project_owner", label: "Project Owner", context: "staff", allowedRoles: ["staff"], capabilities: {
    projects: { view: 1, create: 2, edit: 3, delete: 4 },
    engineering: { view: 1, manage_tasks: 2 },
    reports: { view: 1, create: 2 },
    messaging: { view: 1, send: 2 },
  } },
  { key: "operations_manager", label: "Operations Manager", context: "staff", allowedRoles: ["staff"], capabilities: {
    programs: { view: 1, edit: 3 },
    projects: { view: 1 },
    finance: { view: 1, create: 2, edit: 3, export: 4 },
    contacts: { view: 1, create: 2, edit: 3 },
    reports: { view: 1, create: 2, export: 3 },
    messaging: { view: 1, send: 2 },
  } },
  { key: "instructor", label: "Instructor", context: "staff", allowedRoles: ["staff"], capabilities: {
    programs: { view: 1, edit: 3 },
    projects: { view: 1 },
    messaging: { view: 1, send: 2 },
    contacts: { view: 1 },
  } },
  { key: "finance_assistant", label: "Finance Assistant", context: "staff", allowedRoles: ["staff"], capabilities: {
    finance: { view: 1, create: 2, edit: 3 },
    reports: { view: 1 },
  } },
];

/**
 * The baseline role → profile default, as it was seeded before the takeover
 * (`seedDefaultAccessProfiles`). Insert-only, so an administrator's later choice
 * wins. `program_manager` resolves to the program-only profile by decision;
 * `member` to the venture read profile; `participant`/`mentor` to their
 * contextual profiles.
 */
export const ROLE_PROFILE_DEFAULTS_SEED = {
  super_admin: "super_admin_default",
  staff: "staff_default",
  participant: "participant",
  program_manager: "program_manager",
  investor: "investor",
  mentor: "investor",
  founder: "founder",
  member: "venture_member",
};

/** One-time, idempotent, administrator-respecting. */
export async function ensureProfileCatalogueSeed() {
  await ensureProfileCapabilitiesSchema();

  let profiles = 0;
  let capabilities = 0;
  for (const def of PROFILE_CATALOGUE_SEED) {
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
