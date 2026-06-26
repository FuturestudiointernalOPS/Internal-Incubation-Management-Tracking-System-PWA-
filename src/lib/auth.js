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
