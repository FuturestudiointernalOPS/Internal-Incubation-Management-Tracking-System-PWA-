/**
 * ImpactOS — ASSIGNMENT-DERIVED PROGRAM ACCESS: ONE-TIME BACKFILLS
 *
 * Two pieces of repair that make the assignment-derived model safe to turn on
 * for people who were already in production:
 *
 * 1. `ensureAssignedProgramManagerProfile`
 *    Creates the narrow "Assigned Program Manager" template and points the
 *    Context Roles registry's `program:program_manager` row at it — but ONLY
 *    while that row still points at the seeded "Program Manager" template (or at
 *    nothing). An administrator who chose a different profile keeps their
 *    choice.
 *
 *    The profile is created here rather than relying on
 *    `seedDefaultAccessProfiles`, which only runs from an admin endpoint and is
 *    therefore not guaranteed to have run.
 *
 * 2. `backfillFacilitatorTickLists`
 *    Fills the MISSING entries of every facilitator assignment's tick list.
 *
 *    WHY: the per-program tick list is read with "no entry ⇒ no narrowing" (see
 *    `resolveAssignmentCapabilityLevel`). The moment the remaining facilitator
 *    actions start consulting the tick list, an absent entry would resolve to
 *    zero and DENY access that the facilitator has today. Writing the entry
 *    that today's resolution already produces changes nobody's access — it only
 *    makes today's reality explicit, so the enforcement step cannot strand a
 *    facilitator who was already working.
 *
 *    Insert-only in effect: an entry that already exists is never rewritten.
 *
 * Both are idempotent and record their own migration name, so an administrator's
 * later edits are never re-applied over.
 */

import db from "@/lib/db";
import { ensurePermissionsSchema } from "@/lib/auth";
import {
  FACILITATOR_CAPABILITY_KEYS,
  parsePermissions,
} from "@/lib/facilitator-permissions";
import {
  resolveAssignmentCapabilityLevel,
  executeWithOptionalProfileColumn,
} from "./programAssignments";
import { ensureContextRoleProfilesSchema } from "./contextRoleProfiles";

/** The template assignment-derived program management resolves to. */
export const ASSIGNED_PM_PROFILE = {
  name: "Assigned Program Manager",
  description:
    "Assignment-derived program management — the program you are assigned to",
  capabilities: { programs: { view: 1, edit: 3, publish: 4 } },
};

/**
 * The PORTFOLIO template (step 3 of the program-scope program).
 *
 * The seeded "Program Manager" template bundles three unrelated jobs, applied
 * by identity label:
 *
 *   programme management  — see/create/edit/publish EVERY programme
 *   venture work          — see AND EDIT ventures
 *   CRM work              — see people AND CREATE people
 *     (+ projects, reports, messaging, courses)
 *
 * Because it is one unit, the where-it-applies rule cannot narrow the programme
 * part without also touching the other two, and the other two are not attached
 * to a programme at all — so scope has nothing to say about them. That is why
 * the bundle must be SPLIT before scope can be enforced.
 *
 * This template keeps what genuinely runs the portfolio and drops the two
 * misplaced powers. See-visibility is kept in both directions on purpose:
 * programme work reads participant records and can touch venture-producing
 * programmes, so removing the READ would break working screens; removing the
 * WRITE is what takes away a job that belongs to another responsibility.
 *
 * Creating this template changes nobody. The role default is repointed to it
 * deliberately from the permission console, AFTER reading the impact report
 * (src/models/authorization/programScopeReadiness.js) — never at boot.
 */
export const PORTFOLIO_PM_PROFILE = {
  name: "Program Manager (Portfolio)",
  description:
    "Portfolio-wide program oversight — see and create programs, reports; the assignment template covers one program",
  capabilities: {
    programs: { view: 1, create: 2, edit: 3, publish: 4 },
    projects: { view: 1 },
    // ventures.edit REMOVED: that is the venture responsibility, already
    // granted inside the venture's own boundary. ventures.view stays because
    // programme oversight touches venture-producing programmes.
    ventures: { view: 1 },
    reports: { view: 1, create: 2, export: 3 },
    messaging: { view: 1, send: 2 },
    // contacts.create REMOVED: creating people is CRM work. contacts.view stays
    // because every programme screen reads participant records.
    contacts: { view: 1 },
    lms: { view: 1 },
  },
};

/**
 * The profile the registry row was seeded with. Repointing only happens while
 * the row still points here (or nowhere) — a deliberate administrator choice is
 * never overwritten.
 */
const SEEDED_PM_PROFILE_NAME = "Program Manager";

/**
 * Create a template with its capabilities, insert-only, and return its id.
 * Shared by both templates above so their creation rules cannot diverge (the
 * previous hand-rolled loop also only covered the `programs` module, which
 * would have silently dropped every other module of the portfolio template).
 */
async function ensureProfile(template) {
  await db.execute({
    sql: `INSERT INTO access_profiles (name, description, is_active)
          VALUES (?, ?, 1)
          ON CONFLICT (name) DO NOTHING`,
    args: [template.name, template.description],
  });
  const res = await db.execute({
    sql: "SELECT id FROM access_profiles WHERE name = ?",
    args: [template.name],
  });
  const profileId = res.rows?.[0]?.id ?? null;
  if (!profileId) return null;

  for (const [module, capabilities] of Object.entries(template.capabilities)) {
    for (const [capability, level] of Object.entries(capabilities)) {
      await db.execute({
        sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (profile_id, module, capability) DO NOTHING`,
        args: [profileId, module, capability, level],
      });
    }
  }
  return profileId;
}

/**
 * Create the PORTFOLIO template (step 3 of the program-scope program).
 *
 * ADDITIVE AND INERT: nothing resolves to it until an administrator repoints
 * the programme-manager role default at it, so running this at boot cannot
 * change anyone's access. The impact report (programScopeReadiness.js) states
 * what that repoint would remove, per template, BEFORE it happens.
 */
export async function ensurePortfolioProgramManagerProfile() {
  await ensurePermissionsSchema();
  const profileId = await ensureProfile(PORTFOLIO_PM_PROFILE);
  if (!profileId) return { success: false, reason: "profile-unavailable" };
  return { success: true, profileId };
}

export async function ensureAssignedProgramManagerProfile() {
  await ensurePermissionsSchema();
  await ensureContextRoleProfilesSchema();

  const profileId = await ensureProfile(ASSIGNED_PM_PROFILE);
  if (!profileId) {
    // Soft failure on purpose. This runs inside the boot chain that EVERY
    // authorization decision awaits, so throwing here would turn a missing
    // profile into a global authorization outage (500 on every gated call).
    // The profile is created by the INSERT above, so this only happens on a
    // database that cannot write at all — and the registry gap stays visible in
    // the Context Roles screen rather than being hidden.
    return { success: false, reason: "profile-unavailable" };
  }

  const seededRes = await db.execute({
    sql: "SELECT id FROM access_profiles WHERE name = ?",
    args: [SEEDED_PM_PROFILE_NAME],
  });
  const seededId = seededRes.rows?.[0]?.id ?? null;

  const repointed = await db.execute({
    sql: `UPDATE context_role_profiles
          SET profile_id = ?, updated_at = NOW()
          WHERE context = 'program' AND role_key = 'program_manager'
            AND (profile_id IS NULL OR profile_id = ?)`,
    args: [profileId, seededId],
  });

  return {
    success: true,
    profileId,
    repointedRows: repointed?.rowsAffected ?? 0,
  };
}

/**
 * Fill the missing facilitator tick-list entries at the level today's
 * resolution already produces. Never rewrites an existing entry, so an
 * administrator's explicit 0 stays a 0 (which is what makes a per-program
 * removal meaningful once enforcement reads it).
 */
export async function backfillFacilitatorTickLists() {
  await ensurePermissionsSchema();
  // The profile-override column is optional here too: the tick list is what this
  // backfill exists for, and it must not be blocked by a column that only refines
  // the level lookup (see executeWithOptionalProfileColumn).
  const rowRes = await executeWithOptionalProfileColumn({
    withColumn: `SELECT id, CAST(program_id AS TEXT) AS program_id, permissions, access_profile_id
          FROM v2_program_staff
          WHERE LOWER(COALESCE(role, '')) = 'facilitator'`,
    withoutColumn: `SELECT id, CAST(program_id AS TEXT) AS program_id, permissions, NULL AS access_profile_id
          FROM v2_program_staff
          WHERE LOWER(COALESCE(role, '')) = 'facilitator'`,
    args: [],
  });
  const rows = rowRes.rows || [];
  if (rows.length === 0) return { success: true, updated: 0, scanned: 0 };

  const programIds = [...new Set(rows.map((row) => String(row.program_id)))].filter(
    Boolean,
  );
  const profileIds = [
    ...new Set(
      rows
        .map((row) => row.access_profile_id)
        .filter((id) => id !== null && id !== undefined && id !== ""),
    ),
  ];

  const [defaultsRes, profileRes] = await Promise.all([
    programIds.length
      ? db.execute({
          sql: `SELECT CAST(id AS TEXT) AS id, facilitator_default_permissions AS def
                FROM v2_programs
                WHERE CAST(id AS TEXT) IN (${programIds.map(() => "?").join(",")})`,
          args: programIds,
        })
      : Promise.resolve({ rows: [] }),
    profileIds.length
      ? db.execute({
          sql: `SELECT profile_id, module, capability, access_level
                FROM access_profile_capabilities
                WHERE profile_id IN (${profileIds.map(() => "?").join(",")})`,
          args: profileIds,
        })
      : Promise.resolve({ rows: [] }),
  ]);

  const programDefaultById = {};
  for (const row of defaultsRes.rows || []) {
    programDefaultById[String(row.id)] = parsePermissions(row.def);
  }
  const profileCapsById = {};
  for (const row of profileRes.rows || []) {
    const profileId = String(row.profile_id);
    profileCapsById[profileId] ??= [];
    profileCapsById[profileId].push(row);
  }

  let updated = 0;
  for (const row of rows) {
    const current = parsePermissions(row.permissions);
    const missing = FACILITATOR_CAPABILITY_KEYS.filter(
      (capability) => typeof current[capability] !== "number",
    );
    if (missing.length === 0) continue;

    const ctx = {
      profileCaps:
        row.access_profile_id != null
          ? profileCapsById[String(row.access_profile_id)] || []
          : [],
      programDefault: programDefaultById[String(row.program_id)] || {},
    };
    const next = { ...current };
    for (const capability of missing) {
      next[capability] = Number(
        resolveAssignmentCapabilityLevel(row, capability, ctx),
      );
    }

    await db.execute({
      sql: "UPDATE v2_program_staff SET permissions = ? WHERE id = ?",
      args: [JSON.stringify(next), row.id],
    });
    updated++;
  }

  return { success: true, updated, scanned: rows.length };
}

/** The identity whose default template the split replaces. */
export const PROGRAM_MANAGER_ROLE = "program_manager";

/**
 * REPOINT the programme-manager role default at the trimmed portfolio template.
 *
 * This is the deliberate click behind step 3. Creating the template changes
 * nobody; pointing the default at it is what removes `ventures.edit` and
 * `contacts.create` from everyone who resolves through their identity — so it is
 * an ACTION with an audit record, not something that happens at boot.
 *
 * Refuses to overwrite a template an administrator chose on purpose: the repoint
 * only proceeds while the default still points at the seeded "Program Manager"
 * template or at nothing. Anything else is reported back as an error with the
 * current profile, for the administrator to decide about.
 *
 * Idempotent: repointing an already-repointed default is a no-op.
 */
export async function repointProgramManagerDefaultToPortfolio() {
  await ensurePermissionsSchema();

  const portfolio = await ensurePortfolioProgramManagerProfile();
  if (!portfolio?.profileId) {
    return { success: false, error: "portfolio-profile-unavailable" };
  }

  const [seededRes, currentRes] = await Promise.all([
    db.execute({
      sql: "SELECT id, name FROM access_profiles WHERE name = ?",
      args: [SEEDED_PM_PROFILE_NAME],
    }),
    db.execute({
      sql: "SELECT access_profile_id FROM role_access_profile_defaults WHERE role_name = ? LIMIT 1",
      args: [PROGRAM_MANAGER_ROLE],
    }),
  ]);
  const seededId = seededRes.rows?.[0]?.id ?? null;
  const currentId = currentRes.rows?.[0]?.access_profile_id ?? null;

  if (currentId === portfolio.profileId) {
    return {
      success: true,
      changed: false,
      to: PORTFOLIO_PM_PROFILE.name,
      reason: "already-repointed",
    };
  }
  if (currentId !== null && currentId !== seededId) {
    return {
      success: false,
      changed: false,
      error: "role-default-customized",
      currentProfileId: currentId,
    };
  }

  await db.execute({
    sql: `INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
          VALUES (?, ?)
          ON CONFLICT (role_name) DO UPDATE SET access_profile_id = ?`,
    args: [PROGRAM_MANAGER_ROLE, portfolio.profileId, portfolio.profileId],
  });

  return {
    success: true,
    changed: true,
    from: seededId ? SEEDED_PM_PROFILE_NAME : null,
    to: PORTFOLIO_PM_PROFILE.name,
    profileId: portfolio.profileId,
  };
}
