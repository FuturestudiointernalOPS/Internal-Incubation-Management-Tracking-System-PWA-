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
 * Returns { session } on allow, or { error: NextResponse } on deny.
 */
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
    if (!session) {
      return {
        error: denied(
          { success: false, error: "errors.authRequired" },
          401,
          "unauthenticated",
        ),
      };
    }

    // Super Admin — resolver semantics (no per-record scope).
    const ctx = await getAuthorizationContext(session);
    if (ctx?.isSuperAdmin) return { session, path: "super-admin" };

    // CAPABILITY — the resolver decides (eligibility, profile, grants…).
    const capError = await requireAuthorization(module, capability, minLevel);
    if (capError) {
      return {
        error: denied(
          {
            success: false,
            error: "errors.insufficientPermissions",
            missing: { capability: `${module}.${capability}` },
          },
          403,
          "capability-missing",
        ),
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
        error: denied(
          {
            success: false,
            error: "errors.insufficientPermissions",
            missing: { capability: `${module}.${capability}`, scope: "venture_own" },
          },
          403,
          "out-of-scope",
        ),
      };
    }

    return { session, path: "capability+scope" };
  } catch (e) {
    console.error("[requireVentureScopedAccess] error:", e?.message);
    return {
      error: denied(
        { success: false, error: "errors.authzSystemFailure" },
        500,
        "system-failure",
      ),
    };
  }
}
