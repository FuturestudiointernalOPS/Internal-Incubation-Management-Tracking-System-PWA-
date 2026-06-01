import db, { initDb } from "@/lib/db";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";

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

    // Verify user is still active
    if (session.status !== "active" && session.role !== "super_admin") {
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
