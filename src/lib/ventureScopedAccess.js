import { NextResponse } from "next/server";
import { getSession, requireAuth } from "@/lib/auth";
import { getAuthorizationContext, requireAuthorization } from "@/lib/authorization";
import { isWithinScope, resolveVentureScopeId } from "@/lib/authorization/scope";
import { requireVentureAccess } from "@/lib/ventureAuth";

/**
 * PHASE 5b — VENTURE SCOPED ACCESS (pilot gate for venture surfaces).
 *
 * One canonical decision path for routes that protect a SPECIFIC venture:
 *
 *     Super Admin bypass (resolver semantics — unscoped authority)
 *       → CAPABILITY (resolver: eligibility + profile/grants/restrictions)
 *       → SCOPE (venture_own — the venture is "theirs": active membership OR
 *                active delegated staff assignment, read live from data)
 *       → ALLOW
 *
 * TRANSITIONAL LEGACY FALLBACK (pilot only — MUST be removed):
 *   While the capability grants + founder profile catch up, an actor who
 *   fails the new path may still pass the ORIGINAL gates (role array +
 *   requireVentureAccess). This preserves exact behavior for every holder the
 *   legacy arrays admit today (participant, founder via derived role, teacher,
 *   developer, admin) and — critically — preserves the original response
 *   semantics: a role-array denial still returns that 403/401, a membership
 *   denial still returns 404 (existence is never leaked as 403).
 *
 *   Removal trigger (see docs/PHASE5B_VENTURE_PILOT.md): once the registry's
 *   founder mapping + profile grants are live and the fallback counters show
 *   no traffic on staging for a full cycle.
 *
 * Returns { session, path } on allow, or { error: NextResponse } on deny.
 *
 * Every decision also sets an `X-Authz-Decision` header (visible in the
 * network tab / logs), so "what is working and what is not" is diagnosable
 * instead of silent:
 *
 *   super-admin | capability+scope | legacy-fallback
 *   capability-missing | out-of-scope | legacy-role-denied | legacy-not-a-member
 *
 * STRICT MODE (staging verification): set AUTHZ_VENTURE_STRICT=1 and the
 * transitional legacy fallback is DISABLED — the route is then decided by the
 * new system alone (capability + scope), and every denial answers with the
 * exact missing capability/scope plus the `capability-or-scope-denied`
 * decision header. That is how you prove a route really runs on the new system
 * instead of silently falling back. Default: off (parity behaviour unchanged).
 */

/** Read at call time so a single env change (or a test) takes effect at once. */
export function isVentureStrictMode() {
  return process.env.AUTHZ_VENTURE_STRICT === "1";
}
export async function requireVentureScopedAccess({
  db,
  ventureId,
  module,
  capability,
  minLevel = 1,
  legacyRoles = [],
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

    // Super Admin — existing resolver semantics (no per-record scope).
    const ctx = await getAuthorizationContext(session);
    if (ctx?.isSuperAdmin) return { session, path: "super-admin" };

    // NEW PATH — capability (cached context) + scope (live assignment data).
    // Wrapped so a failure HERE can never break a route that works today:
    // outside strict mode we simply move on to the legacy gate.
    try {
      const capError = await requireAuthorization(module, capability, minLevel);
      if (!capError) {
        const scopeId = await resolveVentureScopeId(ventureId);
        if (
          scopeId &&
          (await isWithinScope("venture_own", session.cid, scopeId, {
            email: session.email,
          }))
        ) {
          return { session, path: "capability+scope" };
        }
      }
    } catch (e) {
      console.warn(
        "[VentureScope] new-path error — deferring to the legacy gate:",
        e?.message,
      );
    }

    // LEGACY FALLBACK — exact prior behavior (remove after parity proof).
    if (isVentureStrictMode()) {
      console.warn(
        `[VentureScope][STRICT] denied ${module}.${capability} on venture ${ventureId} — capability or scope missing; legacy fallback disabled`,
      );
      return {
        error: denied(
          {
            success: false,
            error: "errors.insufficientPermissions",
            missing: { capability: `${module}.${capability}`, scope: "venture_own" },
            strict: true,
          },
          403,
          "capability-or-scope-denied",
        ),
      };
    }
    const legacyError = await requireAuth(legacyRoles);
    if (legacyError) {
      return {
        error: denied(
          {
            success: false,
            error: "errors.insufficientPermissions",
            missing: { capability: `${module}.${capability}` },
          },
          legacyError.status || 403,
          "legacy-role-denied",
        ),
      };
    }
    const { session: legacySession, ventureId: resolved } = await requireVentureAccess(
      ventureId,
      db,
    );
    if (!legacySession) {
      return {
        error: denied(
          {
            success: false,
            error: "errors.notFound",
            missing: {
              capability: `${module}.${capability}`,
              scope: "venture_own",
            },
          },
          404,
          "legacy-not-a-member",
        ),
      };
    }
    console.warn(
      `[VentureScope] legacy fallback used (${module}.${capability}, venture=${resolved ?? ventureId}) — remove when grants land`,
    );
    return { session: legacySession, path: "legacy-fallback" };
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
