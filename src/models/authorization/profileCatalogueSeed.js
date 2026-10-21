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
import { PERMISSION_MODULES } from "@/models/authorization/constants/feature-module-capability";
import { ACCESS_LEVELS } from "@/server/authz/capabilities";
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
    programs: { view: 1, groups: 2 },
    ventures: { view: 1, edit: 3, setup: 3, kpis: 3, permissions_view: 1 },
    reports: { view: 1, create: 2 },
    messaging: { view: 1, send: 2 },
    contacts: { view: 1 },
    collections: { view: 1 },
  } },
  // D-7: a member of a Venture works IN it — writing stays bounded by the
  // `venture_own` perimeter, so the capability grants nothing across Ventures.
  { key: "venture_member", label: "Venture Member", context: "venture", allowedRoles: ["member"], capabilities: {
    ventures: { view: 1, edit: 3 },
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
    programs: { view: 1, edit: 3, publish: 4, groups: 2 },
    ventures: { kpis: 3 },
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
  // Phase 7 (D6) — the DEDICATED course-management profile. Nobody holds it by
  // default (only the Super Admin, by bypass). Assigning it to a staff member is
  // the ONLY way to grant course management — publish/unpublish, enrol, create
  // assessments, revoke certificates, attach resources — WITHOUT granting it to
  // all staff. It carries the single course-management right (`lms.edit`, which
  // also covers archive, assessment/thumbnail/resource deletion, assumed).
  { key: "course_manager", label: "Course Manager", context: "staff", allowedRoles: ["staff"], capabilities: {
    lms: { view: 1, edit: 3 },
  } },
  // PROGRAM facilitator — the delivery rights, seeded so the PROFILE can become
  // the single source of a facilitator's rights (Lot 3, D-5). The levels mirror
  // the per-assignment checkboxes they will replace. Until an assignment carries
  // the key, the checkboxes keep deciding, so seeding changes no answer.
  { key: "facilitator", label: "Program Facilitator", context: "program", allowedRoles: ["staff", "member"], capabilities: {
    facilitator: {
      "participants.view": 2,
      "attendance.view": 2,
      "attendance.record": 2,
      "assignments.view": 2,
      "assignments.grade": 2,
      "sessions.conduct": 2,
      "reviews.submit": 2,
    },
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
  const inserted = await db.execute({
    sql: `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
          VALUES ('venture_member', 'ventures', 'edit', 3)
          ON CONFLICT (profile_key, module, capability) DO NOTHING`,
    args: [],
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

  const rows = [
    // staff_default — the role list was ["super_admin", "staff"] (or included
    // staff) on each of these routes.
    ["staff_default", "ventures", "setup", 3],
    ["staff_default", "ventures", "kpis", 3],
    ["staff_default", "ventures", "permissions_view", 1],
    ["staff_default", "programs", "groups", 2],
    ["staff_default", "collections", "view", 1],
    // program_manager — admitted by the role list on the groups route and the
    // KPI catalogue write.
    ["program_manager", "programs", "groups", 2],
    ["program_manager", "ventures", "kpis", 3],
  ];

  let inserted = 0;
  for (const [profileKey, module, capability, level] of rows) {
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
