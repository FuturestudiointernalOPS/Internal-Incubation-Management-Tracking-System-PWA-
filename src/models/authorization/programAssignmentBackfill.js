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
import { resolveAssignmentCapabilityLevel } from "./programAssignments";
import { ensureContextRoleProfilesSchema } from "./contextRoleProfiles";

/** The template assignment-derived program management resolves to. */
export const ASSIGNED_PM_PROFILE = {
  name: "Assigned Program Manager",
  description:
    "Assignment-derived program management — the program you are assigned to",
  capabilities: { programs: { view: 1, edit: 3, publish: 4 } },
};

/**
 * The profile the registry row was seeded with. Repointing only happens while
 * the row still points here (or nowhere) — a deliberate administrator choice is
 * never overwritten.
 */
const SEEDED_PM_PROFILE_NAME = "Program Manager";

export async function ensureAssignedProgramManagerProfile() {
  await ensurePermissionsSchema();
  await ensureContextRoleProfilesSchema();

  await db.execute({
    sql: `INSERT INTO access_profiles (name, description, is_active)
          VALUES (?, ?, 1)
          ON CONFLICT (name) DO NOTHING`,
    args: [ASSIGNED_PM_PROFILE.name, ASSIGNED_PM_PROFILE.description],
  });

  const profileRes = await db.execute({
    sql: "SELECT id FROM access_profiles WHERE name = ?",
    args: [ASSIGNED_PM_PROFILE.name],
  });
  const profileId = profileRes.rows?.[0]?.id ?? null;
  if (!profileId) {
    // Soft failure on purpose. This runs inside the boot chain that EVERY
    // authorization decision awaits, so throwing here would turn a missing
    // profile into a global authorization outage (500 on every gated call).
    // The profile is created by the INSERT above, so this only happens on a
    // database that cannot write at all — and the registry gap stays visible in
    // the Context Roles screen rather than being hidden.
    return { success: false, reason: "profile-unavailable" };
  }

  for (const [capability, level] of Object.entries(
    ASSIGNED_PM_PROFILE.capabilities.programs,
  )) {
    await db.execute({
      sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
            VALUES (?, 'programs', ?, ?)
            ON CONFLICT (profile_id, module, capability) DO NOTHING`,
      args: [profileId, capability, level],
    });
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
  const rowRes = await db.execute({
    sql: `SELECT id, CAST(program_id AS TEXT) AS program_id, permissions, access_profile_id
          FROM v2_program_staff
          WHERE LOWER(COALESCE(role, '')) = 'facilitator'`,
  });
  const rows = rowRes.rows || [];
  if (rows.length === 0) return { success: true, updated: 0, scanned: 0 };

  const programIds = [...new Set(rows.map((r) => String(r.program_id)))].filter(
    Boolean,
  );
  const profileIds = [
    ...new Set(
      rows
        .map((r) => r.access_profile_id)
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
    const id = String(row.profile_id);
    profileCapsById[id] ??= [];
    profileCapsById[id].push(row);
  }

  let updated = 0;
  for (const row of rows) {
    const current = parsePermissions(row.permissions);
    const missing = FACILITATOR_CAPABILITY_KEYS.filter(
      (cap) => typeof current[cap] !== "number",
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
