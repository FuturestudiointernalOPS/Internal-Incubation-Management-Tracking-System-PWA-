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
 */
export async function requireVentureScopedAccess({
  db,
  ventureId,
  module,
  capability,
  minLevel = 1,
  legacyRoles = [],
}) {
  try {
    const session = await getSession();
    if (!session) {
      return {
        error: NextResponse.json(
          { success: false, error: "errors.authRequired" },
          { status: 401 },
        ),
      };
    }

    // Super Admin — existing resolver semantics (no per-record scope).
    const ctx = await getAuthorizationContext(session);
    if (ctx?.isSuperAdmin) return { session, path: "super-admin" };

    // NEW PATH — capability (cached context) + scope (live assignment data).
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

    // LEGACY FALLBACK — exact prior behavior (remove after parity proof).
    const legacyError = await requireAuth(legacyRoles);
    if (legacyError) return { error: legacyError };
    const { session: legacySession, ventureId: resolved } = await requireVentureAccess(
      ventureId,
      db,
    );
    if (!legacySession) {
      return {
        error: NextResponse.json(
          { success: false, error: "errors.notFound" },
          { status: 404 },
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
      error: NextResponse.json(
        { success: false, error: "errors.authzSystemFailure" },
        { status: 500 },
      ),
    };
  }
}
