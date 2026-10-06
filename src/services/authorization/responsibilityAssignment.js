/**
 * RESPONSIBILITY ASSIGNMENT DECISIONS (SERVICE layer).
 *
 * A responsibility carries "base module access" — the `view` grants that make
 * its area reachable — and that coupling is what made the two branches of
 * `src/app/api/responsibilities/assign/route.js` delicate. The rules move here;
 * the route keeps the HTTP shaping.
 *
 * Rules, unchanged:
 *   - Separation of duties: nobody changes their OWN responsibilities, not even a
 *     Super Admin. Self-granting a responsibility (and its base module access) is
 *     the escalation this refuses.
 *   - Base access is BEST-EFFORT. A grant/revoke failure is swallowed and only
 *     logged: it must never fail the assignment. The worst case is an area left
 *     without module access — exactly the behaviour that existed before.
 *   - Revoking is symmetric with granting: it reclaims only the grants THIS
 *     responsibility created (its ledger), so a capability held for another
 *     reason is never taken away.
 *   - A responsibility without a `key` gets no base access at all: there is no
 *     module mapping to apply.
 *
 * Every statement is in `@/models/responsibilities` (the repository); nothing
 * here runs SQL and nothing here builds a Response.
 */

import {
  grantResponsibilityBaseAccess,
  revokeResponsibilityBaseAccess,
} from "@/models/responsibilities";

/**
 * Separation of duties.
 *
 * @param {{cid?: string}|null|undefined} session
 * @param {string} userCid
 * @returns {boolean} true when the caller targets their OWN responsibilities
 */
export function isSelfResponsibilityChange(session, userCid) {
  if (!session?.cid || !userCid) return false;
  return String(session.cid) === String(userCid);
}

/**
 * Grants the base `view` access a responsibility needs so its area loads.
 * Best-effort by contract: a failure is logged and reported as "no modules
 * granted", never propagated.
 *
 * @returns {Promise<string[]>} the modules this call actually created
 */
export async function grantBaseAccessForResponsibility({
  userCid,
  responsibilityKey,
  grantedBy = null,
}) {
  if (!responsibilityKey) return [];
  try {
    const granted = await grantResponsibilityBaseAccess({
      userCid,
      responsibilityKey,
      grantedBy,
    });
    return granted || [];
  } catch (error) {
    console.error(
      "[Responsibilities Assign] base access grant failed:",
      error.message,
    );
    return [];
  }
}

/**
 * Revokes exactly the base grants this responsibility created. Best-effort by
 * contract, symmetric with the grant path.
 *
 * @returns {Promise<string[]>} the modules reclaimed
 */
export async function revokeBaseAccessForResponsibility({
  userCid,
  responsibilityKey,
}) {
  if (!responsibilityKey) return [];
  try {
    const revoked = await revokeResponsibilityBaseAccess({ userCid, responsibilityKey });
    return revoked || [];
  } catch (error) {
    console.error(
      "[Responsibilities Assign] base access revoke failed:",
      error.message,
    );
    return [];
  }
}

/**
 * Builds the human note appended to the audit entry AND the response message.
 * Empty when nothing was granted/revoked — an absent note, never a dangling
 * separator.
 *
 * @param {"granted"|"revoked"} verb
 * @param {string[]} modules
 * @returns {string} e.g. ". Base access granted: projects, programs"
 */
export function formatBaseAccessNote(verb, modules) {
  if (!modules || modules.length === 0) return "";
  return `. Base access ${verb}: ${modules.join(", ")}`;
}