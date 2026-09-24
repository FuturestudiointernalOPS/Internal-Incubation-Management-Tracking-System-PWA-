import db, { initDb } from "@/lib/db";
import {
  ensureResponsibilitiesSchema,
  seedDefaultResponsibilities,
} from "@/models/authorization/bootstrap";

// ─────────────────────────────────────────────────────────────────────────────
// FACADE — src/lib/auth.js is no longer where any of this is implemented.
//
//   AUTHENTICATION  → @/server/auth             (session, cookies, password, guards)
//   AUTHORIZATION   → @/server/authz            (capabilities, program access, guards)
//                     @/models/authorization     (the SQL behind them)
//
// Both halves are re-exported below so the ~250 importers that read them from
// here keep working unchanged; new code imports the real home.
//
// What is still IMPLEMENTED here is the last six functions: the effective
// access-profile resolution and the responsibilities domain. They are held back
// on purpose — each has a second, parallel implementation over the same tables
// (models/authorization.js, models/responsibilities.js), and merging them would
// change behaviour. Once that is arbitrated they move too, and this file goes.
// ─────────────────────────────────────────────────────────────────────────────
export {
  SESSION_COOKIE_NAME,
  setSessionCookieOnResponse,
} from "@/server/auth/cookies";
export { createSession, getSession, destroySession } from "@/server/auth/session";
export { requireSession, requireAuth } from "@/server/auth/guards";

export {
  PERMISSION_MODULES,
  ACCESS_LEVELS,
  FACILITATOR_BYPASS_ROLES,
  hasProgramManagementAccess,
} from "@/server/authz/capabilities";
export {
  resolveProgramAssignment,
  getFacilitatorPermissionLevel,
} from "@/server/authz/programAccess";
export {
  requireProjectAccess,
  requireProgramFacilitator,
  enforceFacilitatorProgramAccess,
  requireAssignmentAccess,
  assertNoParticipantFacilitatorConflict,
} from "@/server/authz/guards";
// Authorization reads and the audit write used to be defined here; they now sit
// in the model and are re-exported so the public surface of this module only
// ever grows.
export {
  getProgramFacilitatorAssignment,
  getProgramAssignment,
  getAssignmentStatus,
  getUserGroups,
  logPermissionAudit,
  isAssignedPmForProgram,
  hasAnyFacilitatorAssignment,
  getFacilitatorTeamScope,
  isSupervisorOf,
} from "@/models/authorization/accessQueries";
// The runtime schema self-heal and the default grants (role capabilities,
// Access Profiles, the responsibilities catalogue) are model code now.
export {
  seedDefaultRoleCapabilities,
  seedDefaultAccessProfiles,
  ensureResponsibilitiesSchema,
  ensurePermissionsSchema,
  seedDefaultResponsibilities,
} from "@/models/authorization/bootstrap";

// =============================================================================
// ACCESS PROFILE SYSTEM
// =============================================================================
// Resolution chain:
//   1. User's explicit access_profile_id (on contacts table)
//   2. Role's default access profile (via role_access_profile_defaults)
//   3. Legacy fallback: role_capabilities table
// =============================================================================

/**
 * Resolves the effective Access Profile for a user.
 * Returns { profileId, profileName, source: 'user'|'role'|'legacy' }
 */
export async function getUserEffectiveProfile(userCid, userRole) {
  try {
    await initDb();

    // Step 1: Check if user has an explicit access_profile_id
    const userRes = await db.execute({
      sql: "SELECT access_profile_id FROM contacts WHERE cid = ?",
      args: [userCid],
    });

    if (userRes.rows.length > 0 && userRes.rows[0].access_profile_id) {
      const profile = await db.execute({
        sql: "SELECT id, name FROM access_profiles WHERE id = ? AND is_active = 1",
        args: [userRes.rows[0].access_profile_id],
      });
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
      const roleDefault = await db.execute({
        sql: `SELECT ap.id, ap.name
              FROM role_access_profile_defaults rpd
              JOIN access_profiles ap ON ap.id = rpd.access_profile_id
              WHERE rpd.role_name = ? AND ap.is_active = 1`,
        args: [userRole],
      });
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
    const rows = await db.execute({
      sql: "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = ?",
      args: [profileId],
    });
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

// =============================================================================
// RESPONSIBILITY SYSTEM
// =============================================================================
// Responsibilities determine operational ownership:
//   - What dashboards a user sees
//   - What navigation items appear
//   - What reports they can access
// Responsibilities are NOT permissions — they define ownership scope.
// =============================================================================

/**
 * Get all responsibilities for a user.
 * Returns array of { id, name, key, description, icon }
 */
export async function getUserResponsibilities(userCid) {
  try {
    await initDb();
    await ensureResponsibilitiesSchema();
    const result = await db.execute({
      sql: `SELECT r.id, r.name, r.key, r.description, r.icon, r.allowed_roles
            FROM responsibilities r
            JOIN user_responsibilities ur ON ur.responsibility_id = r.id
            WHERE ur.user_cid = ? AND r.is_active = 1
            ORDER BY r.name`,
      args: [userCid],
    });
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
    await db.execute({
      sql: `INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
            VALUES (?, ?, ?)
            ON CONFLICT (user_cid, responsibility_id) DO NOTHING`,
      args: [userCid, responsibilityId, assignedBy || null],
    });
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
    await db.execute({
      sql: "DELETE FROM user_responsibilities WHERE user_cid = ? AND responsibility_id = ?",
      args: [userCid, responsibilityId],
    });
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
    const result = await db.execute({
      sql: "SELECT * FROM responsibilities WHERE is_active = 1 ORDER BY name",
    });
    return result.rows;
  } catch {
    return [];
  }
}

