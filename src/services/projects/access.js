/**
 * Projects — object-level WRITE access (SERVICE layer).
 *
 * The role half of the rule every project mutation asks before it touches a row:
 *
 *     "does this caller's role reach projects it is not a member of?"
 *
 * A project mutation needs TWO answers, and only one of them is a decision:
 *
 *     role half      — portfolio roles (super_admin / program_manager) see the
 *                      whole portfolio, so they skip the per-project check;
 *                      everyone else needs one.
 *     object half    — is this caller the owner or a member of THIS project?
 *                      That is the shared project-access guard, an HTTP concern
 *                      the route already runs (`requireProjectAccess`, backed by
 *                      `@/services/authorization/resourceGuards`). It is NOT
 *                      re-implemented here — one implementation, so the gate and
 *                      any endpoint asking the same question cannot disagree.
 *
 * This composition was re-typed by hand in five verbs across `/api/projects` and
 * `/api/projects/members`, which is how a global capability ended up reaching
 * somebody else's project on the verbs that forgot the role half.
 *
 * Layer (see docs/LAYER_SPLIT.md): a decision, no SQL, no HTTP.
 */

import { seesWholeProjectPortfolio } from "./workspace";

/**
 * Must this role pass the per-project object check before changing `projectId`?
 *
 * `true` for everyone outside the portfolio roles — which is the safe answer:
 * a caller who fails the object check is refused by the guard.
 *
 * @param {{ role?: string|null }} params
 * @returns {boolean}
 */
export function needsProjectObjectCheck({ role }) {
  return !seesWholeProjectPortfolio(role);
}