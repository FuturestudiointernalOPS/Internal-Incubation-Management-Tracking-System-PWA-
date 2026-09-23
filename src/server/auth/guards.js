/**
 * server/auth — guards.
 *
 * The two questions every endpoint asks before doing any work:
 *
 *   requireSession(allowedRoles?)  → the session, or it throws
 *   requireAuth(allowedRoles?, session?) → null, or the error response to return
 *
 * Both answer WHO is calling (and, coarsely, whether the account's role is
 * admitted to this endpoint at all). Neither answers WHAT they may do to a
 * particular resource: capability, scope and ownership decisions belong to the
 * authorization layer, which runs after this one.
 *
 * `allowedRoles` is the coarse gate the codebase grew up with — 247 endpoints
 * rely on it. Narrowing it to a capability check is an authorization change, not
 * an authentication one.
 */

import { NextResponse } from "next/server";
import { getSession } from "./session";

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
export async function requireAuth(allowedRoles = null, providedSession = undefined) {
  try {
    // A caller that already resolved the session (createHandler does) passes it
    // in, so the guard does not issue a second getSession() — that keeps the
    // number of reads identical to before and lets the wrapper attach it.
    const session =
      providedSession === undefined ? await getSession() : providedSession;
    if (!session) throw new Error("Unauthorized");
    if (allowedRoles && !allowedRoles.includes(session.role)) {
      throw new Error("Forbidden");
    }
    return null; // authorized
  } catch (err) {
    if (err.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );
    }
    if (err.message === "Forbidden") {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { success: false, error: "errors.authSystemFailure" },
      { status: 500 },
    );
  }
}
