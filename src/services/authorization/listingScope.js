/**
 * Authorization — listing scope (SERVICE layer).
 *
 * A decision that recurs across every "list my X" endpoint: which callers may
 * look at somebody else's rows, and which are pinned to their own. The
 * portfolio roles may; everyone else may not, and asking for another person's
 * rows is refused rather than silently ignored.
 *
 * It lives here, in the authorization decision layer, because it is a "may
 * they?" question — and once, so the rule cannot drift between endpoints.
 *
 * Layer (see docs/LAYER_SPLIT.md): a pure decision — no SQL, no HTTP.
 */

import {
  INTERNAL_STAFF_ROLE,
  PLATFORM_OWNER_ROLE,
  PROGRAM_MANAGER_ROLE,
  isInternalStaffRole,
  isLegacyProgramManagerRole,
  isPlatformOwnerRole,
} from "@/lib/identity";

/** The roles that may see the whole portfolio, not just their own rows. */
export const PORTFOLIO_ROLES = [
  PLATFORM_OWNER_ROLE,
  INTERNAL_STAFF_ROLE,
  PROGRAM_MANAGER_ROLE,
];

/** May this role look at rows that are not its own? */
export function seesWholePortfolio(role) {
  return (
    isPlatformOwnerRole(role) ||
    isInternalStaffRole(role) ||
    isLegacyProgramManagerRole(role)
  );
}

/**
 * Resolve a caller's own-scope filter for a listing endpoint.
 *
 * @param {Object} args
 * @param {string} args.role             the caller's role
 * @param {string} args.sessionCid       the caller's own id
 * @param {string|null} args.requestedCid the id the caller asked for (or null)
 * @param {string} args.denialMessage    the refusal to return when refused
 * @returns {{cid?: string|null, denied?: string}}
 *   `cid` is the id to filter on — null means "no filter" for a portfolio
 *   caller; `denied` is set when a non-portfolio caller asked for someone else.
 */
export function resolveListingScope({
  role,
  sessionCid,
  requestedCid,
  denialMessage,
}) {
  if (seesWholePortfolio(role)) {
    return { cid: requestedCid };
  }
  if (requestedCid && String(requestedCid) !== String(sessionCid)) {
    return { denied: denialMessage };
  }
  return { cid: requestedCid || sessionCid };
}
