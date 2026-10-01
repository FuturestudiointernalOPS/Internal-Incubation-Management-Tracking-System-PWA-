/**
 * ONE-CALL AUTHORIZATION HELPERS (SERVICE layer).
 *
 * The convenience surface over cache + decision: `can()` for server components
 * and helpers, `evaluateAuthorization()` for route guards.
 *
 * The two differ in failure behaviour, and the difference is the whole point of
 * having both:
 *
 *   - `can()` FAILS CLOSED. Any error is logged and answered `false`, because
 *     its callers are rendering a control and there is nothing better to show
 *     than a hidden one.
 *   - `evaluateAuthorization()` FAILS OPEN TO AN ERROR. A database blip
 *     returns `{allowed:false, status:500}`, never a silent 403, so a transient
 *     outage cannot masquerade as a mass denial of real permissions.
 *
 * It returns a DECISION, never a response: the 401/403/500 is built by the HTTP
 * boundary in `@/server/authz/responses`. The denial log records who was refused,
 * what they tried and why as an enum — never the payload they sent, which is
 * where business data lives.
 *
 * Split out of `context.js` (560 lines). Behaviour identical.
 */

import { logger } from "@/lib/logger";
import { getSession } from "@/server/auth/session";
import { getAuthorizationContext } from "./contextCache";
import { authorize } from "./contextDecisions";

/**
 * Convenience: resolve + check in one call (for server components / helpers).
 * Fails closed on any error.
 */
export async function can(user, module, capability, minLevel = 1) {
  try {
    const ctx = await getAuthorizationContext(user);
    return authorize(ctx, module, capability, minLevel);
  } catch (error) {
    console.error("[Authorization] can() error:", error.message);
    return false;
  }
}

/**
 * Route helper — the same 401/403/500 shapes as before, without building the
 * HTTP answer. Returns a decision the HTTP boundary turns into a response
 * (`@/server/authz/responses.requireAuthorization`).
 * DB failures surface as a system failure (fail-open-to-error) instead of
 * silently denying, avoiding spurious mass-denial during transient database
 * issues.
 *
 * @returns {Promise<{allowed: boolean, status: number, errorKey: string|null}>}
 */
export async function evaluateAuthorization(module, capability, minLevel = 1) {
  try {
    const session = await getSession();
    if (!session) {
      logger.debug("authorization_unauthenticated", {
        resourceType: module,
        action: capability,
      });
      return { allowed: false, status: 401, errorKey: "errors.authRequired" };
    }
    const ctx = await getAuthorizationContext(session);
    if (!authorize(ctx, module, capability, minLevel)) {
      // A denial is the security signal worth counting. It records WHO was
      // refused, WHAT they tried and WHY as an enum — never the payload they
      // sent, which is where business data lives.
      logger.warn("authorization_denied", {
        userId: session.cid,
        role: session.role,
        resourceType: module,
        action: capability,
        minLevel,
        reason: "missing_permission",
      });
      return {
        allowed: false,
        status: 403,
        errorKey: "errors.insufficientPermissions",
      };
    }
    return { allowed: true, status: 200, errorKey: null };
  } catch (error) {
    logger.error("authorization_error", {
      resourceType: module,
      action: capability,
      error: error.message,
    });
    return {
      allowed: false,
      status: 500,
      errorKey: "errors.authzSystemFailure",
    };
  }
}
