/**
 * PHASE E — the capability templates and registry mappings the newly activated
 * context/profile couples resolve to (docs/ROADMAP_ROLES_PROFILES_ACCESS.md §7).
 *
 * Phase E turns on `{investor, investor}`, `{lms, learner}` and
 * `{venture, venture_manager}`. Two of them had NEITHER a capability template NOR
 * a registry mapping (`lms:learner` was seeded with a NULL profile on purpose,
 * pending review; `venture:venture_manager` had no row at all). This module
 * creates the missing profiles and points the registry rows at them.
 *
 * Created here rather than through `seedDefaultAccessProfiles`, which only runs
 * from an admin endpoint and is therefore not guaranteed to have run — the exact
 * reasoning behind `ensureAssignedProgramManagerProfile`.
 *
 * Additive and administrator-respecting: the profiles are created insert-only
 * (their capabilities use `ON CONFLICT DO NOTHING`), the registry rows are
 * ensured insert-only, and a row is repointed ONLY while its `profile_id` is
 * still NULL. A mapping an administrator chose is never overwritten.
 */

import db from "@/lib/db";
import { ensurePermissionsSchema } from "@/models/authorization/bootstrap";
import { ensureContextRoleProfilesSchema } from "./contextRoleProfiles";
import { ensureProfile } from "./programAssignmentBackfill";

/** A learner reads the courses they are enrolled in — nothing more. */
export const LEARNER_PROFILE = {
  name: "Learner",
  description: "Course learner — read access to the courses they are enrolled in",
  capabilities: { lms: { view: 1 } },
};

/**
 * A venture lead manager runs the venture they lead. `venture_own` scope
 * (which already covers active venture staff assignments) confines the edit to
 * that venture, exactly as it does for a founder.
 */
export const VENTURE_MANAGER_PROFILE = {
  name: "Venture Manager",
  description: "Venture lead manager — manage the venture they lead",
  capabilities: { ventures: { view: 1, edit: 3 } },
};

/** The `(context, role_key)` rows Phase E resolves, and the template each maps to. */
export const PHASE_E_MAPPINGS = [
  { context: "lms", roleKey: "learner", template: LEARNER_PROFILE },
  { context: "venture", roleKey: "venture_manager", template: VENTURE_MANAGER_PROFILE },
];

/**
 * One-time, idempotent. Creates the templates, ensures the registry rows exist,
 * and fills their NULL mapping. Safe to re-run (INSERT … DO NOTHING / NULL-only
 * UPDATE), and it NEVER throws on a soft failure — it runs inside the boot chain
 * that every authorization decision awaits.
 */
export async function ensurePhaseEContextProfiles() {
  await ensurePermissionsSchema();
  await ensureContextRoleProfilesSchema();

  const applied = [];
  for (const mapping of PHASE_E_MAPPINGS) {
    const profileId = await ensureProfile(mapping.template);
    if (!profileId) {
      // Soft failure on purpose (see ensureAssignedProgramManagerProfile): a
      // database that cannot write leaves the registry gap visible rather than
      // turning it into a global authorization outage.
      applied.push({
        context: mapping.context,
        roleKey: mapping.roleKey,
        reason: "profile-unavailable",
      });
      continue;
    }

    // The row must exist before it can be pointed. Insert-only, so an
    // administrator's row (any profile) is left exactly as it is.
    await db.execute({
      sql: `INSERT INTO context_role_profiles (context, role_key, profile_id, is_active, notes)
            VALUES (?, ?, NULL, 1, '')
            ON CONFLICT (context, role_key) DO NOTHING`,
      args: [mapping.context, mapping.roleKey],
    });

    // Fill ONLY a row nobody has mapped yet.
    const repointed = await db.execute({
      sql: `UPDATE context_role_profiles
            SET profile_id = ?, updated_at = NOW()
            WHERE context = ? AND role_key = ? AND profile_id IS NULL`,
      args: [profileId, mapping.context, mapping.roleKey],
    });

    applied.push({
      context: mapping.context,
      roleKey: mapping.roleKey,
      profileId,
      repointedRows: repointed?.rowsAffected ?? 0,
    });
  }

  return { success: true, applied };
}
