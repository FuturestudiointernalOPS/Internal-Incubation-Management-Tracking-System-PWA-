import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthorizationContext, requireAuthorization } from "@/lib/authorization";
import { isWithinScope, resolveVentureScopeId } from "@/lib/authorization/scope";

/**
 * PHASE 5c — VENTURE SCOPED ACCESS (the only venture gate).
 *
 * One decision path for routes that protect a SPECIFIC venture:
 *
 *     Super Admin bypass (resolver semantics — unscoped authority)
 *       → CAPABILITY (resolver: eligibility + profile/grants/restrictions)
 *       → SCOPE (venture_own — the venture is "theirs": active membership OR
 *                active delegated staff assignment, read live from data)
 *       → ALLOW
 *
 * There is NO fallback to the legacy role arrays: the old gate is gone by
 * design. A denial is explicit and diagnosable —
 *
 *   HTTP 403
 *   X-Authz-Decision: capability-missing | out-of-scope | capability-or-scope-denied
 *   { success: false, error: "errors.insufficientPermissions",
 *     missing: { capability: "ventures.view", scope: "venture_own" } }
 *
 * — so "what is working and what is not" is answered by the response itself.
 * Use scripts/authz-venture-coverage.mjs for the census and
 * GET /api/engineering/permissions/venture-strict-audit for the per-person
 * "who would lose access, and which key are they missing" report.
 *
 * The DECISION and the HTTP SHAPE are split on purpose:
 *
 *   resolveVentureScopedDecision(...)   → the verdict (no HTTP)
 *   requireVentureScopedAccess(...)     → the guard (verdict + response)
 *
 * GET /api/ventures/[id]/my-access reads the SAME verdict function, so the UI
 * cannot be told something the gate would refuse. Keeping one implementation is
 * the whole point: two would drift, and a UI that lies is worse than no UI.
 *
 * Returns { session } on allow, or { error: NextResponse } on deny.
 */

/**
 * The verdict, with no HTTP attached.
 *
 * Returned decisions mirror the X-Authz-Decision header values exactly, so a
 * caller can surface the same vocabulary the routes already emit:
 *   unauthenticated | super-admin | capability+scope
 *   capability-missing | out-of-scope
 * (Throw rather than return for infrastructure failure — the callers below
 * translate that into `system-failure`, so a broken resolver is never a silent
 * allow.)
 *
 * The caller passes the session, so the read endpoint and the guard cannot
 * disagree about WHO is asking.
 */
export async function resolveVentureScopedDecision({
  session,
  ventureId,
  module,
  capability,
  minLevel = 1,
}) {
  if (!session) return { allowed: false, decision: "unauthenticated" };

  // Super Admin — resolver semantics (no per-record scope).
  const authContext = await getAuthorizationContext(session);
  if (authContext?.isSuperAdmin) {
    return { allowed: true, path: "super-admin", decision: "super-admin" };
  }

  // CAPABILITY — the resolver decides (eligibility, profile, grants…).
  const capError = await requireAuthorization(module, capability, minLevel);
  if (capError) {
    return {
      allowed: false,
      decision: "capability-missing",
      missing: { capability: `${module}.${capability}` },
    };
  }

  // SCOPE — the record must actually be theirs (live assignment data).
  const scopeId = await resolveVentureScopeId(ventureId);
  const within =
    Boolean(scopeId) &&
    (await isWithinScope("venture_own", session.cid, scopeId, {
      email: session.email,
    }));
  if (!within) {
    return {
      allowed: false,
      decision: "out-of-scope",
      missing: { capability: `${module}.${capability}`, scope: "venture_own" },
    };
  }

  return { allowed: true, path: "capability+scope", decision: "capability+scope" };
}

export async function requireVentureScopedAccess({
  ventureId,
  module,
  capability,
  minLevel = 1,
}) {
  const denied = (body, status, decision) => {
    const res = NextResponse.json(body, { status });
    res.headers.set("X-Authz-Decision", decision);
    return res;
  };

  try {
    const session = await getSession();
    const verdict = await resolveVentureScopedDecision({
      session,
      ventureId,
      module,
      capability,
      minLevel,
    });

    if (verdict.allowed) return { session, path: verdict.path };

    switch (verdict.decision) {
      case "unauthenticated":
        return {
          error: denied(
            { success: false, error: "errors.authRequired" },
            401,
            "unauthenticated",
          ),
        };
      case "capability-missing":
        return {
          error: denied(
            {
              success: false,
              error: "errors.insufficientPermissions",
              missing: verdict.missing,
            },
            403,
            "capability-missing",
          ),
        };
      case "out-of-scope":
        return {
          error: denied(
            {
              success: false,
              error: "errors.insufficientPermissions",
              missing: verdict.missing,
            },
            403,
            "out-of-scope",
          ),
        };
      default:
        // An unrecognised verdict is a bug, not a permission: fail closed.
        return {
          error: denied(
            { success: false, error: "errors.authzSystemFailure" },
            500,
            "system-failure",
          ),
        };
    }
  } catch (error) {
    console.error("[requireVentureScopedAccess] error:", error?.message);
    return {
      error: denied(
        { success: false, error: "errors.authzSystemFailure" },
        500,
        "system-failure",
      ),
    };
  }
}
