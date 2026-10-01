/**
 * ACCESS PROFILES + RESPONSIBILITIES.
 *
 * The effective Access Profile resolution chain (explicit → role default →
 * legacy) and the responsibilities domain (what a user owns, not what they may
 * do). These are the last six functions that used to be implemented in
 * `src/lib/auth.js`; they were RELOCATED verbatim — not merged with the parallel
 * implementations in `models/authorization.js` / `models/responsibilities.js` —
 * so behaviour is unchanged.
 *
 * The decisions — the resolution order, the capability map shape and the
 * seed-before-read — live here; every statement is in
 * `@/models/accessProfilesStore`. Nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/auth` (the module it came from) — see
 * docs/LAYER_SPLIT.md.
 */

import { initDb } from "@/lib/db";
import {
  ensureResponsibilitiesSchema,
  seedDefaultResponsibilities,
} from "@/models/authorization/bootstrap";
import {
  selectUserAccessProfileId,
  selectActiveAccessProfileById,
  selectRoleDefaultAccessProfile,
  selectAccessProfileCapabilityRows,
  selectResponsibilitiesForUser,
  insertUserResponsibility,
  deleteUserResponsibility,
  selectActiveResponsibilities,
} from "@/models/accessProfilesStore";

/**
 * Resolves the effective Access Profile for a user.
 * Returns { profileId, profileName, source: 'user'|'role'|'legacy' }
 */
export async function getUserEffectiveProfile(userCid, userRole) {
  try {
    await initDb();

    // Step 1: Check if user has an explicit access_profile_id
    const userRes = await selectUserAccessProfileId(userCid);

    if (userRes.rows.length > 0 && userRes.rows[0].access_profile_id) {
      const profile = await selectActiveAccessProfileById(userRes.rows[0].access_profile_id);
      if (profile.rows.length > 0) {
        return {
          profileId: profile.rows[0].id,
          profileName: profile.rows[0].name,
          source: "user",
        };
      }
    }

    // Step 2: Check role's default access profile
    if (userRole) {
      const roleDefault = await selectRoleDefaultAccessProfile(userRole);
      if (roleDefault.rows.length > 0) {
        return {
          profileId: roleDefault.rows[0].id,
          profileName: roleDefault.rows[0].name,
          source: "role",
        };
      }
    }

    // Step 3: No profile found — return legacy signal
    return { profileId: null, profileName: null, source: "legacy" };
  } catch (error) {
    console.error("getUserEffectiveProfile error:", error.message);
    return { profileId: null, profileName: null, source: "legacy" };
  }
}

/**
 * Gets capabilities from an access profile.
 * Returns Map { capabilityKey -> accessLevel }
 */
export async function getAccessProfileCapabilities(profileId) {
  try {
    await initDb();
    const rows = await selectAccessProfileCapabilityRows(profileId);
    const result = {};
    for (const row of rows.rows) {
      if (!result[row.module]) result[row.module] = {};
      result[row.module][row.capability] = row.access_level;
    }
    return result;
  } catch (error) {
    console.error("getAccessProfileCapabilities error:", error.message);
    return {};
  }
}

/**
 * Get all responsibilities for a user.
 * Returns array of { id, name, key, description, icon }
 */
export async function getUserResponsibilities(userCid) {
  try {
    await initDb();
    await ensureResponsibilitiesSchema();
    const result = await selectResponsibilitiesForUser(userCid);
    return result.rows;
  } catch (error) {
    console.error("getUserResponsibilities error:", error.message);
    return [];
  }
}

/**
 * Assign a responsibility to a user.
 */
export async function assignResponsibility(
  userCid,
  responsibilityId,
  assignedBy,
) {
  try {
    await initDb();
    await ensureResponsibilitiesSchema();
    await insertUserResponsibility(userCid, responsibilityId, assignedBy || null);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Remove a responsibility from a user.
 */
export async function removeResponsibility(userCid, responsibilityId) {
  try {
    await initDb();
    await ensureResponsibilitiesSchema();
    await deleteUserResponsibility(userCid, responsibilityId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all available responsibilities (active).
 */
export async function getAllResponsibilities() {
  try {
    await initDb();
    // Idempotent upsert — guarantees the canonical default responsibilities
    // (including "crm") always exist, even for partially-seeded databases.
    // Safe to call repeatedly; each statement is ON CONFLICT DO UPDATE.
    await seedDefaultResponsibilities();
    const result = await selectActiveResponsibilities();
    return result.rows;
  } catch {
    return [];
  }
}
