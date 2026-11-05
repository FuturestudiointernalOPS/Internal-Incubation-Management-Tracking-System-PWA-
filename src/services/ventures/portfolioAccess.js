/**
 * THE PORTFOLIO PERIMETER — "may this person reach EVERY Venture?"
 *
 * `ventures.view` and `ventures.edit` answer WHAT the caller may do. The
 * `venture_own` scope answers WHICH records: the Ventures they belong to or are
 * assigned to. Until now, a Super Admin skipped both questions through the
 * resolver bypass, so seeing and acting on the whole portfolio was a property of
 * the ROLE rather than a right an administrator could hand out or take away.
 *
 * This module makes that perimeter explicit:
 *
 *   ventures.view_all  → read any Venture (the directory, the workspace reads,
 *                        the portfolio roll-up)
 *   ventures.edit_all  → write any Venture (the workspace writes)
 *
 * Two properties are deliberate:
 *
 *   1. The decision is read from the EFFECTIVE capability matrix, never from
 *      the role string. A Super Admin is allowed by default because their
 *      default profile holds the rights, not because of who they are; removing
 *      the right from that profile (or restricting it on the person) removes
 *      the access. A staff member can be granted the same rights.
 *
 *   2. Only an INTERNAL identity can hold the perimeter. A Venture member may
 *      be granted anything else, but the portfolio views are staff surfaces:
 *      the API refuses them here, not only in the sidebar.
 *
 * The routes keep their action check (`view`/`edit`) — this module only answers
 * the perimeter question. No SQL here; the context comes from the resolver.
 */

import { getAuthorizationContext } from "@/models/authorization/index";
import {
  isInternalStaffRole,
  isLegacyProgramManagerRole,
  isPlatformOwnerRole,
} from "@/lib/identity";

/** The perimeter right that pairs with each Venture action. */
export const PORTFOLIO_CAPABILITY_BY_ACTION = {
  view: "view_all",
  edit: "edit_all",
};

/** The perimeter right for an action, or null when the action has none. */
export function portfolioCapabilityFor(action) {
  return PORTFOLIO_CAPABILITY_BY_ACTION[action] || null;
}

/** Staff surfaces only: a member never holds the portfolio perimeter. */
export function isInternalVentureIdentity(role) {
  return (
    isPlatformOwnerRole(role) ||
    isInternalStaffRole(role) ||
    isLegacyProgramManagerRole(role)
  );
}

/**
 * True when the effective matrix holds the capability AND no restriction
 * removes it. Reads the matrix directly on purpose: `authorize()` preserves the
 * Super Admin bypass, which is exactly the shortcut this perimeter replaces.
 */
export function holdsExplicitCapability(ctx, module, capability, minLevel = 1) {
  if (!ctx || !module || !capability) return false;
  if (ctx.restrictions?.[module]?.has?.(capability)) return false;
  return Number(ctx.effective?.[module]?.[capability] ?? 0) >= minLevel;
}

/** True when this context may reach every Venture for the given action. */
export function holdsVenturePortfolioRight(ctx, action) {
  const capability = portfolioCapabilityFor(action);
  if (!capability) return false;
  if (!isInternalVentureIdentity(ctx?.role)) return false;
  return holdsExplicitCapability(ctx, "ventures", capability, 1);
}

/**
 * The perimeter verdict for one action, resolved from the session.
 *
 * @param {{session: object, action: "view"|"edit", ctx?: object}} args
 * @returns {Promise<{allowed: boolean, capability: string|null, reason: string}>}
 */
export async function resolveVenturePortfolioAccess({ session, action, ctx = null }) {
  const capability = portfolioCapabilityFor(action);
  if (!session?.cid) {
    return { allowed: false, capability, reason: "unauthenticated" };
  }
  if (!capability) {
    return { allowed: false, capability: null, reason: "unknown-action" };
  }

  let resolved = ctx;
  if (!resolved) {
    try {
      resolved = await getAuthorizationContext(session);
    } catch (_) {
      return { allowed: false, capability, reason: "system-failure" };
    }
  }

  if (!isInternalVentureIdentity(resolved?.role || session.role)) {
    return { allowed: false, capability, reason: "not-internal" };
  }
  if (!holdsExplicitCapability(resolved, "ventures", capability, 1)) {
    return { allowed: false, capability, reason: "capability-missing" };
  }
  return { allowed: true, capability, reason: "portfolio" };
}
