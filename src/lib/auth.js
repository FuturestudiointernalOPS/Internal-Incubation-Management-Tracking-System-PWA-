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
