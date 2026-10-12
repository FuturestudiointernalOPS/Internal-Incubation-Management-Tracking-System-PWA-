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
 * Imported directly from here now that the `@/lib/auth` facade is gone — see
 * docs/LAYER_SPLIT.md.
 */

import { initDb } from "@/lib/db";
import {
  ensureResponsibilitiesSchema,
  seedDefaultResponsibilities,
} from "@/models/authorization/bootstrap";
import {
  selectResponsibilitiesForUser,
  insertUserResponsibility,
  deleteUserResponsibility,
  selectActiveResponsibilities,
} from "@/models/accessProfilesStore";
import { getContactBaseState } from "@/models/authorization/baseCapabilityReads";
import {
  resolveContactBaseProfile,
  resolveRoleDefaultBaseProfile,
} from "@/models/authorization/contextReads";
import { listProfileCapabilities } from "@/models/authorization/profileCapabilitiesStore";

/**
 * Resolves the effective PROFILE for a user.
 * Returns { profileKey, profileName, source: 'user'|'role'|'legacy' }
 */
export async function getUserEffectiveProfile(userCid, userRole) {
  try {
    await initDb();

    const contact = (await getContactBaseState(userCid)).rows[0] || {};

    // Step 1: an explicit profile override, by KEY.
    if (contact.profile_key) {
      const profile = await resolveContactBaseProfile({ profileKey: contact.profile_key });
      if (profile.rows.length > 0) {
        return {
          profileKey: contact.profile_key,
          profileName: profile.rows[0].label,
          source: "user",
        };
      }
    }

    // Step 2: the role's default profile.
    const role = userRole || contact.role;
    if (role) {
      const roleDefault = await resolveRoleDefaultBaseProfile(role);
      if (roleDefault.rows.length > 0) {
        return {
          profileKey: roleDefault.rows[0].profile_key,
          profileName: roleDefault.rows[0].label,
          source: "role",
        };
      }
    }

    // Step 3: No profile found — the identity's role capabilities are the base.
    return { profileKey: null, profileName: null, source: "legacy" };
  } catch (error) {
    console.error("getUserEffectiveProfile error:", error.message);
    return { profileKey: null, profileName: null, source: "legacy" };
  }
}

/**
 * Gets capabilities from a profile, by KEY.
 * Returns Map { module: { capability: level } }
 */
export async function getAccessProfileCapabilities(profileKey) {
  try {
    await initDb();
    const rows = await listProfileCapabilities(profileKey);
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
