import db, { initDb } from "@/lib/db";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";

import { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "impactos_session";
const SESSION_DURATION_HOURS = 24;
const SESSION_DURATION_MS = SESSION_DURATION_HOURS * 60 * 60 * 1000;

/**
 * Creates a new session for a user.
 * Stores session in database and returns the token and maxAge.
 * The caller is responsible for setting the cookie on the response.
 */
export async function createSession(userCid, userRole) {
  await initDb();

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  // Clean up old sessions for this user
  await db.execute({
    sql: "DELETE FROM user_sessions WHERE user_cid = ?",
    args: [userCid],
  });

  // Create new session
  await db.execute({
    sql: `INSERT INTO user_sessions (token, user_cid, role, expires_at)
          VALUES (?, ?, ?, ?)`,
    args: [
      token,
      userCid,
      userRole,
      expiresAt.toISOString().replace("T", " ").replace("Z", ""),
    ],
  });

  return { token, maxAge: SESSION_DURATION_HOURS * 60 * 60 };
}

/**
 * Validates a session and returns user info.
 * Reads the session token from the HTTP-only cookie.
 */
export async function getSession() {
  try {
    await initDb();

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) return null;

    const result = await db.execute({
      sql: `SELECT s.*, c.name, c.email, c.status, c.group_name
            FROM user_sessions s
            LEFT JOIN contacts c ON s.user_cid = c.cid
            WHERE s.token = ? AND s.expires_at > NOW()`,
      args: [token],
    });

    if (result.rows.length === 0) return null;

    const session = result.rows[0];

    // Verify user is still in good standing (approved/active for staff, active for others)
    const allowedStatuses = ["active", "approved"];
    if (
      session.status &&
      !allowedStatuses.includes(session.status) &&
      session.role !== "super_admin"
    ) {
      await destroySession();
      return null;
    }

    return {
      cid: session.user_cid,
      name: session.name,
      email: session.email,
      role: session.role,
      group_name: session.group_name,
      token: session.token,
    };
  } catch (error) {
    console.error("Session validation error:", error);
    return null;
  }
}

/**
 * Sets the session cookie on a NextResponse object.
 * This is more reliable than using cookies().set() in route handlers.
 */
export function setSessionCookieOnResponse(response, token, maxAge) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return response;
}

/**
 * Destroys the current session (logout).
 */
export async function destroySession() {
  try {
    await initDb();

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await db.execute({
        sql: "DELETE FROM user_sessions WHERE token = ?",
        args: [token],
      });
    }

    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (error) {
    console.error("Session destruction error:", error);
  }
}

/**
 * Requires a valid session. Returns the session or throws.
 */
export async function requireSession(allowedRoles = null) {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    throw new Error("Forbidden");
  }

  return session;
}

/**
 * API-friendly auth guard that returns a NextResponse error
 * instead of throwing. Use in route handlers:
 *
 *   const authError = await requireAuth(['super_admin']);
 *   if (authError) return authError;
 *
 * On success, returns null and the caller can proceed.
 */
export async function requireAuth(allowedRoles = null) {
  try {
    const session = await requireSession(allowedRoles);
    return null; // authorized
  } catch (err) {
    if (err.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    if (err.message === "Forbidden") {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Authentication system failure." },
      { status: 500 },
    );
  }
}

/**
 * requireProjectAccess — Auth guard for project-scoped endpoints.
 *
 * Allows access if the user is:
 *   1. Authenticated AND
 *   2. A super_admin, OR the project owner, OR a project member
 *
 * Usage:
 *   const authError = await requireProjectAccess(projectId);
 *   if (authError) return authError;
 */
export async function requireProjectAccess(projectId) {
  try {
    const session = await requireSession(); // any authenticated user

    // Super_admin bypass
    if (session.role === "super_admin") return null;

    await initDb();

    // Check if project exists
    const projectCheck = await db.execute({
      sql: "SELECT id FROM v2_projects WHERE id::text = ?",
      args: [projectId],
    });

    if (projectCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 },
      );
    }

    // Check if user is a project member or lead (covers both owners and collaborators)
    const memberCheck = await db.execute({
      sql: "SELECT 1 FROM project_members WHERE project_id::text = ? AND user_cid = ?",
      args: [projectId, session.cid],
    });

    if (memberCheck.rows.length > 0) return null;

    // Deny
    return NextResponse.json(
      { success: false, error: "Insufficient permissions." },
      { status: 403 },
    );
  } catch (err) {
    if (err.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Authentication system failure." },
      { status: 500 },
    );
  }
}

// =============================================================================
// AUTHORIZATION SYSTEM
// =============================================================================

export const PERMISSION_MODULES = {
  projects: {
    name: "Projects",
    capabilities: ["view", "create", "edit", "delete", "archive"],
  },
  programs: {
    name: "Programs",
    capabilities: ["view", "create", "edit", "delete", "publish"],
  },
  users: {
    name: "Users",
    capabilities: [
      "view",
      "create",
      "edit",
      "suspend",
      "delete",
      "assign_roles",
    ],
  },
  reports: {
    name: "Reports",
    capabilities: ["view", "create", "export", "delete"],
  },
  messaging: { name: "Messaging", capabilities: ["view", "send", "delete"] },
  internal_comms: {
    name: "Internal Communication",
    capabilities: ["view", "create_announcements", "moderate"],
  },
  contacts: {
    name: "Contacts",
    capabilities: ["view", "create", "edit", "delete", "import", "export"],
  },
  permissions: {
    name: "Permissions",
    capabilities: [
      "view_matrix",
      "grant",
      "revoke",
      "assign_capabilities",
      "assign_groups",
      "assign_responsibilities",
      "promote_super_admin",
      "remove_super_admin",
    ],
  },
  engineering: {
    name: "Engineering Operations",
    capabilities: [
      "view",
      "manage_tasks",
      "manage_errors",
      "manage_developers",
    ],
  },
  finance: {
    name: "Finance",
    capabilities: ["view", "create", "edit", "delete", "export"],
  },
  settings: { name: "System Settings", capabilities: ["view", "edit"] },
};

export const ACCESS_LEVELS = {
  NONE: 0,
  VIEW: 1,
  CREATE: 2,
  EDIT: 3,
  DELETE: 4,
  FULL: 5,
};

export async function getUserGroups(userCid) {
  try {
    await initDb();
    const r = await db.execute({
      sql: "SELECT group_name FROM user_groups WHERE user_cid = ?",
      args: [userCid],
    });
    if (r.rows.length > 0) return r.rows.map((g) => g.group_name);
    const u = await db.execute({
      sql: "SELECT group_name FROM contacts WHERE cid = ?",
      args: [userCid],
    });
    if (u.rows.length > 0 && u.rows[0].group_name)
      return [u.rows[0].group_name];
    return [];
  } catch {
    return [];
  }
}

export async function getUserEffectiveCapabilities(userCid, userRole, module) {
  try {
    await initDb();
    const groups = await getUserGroups(userCid);
    const role = await db.execute({
      sql: "SELECT capability, access_level FROM role_capabilities WHERE role = ? AND module = ?",
      args: [userRole, module],
    });
    let group = [];
    if (groups.length > 0) {
      const ph = groups.map(() => "?").join(",");
      group = (
        await db.execute({
          sql: `SELECT capability, access_level FROM group_capabilities WHERE group_name IN (${ph}) AND module = ?`,
          args: [...groups, module],
        })
      ).rows;
    }
    const grants = (
      await db.execute({
        sql: "SELECT capability, access_level FROM user_capabilities WHERE user_cid = ? AND module = ? AND (expires_at IS NULL OR expires_at > NOW())",
        args: [userCid, module],
      })
    ).rows;
    const restricts = new Set(
      (
        await db.execute({
          sql: "SELECT capability FROM user_capability_restrictions WHERE user_cid = ? AND module = ? AND (expires_at IS NULL OR expires_at > NOW())",
          args: [userCid, module],
        })
      ).rows.map((r) => r.capability),
    );
    const merged = new Map();
    const add = (cap, lvl) => {
      const e = merged.get(cap) || 0;
      if (lvl > e) merged.set(cap, lvl);
    };
    role.rows.forEach((r) => add(r.capability, r.access_level));
    group.forEach((r) => add(r.capability, r.access_level));
    grants.forEach((r) => add(r.capability, r.access_level));
    restricts.forEach((c) => merged.delete(c));
    return merged;
  } catch {
    return new Map();
  }
}

export async function getUserFullPermissionMatrix(userCid, userRole) {
  const result = {};
  for (const mod of Object.keys(PERMISSION_MODULES)) {
    const caps = await getUserEffectiveCapabilities(userCid, userRole, mod);
    result[mod] = {};
    for (const [capability, level] of caps) result[mod][capability] = level;
  }
  return result;
}

export async function hasCapability(
  userCid,
  userRole,
  module,
  capability,
  minLevel = 1,
) {
  try {
    await initDb();
    if (userRole === "super_admin") {
      const r = await db.execute({
        sql: "SELECT 1 FROM user_capability_restrictions WHERE user_cid = ? AND module = ? AND capability = ? AND (expires_at IS NULL OR expires_at > NOW())",
        args: [userCid, module, capability],
      });
      if (r.rows.length === 0) {
        const g = await db.execute({
          sql: "SELECT access_level FROM user_capabilities WHERE user_cid = ? AND module = ? AND capability = ? AND (expires_at IS NULL OR expires_at > NOW())",
          args: [userCid, module, capability],
        });
        if (g.rows.length > 0)
          return parseInt(g.rows[0].access_level) >= minLevel;
        return true;
      }
      return false;
    }
    const caps = await getUserEffectiveCapabilities(userCid, userRole, module);
    return (caps.get(capability) || 0) >= minLevel;
  } catch {
    return false;
  }
}

export async function requireCapability(module, capability, minLevel = 1) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    const has = await hasCapability(
      session.cid,
      session.role,
      module,
      capability,
      minLevel,
    );
    if (!has)
      return NextResponse.json(
        { success: false, error: "Insufficient permissions." },
        { status: 403 },
      );
    return null;
  } catch {
    return NextResponse.json(
      { success: false, error: "Authorization system failure." },
      { status: 500 },
    );
  }
}

export async function logPermissionAudit({
  actorCid,
  actorName,
  targetCid,
  targetName,
  action,
  module,
  capability,
  previousValue,
  newValue,
  details,
}) {
  try {
    await initDb();
    await db.execute({
      sql: `INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, module, capability, previous_value, new_value, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        actorCid,
        actorName || null,
        targetCid,
        targetName || null,
        action,
        module || null,
        capability || null,
        previousValue || null,
        newValue || null,
        details || null,
      ],
    });
  } catch (e) {
    console.error("logPermissionAudit error:", e.message);
  }
}

export async function seedDefaultRoleCapabilities() {
  try {
    await initDb();
    const defaults = {
      super_admin: Object.fromEntries(
        Object.entries(PERMISSION_MODULES).map(([k, m]) => [
          k,
          Object.fromEntries(m.capabilities.map((c) => [c, 5])),
        ]),
      ),
      staff: {
        projects: { view: 1, create: 2, edit: 3 },
        programs: { view: 1 },
        reports: { view: 1, create: 2 },
        messaging: { view: 1, send: 2 },
        contacts: { view: 1 },
      },
      participant: {
        projects: { view: 1 },
        messaging: { view: 1, send: 2 },
      },
    };
    for (const [role, modules] of Object.entries(defaults)) {
      for (const [module, caps] of Object.entries(modules)) {
        for (const [capability, level] of Object.entries(caps)) {
          await db.execute({
            sql: `INSERT INTO role_capabilities (role, module, capability, access_level) VALUES (?, ?, ?, ?) ON CONFLICT (role, module, capability) DO UPDATE SET access_level = ?`,
            args: [role, module, capability, level, level],
          });
        }
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

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
  } catch (e) {
    console.error("getUserEffectiveProfile error:", e.message);
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
  } catch (e) {
    console.error("getAccessProfileCapabilities error:", e.message);
    return {};
  }
}

/**
 * Gets effective capabilities for a user using the Access Profile resolution chain.
 * Falls back to legacy role_capabilities if no profile is configured.
 * Returns a Map { capability -> access_level } for a specific module.
 */
export async function getUserEffectiveCapabilitiesV2(
  userCid,
  userRole,
  module,
) {
  try {
    await initDb();
    const profile = await getUserEffectiveProfile(userCid, userRole);

    let profileCaps = {};
    if (profile.profileId) {
      // Get capabilities from profile for this module
      const rows = await db.execute({
        sql: "SELECT capability, access_level FROM access_profile_capabilities WHERE profile_id = ? AND module = ?",
        args: [profile.profileId, module],
      });
      for (const row of rows.rows) {
        profileCaps[row.capability] = row.access_level;
      }
    } else {
      // Legacy fallback: use role_capabilities
      const rows = await db.execute({
        sql: "SELECT capability, access_level FROM role_capabilities WHERE role = ? AND module = ?",
        args: [userRole, module],
      });
      for (const row of rows.rows) {
        profileCaps[row.capability] = row.access_level;
      }
    }

    // Get group capabilities
    const groups = await getUserGroups(userCid);
    const groupCaps = {};
    if (groups.length > 0) {
      const ph = groups.map(() => "?").join(",");
      const groupRows = (
        await db.execute({
          sql: `SELECT capability, access_level FROM group_capabilities WHERE group_name IN (${ph}) AND module = ?`,
          args: [...groups, module],
        })
      ).rows;
      for (const row of groupRows) {
        groupCaps[row.capability] = row.access_level;
      }
    }

    // Get individual grants
    const grants = (
      await db.execute({
        sql: "SELECT capability, access_level FROM user_capabilities WHERE user_cid = ? AND module = ? AND (expires_at IS NULL OR expires_at > NOW())",
        args: [userCid, module],
      })
    ).rows;

    // Get individual restrictions
    const restricts = new Set(
      (
        await db.execute({
          sql: "SELECT capability FROM user_capability_restrictions WHERE user_cid = ? AND module = ? AND (expires_at IS NULL OR expires_at > NOW())",
          args: [userCid, module],
        })
      ).rows.map((r) => r.capability),
    );

    // Merge: Profile ∩ Groups ∩ Grants ∖ Restrictions
    const merged = new Map();
    const add = (cap, lvl) => {
      const e = merged.get(cap) || 0;
      if (lvl > e) merged.set(cap, lvl);
    };
    for (const [cap, lvl] of Object.entries(profileCaps)) add(cap, lvl);
    for (const [cap, lvl] of Object.entries(groupCaps)) add(cap, lvl);
    for (const row of grants) add(row.capability, row.access_level);
    for (const c of restricts) merged.delete(c);

    return merged;
  } catch (e) {
    console.error("getUserEffectiveCapabilitiesV2 error:", e.message);
    return new Map();
  }
}

/**
 * Gets the full permission matrix using V2 (Access Profile) resolution.
 */
export async function getUserFullPermissionMatrixV2(userCid, userRole) {
  const result = {};
  for (const mod of Object.keys(PERMISSION_MODULES)) {
    const caps = await getUserEffectiveCapabilitiesV2(userCid, userRole, mod);
    result[mod] = {};
    for (const [capability, level] of caps) result[mod][capability] = level;
  }
  return result;
}

/**
 * Checks capability using V2 resolution chain.
 * Super Admin bypass still works via restrictions check.
 */
export async function hasCapabilityV2(
  userCid,
  userRole,
  module,
  capability,
  minLevel = 1,
) {
  try {
    await initDb();
    if (userRole === "super_admin") {
      // Check if explicitly restricted
      const r = await db.execute({
        sql: "SELECT 1 FROM user_capability_restrictions WHERE user_cid = ? AND module = ? AND capability = ? AND (expires_at IS NULL OR expires_at > NOW())",
        args: [userCid, module, capability],
      });
      if (r.rows.length === 0) {
        // Check if explicitly granted (even super_admin can have limited grants)
        const g = await db.execute({
          sql: "SELECT access_level FROM user_capabilities WHERE user_cid = ? AND module = ? AND capability = ? AND (expires_at IS NULL OR expires_at > NOW())",
          args: [userCid, module, capability],
        });
        if (g.rows.length > 0)
          return parseInt(g.rows[0].access_level) >= minLevel;
        return true; // Super Admin default: yes
      }
      return false;
    }
    const caps = await getUserEffectiveCapabilitiesV2(
      userCid,
      userRole,
      module,
    );
    return (caps.get(capability) || 0) >= minLevel;
  } catch {
    return false;
  }
}

/**
 * Require capability using V2 resolution. Works as a drop-in replacement
 * for requireCapability() with the new profile system.
 */
export async function requireCapabilityV2(module, capability, minLevel = 1) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    const has = await hasCapabilityV2(
      session.cid,
      session.role,
      module,
      capability,
      minLevel,
    );
    if (!has)
      return NextResponse.json(
        { success: false, error: "Insufficient permissions." },
        { status: 403 },
      );
    return null;
  } catch {
    return NextResponse.json(
      { success: false, error: "Authorization system failure." },
      { status: 500 },
    );
  }
}

/**
 * Seed default access profiles and their capabilities.
 * Creates profiles for all common roles plus additional staff profiles.
 * Run once after migrations. Safe to re-run (upserts).
 */
export async function seedDefaultAccessProfiles() {
  try {
    await initDb();

    // ── Define profile definitions ──
    const profileDefs = {
      "Super Admin Default": {
        description: "Full system access — all modules, all capabilities",
        capabilities: Object.fromEntries(
          Object.entries(PERMISSION_MODULES).map(([k, m]) => [
            k,
            Object.fromEntries(m.capabilities.map((c) => [c, 5])),
          ]),
        ),
      },
      "Staff Default": {
        description: "Standard staff access — projects, messaging, reports",
        capabilities: {
          projects: { view: 1, create: 2, edit: 3 },
          programs: { view: 1 },
          reports: { view: 1, create: 2 },
          messaging: { view: 1, send: 2 },
          contacts: { view: 1 },
        },
      },
      "Participant Default": {
        description:
          "Participant access — own programs, assignments, messaging",
        capabilities: {
          projects: { view: 1 },
          messaging: { view: 1, send: 2 },
        },
      },
      Developer: {
        description: "Engineering access — tasks, standups, retros, projects",
        capabilities: {
          projects: { view: 1, create: 2, edit: 3 },
          engineering: { view: 1, manage_tasks: 2, manage_errors: 1 },
          reports: { view: 1 },
          messaging: { view: 1, send: 2 },
        },
      },
      "Developer Intern": {
        description:
          "Restricted engineering access — own tasks, standups, retros",
        capabilities: {
          projects: { view: 1 },
          engineering: { view: 1, manage_tasks: 1 },
          messaging: { view: 1, send: 2 },
        },
      },
      "Program Manager": {
        description: "Program management — programs, participants, reports",
        capabilities: {
          programs: { view: 1, create: 2, edit: 3, publish: 4 },
          projects: { view: 1 },
          reports: { view: 1, create: 2, export: 3 },
          messaging: { view: 1, send: 2 },
          contacts: { view: 1, create: 2 },
        },
      },
      "Project Owner": {
        description: "Project management — own projects, tasks, team reporting",
        capabilities: {
          projects: { view: 1, create: 2, edit: 3, delete: 4 },
          engineering: { view: 1, manage_tasks: 2 },
          reports: { view: 1, create: 2 },
          messaging: { view: 1, send: 2 },
        },
      },
      "Operations Manager": {
        description: "Operations — programs, finance, CRM, reports",
        capabilities: {
          programs: { view: 1, edit: 3 },
          projects: { view: 1 },
          finance: { view: 1, create: 2, edit: 3, export: 4 },
          contacts: { view: 1, create: 2, edit: 3 },
          reports: { view: 1, create: 2, export: 3 },
          messaging: { view: 1, send: 2 },
        },
      },
      Instructor: {
        description: "Program delivery — programs, grading, communication",
        capabilities: {
          programs: { view: 1, edit: 3 },
          projects: { view: 1 },
          messaging: { view: 1, send: 2 },
          contacts: { view: 1 },
        },
      },
      "Finance Assistant": {
        description: "Finance operations — view/create/edit finance data",
        capabilities: {
          finance: { view: 1, create: 2, edit: 3 },
          reports: { view: 1 },
        },
      },
      Mentor: {
        description: "Mentor access — participant progress, messaging",
        capabilities: {
          programs: { view: 1 },
          projects: { view: 1 },
          messaging: { view: 1, send: 2 },
        },
      },
    };

    // ── Create/update profiles and capabilities ──
    for (const [name, def] of Object.entries(profileDefs)) {
      // Upsert profile
      await db.execute({
        sql: `INSERT INTO access_profiles (name, description, is_active)
              VALUES (?, ?, 1)
              ON CONFLICT (name) DO UPDATE SET description = ?, is_active = 1`,
        args: [name, def.description, def.description],
      });

      // Get profile id
      const profile = await db.execute({
        sql: "SELECT id FROM access_profiles WHERE name = ?",
        args: [name],
      });
      if (profile.rows.length === 0) continue;
      const profileId = profile.rows[0].id;

      // Upsert capabilities
      for (const [module, caps] of Object.entries(def.capabilities)) {
        for (const [capability, level] of Object.entries(caps)) {
          await db.execute({
            sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT (profile_id, module, capability) DO UPDATE SET access_level = ?`,
            args: [profileId, module, capability, level, level],
          });
        }
      }
    }

    // ── Map roles to default profiles ──
    const roleDefaults = {
      super_admin: "Super Admin Default",
      staff: "Staff Default",
      participant: "Participant Default",
      developer: "Developer",
      program_manager: "Program Manager",
      teacher: "Instructor",
      admin: "Staff Default",
      investor: "Mentor",
      mentor: "Mentor",
    };

    for (const [role, profileName] of Object.entries(roleDefaults)) {
      const profile = await db.execute({
        sql: "SELECT id FROM access_profiles WHERE name = ?",
        args: [profileName],
      });
      if (profile.rows.length > 0) {
        await db.execute({
          sql: `INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
                VALUES (?, ?)
                ON CONFLICT (role_name) DO UPDATE SET access_profile_id = ?`,
          args: [role, profile.rows[0].id, profile.rows[0].id],
        });
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
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
    const result = await db.execute({
      sql: `SELECT r.id, r.name, r.key, r.description, r.icon
            FROM responsibilities r
            JOIN user_responsibilities ur ON ur.responsibility_id = r.id
            WHERE ur.user_cid = ? AND r.is_active = 1
            ORDER BY r.name`,
      args: [userCid],
    });
    return result.rows;
  } catch (e) {
    console.error("getUserResponsibilities error:", e.message);
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
    await db.execute({
      sql: `INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
            VALUES (?, ?, ?)
            ON CONFLICT (user_cid, responsibility_id) DO NOTHING`,
      args: [userCid, responsibilityId, assignedBy || null],
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Remove a responsibility from a user.
 */
export async function removeResponsibility(userCid, responsibilityId) {
  try {
    await initDb();
    await db.execute({
      sql: "DELETE FROM user_responsibilities WHERE user_cid = ? AND responsibility_id = ?",
      args: [userCid, responsibilityId],
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Get all available responsibilities (active).
 */
export async function getAllResponsibilities() {
  try {
    await initDb();
    const result = await db.execute({
      sql: "SELECT * FROM responsibilities WHERE is_active = 1 ORDER BY name",
    });
    return result.rows;
  } catch (e) {
    return [];
  }
}

/**
 * Seed default responsibilities.
 */
export async function seedDefaultResponsibilities() {
  try {
    await initDb();

    const defaults = [
      {
        name: "Engineering",
        key: "engineering",
        description:
          "Engineering operations — tasks, standups, retros, error logs",
        icon: "Wrench",
      },
      {
        name: "Program Management",
        key: "program_management",
        description: "Program oversight — programs, participants, submissions",
        icon: "Briefcase",
      },
      {
        name: "Project Ownership",
        key: "project_ownership",
        description: "Project management — projects, tasks, team reporting",
        icon: "Rocket",
      },
      {
        name: "Operations",
        key: "operations",
        description: "Internal operations — workspace, reports, CRM",
        icon: "Settings",
      },
      {
        name: "Communications",
        key: "communications",
        description: "Messaging, campaigns, contacts, forms",
        icon: "Send",
      },
      {
        name: "Finance",
        key: "finance",
        description: "Financial operations — budgets, reports",
        icon: "BarChart3",
      },
      {
        name: "Reporting",
        key: "reporting",
        description: "Reports and analytics",
        icon: "BarChart3",
      },
      {
        name: "Knowledge Base",
        key: "knowledge_base",
        description: "Knowledge management",
        icon: "Library",
      },
      {
        name: "Intelligence",
        key: "intelligence",
        description: "Business intelligence and trends",
        icon: "TrendingUp",
      },
      {
        name: "User Management",
        key: "user_management",
        description: "User administration — personnel, permissions",
        icon: "Users",
      },
      {
        name: "System Settings",
        key: "system_settings",
        description: "System configuration",
        icon: "Settings",
      },
    ];

    for (const resp of defaults) {
      await db.execute({
        sql: `INSERT INTO responsibilities (name, key, description, icon, is_active)
              VALUES (?, ?, ?, ?, 1)
              ON CONFLICT (key) DO UPDATE SET name = ?, description = ?, icon = ?`,
        args: [
          resp.name,
          resp.key,
          resp.description,
          resp.icon,
          resp.name,
          resp.description,
          resp.icon,
        ],
      });
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
