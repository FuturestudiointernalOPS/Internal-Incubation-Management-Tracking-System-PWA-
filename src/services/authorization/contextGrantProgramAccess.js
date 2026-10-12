/**
 * CONTEXT GRANT PROGRAM ACCESS (SERVICE layer).
 *
 * Phase E of docs/ROADMAP_ROLES_PROFILES_ACCESS.md, step 6 — "the business write
 * triggers the reconcile". Program-MANAGER changes already do this (see
 * `services/programs/programManager.js`); this module gives the FACILITATOR side
 * the same immediacy, so adding / editing / removing a facilitator on a program
 * applies (or withdraws) their program-derived access right away instead of
 * waiting for the next connect or the scheduled sweep.
 *
 * Scope is deliberately the FACILITATOR couple only. A program-staff write never
 * changes who is the assigned program manager — that lives on the program row and
 * is handled by `changeProgramManager` — so reconciling the manager couple here
 * would be a no-op with a cost.
 *
 * Best-effort by contract: the stored assignment is the source of truth and the
 * scheduled sweep re-derives from it, so a reconcile failure is REPORTED and
 * never thrown. Losing the recorded assignment over a grant hiccup would be the
 * worse outcome.
 *
 * No SQL, no HTTP. Reads and writes go through the reconcile, which goes through
 * `@/models/**`.
 */

import { syncContextGrantsForUser } from "./contextGrantReconcile";

/**
 * Reconcile one person's facilitator-derived access, now.
 *
 * @param {string} cid  the person's contact id (the grants are written to it)
 * @param {{email?: string|null}} [options]  the reference the staff row may hold
 *   instead of the cid (an address, in legacy rows) — passed so the tolerant
 *   assignment read still finds them.
 * @returns {Promise<{success: boolean, applied?: string[], revoked?: string[],
 *   profileRoleGap?: object|null, error?: string}>}
 */
export async function reconcileFacilitatorAccessForUser(cid, { email = null } = {}) {
  if (!cid) return { success: false, error: "cid is required" };
  try {
    const result = await syncContextGrantsForUser(cid, {
      context: "program",
      roleKey: "facilitator",
      email,
    });
    return {
      success: true,
      applied: result.applied || [],
      revoked: result.revoked || [],
      profileRoleGap: result.profileRoleGap || null,
      profileAssignments: result.profileAssignments || null,
    };
  } catch (error) {
    console.warn(
      `[Authz] reconcileFacilitatorAccessForUser(${cid}) failed:`,
      error.message,
    );
    return { success: false, error: error.message };
  }
}
