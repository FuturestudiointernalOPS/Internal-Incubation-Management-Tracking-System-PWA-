/**
 * USER CONTEXT PROJECTION (SERVICE layer).
 *
 * `src/app/api/engineering/permissions/user-context/route.js` shaped the
 * administrator's read-only view of ONE person's authorization context. That
 * projection is a decision — it decides which resolver output the
 * administrator is allowed to see, and under which names — so it lives here.
 *
 * Rules, unchanged:
 *   - The payload is a PURE PROJECTION of `resolveAuthorizationContext`, called
 *     unchanged: no authorization semantics are modified on this screen.
 *   - The five source columns are Profile | Group | Grant | Restriction |
 *     Effective, and they map onto the resolver's OWN inputs (baseCaps,
 *     groupCaps, grants, restrictions, effective). Renaming them here would
 *     silently change what the screen claims to show.
 *   - `restrictions` always goes through `restrictionsToJson`. A raw Set
 *     serializes to `{}` over JSON, which would report "no restrictions" to
 *     the administrator — the exact opposite of the truth.
 *   - `scope` is a fixed NOTE, never a second verdict: the list is produced by
 *     the same data-layer predicates the scope engine enforces from, so the
 *     screen can say where each relationship sits without inventing a
 *     decision here.
 *   - `contexts` and `contextsUnavailable` ride through as-is. The UI has to
 *     be able to tell "no memberships" from "the lookup failed"; flattening
 *     the second into the first is a lie.
 */

import { restrictionsToJson } from "./context";
import { explainAuthorization } from "./contextDecisions";
import { PERMISSION_MODULES } from "@/server/authz/capabilities";

/**
 * Which resolver inputs feed the Permission Center's source columns.
 *
 * Kept as data: the mapping is the decision, and having it in one place is
 * what makes it checkable against the resolver.
 */
const SOURCE_COLUMNS = [
  ["profile", "baseCaps"],
  ["groups", "groupCaps"],
  ["grants", "grants"],
];

/** The fixed note the screen shows about the scope engine's state. */
export const SCOPE_ENGINE_NOTE =
  "venture_own · program_assigned · learning_own (team_own pending)";

/**
 * The ENGINE's own verdict for every catalogue capability (spec §12.4).
 *
 * The screen must show the reason the ENGINE returns — including the reason for
 * a refusal — and never a value computed apart. This runs the very
 * `explainAuthorization` the route guards use, so the boolean and the reason the
 * administrator reads are exactly the decision that was enforced.
 *
 * @param {object} authorizationContext as returned by resolveAuthorizationContext
 * @returns {{[module: string]: {[capability: string]: {allowed: boolean, reason: string}}}}
 */
export function buildContextDecisions(authorizationContext) {
  const decisions = {};
  for (const [module, definition] of Object.entries(PERMISSION_MODULES)) {
    decisions[module] = {};
    for (const capability of definition.capabilities) {
      const decision = explainAuthorization(authorizationContext, module, capability, 1);
      decisions[module][capability] = {
        allowed: decision.allowed,
        reason: decision.reason,
      };
    }
  }
  return decisions;
}

/**
 * The read-only projection of one person's authorization context.
 *
 * @param {string} cid
 * @param {object} authorizationContext as returned by resolveAuthorizationContext
 * @param {{contexts: Array, unavailable: Array}} contextData the contextual
 *   relationship read, including which kinds could not be read
 * @returns {object} the JSON payload
 */
export function projectUserContext(cid, authorizationContext, contextData) {
  const sources = {};
  for (const [column, resolverKey] of SOURCE_COLUMNS) {
    sources[column] = authorizationContext[resolverKey];
  }
  sources.restrictions = restrictionsToJson(authorizationContext.restrictions);

  return {
    success: true,
    cid,
    role: authorizationContext.role,
    isSuperAdmin: authorizationContext.isSuperAdmin,
    profile: authorizationContext.profile,
    groups: authorizationContext.groups,
    eligibility: authorizationContext.eligibility,
    sources,
    effective: authorizationContext.effective,
    // §12.4 — the engine's own verdict + reason per capability, so the screen
    // displays the ENFORCED reason (refusals included), not a re-derivation.
    decisions: buildContextDecisions(authorizationContext),
    contexts: contextData.contexts,
    contextsUnavailable: contextData.unavailable,
    scope: {
      engine: "implemented",
      note: SCOPE_ENGINE_NOTE,
    },
  };
}

/**
 * The identity handed to the resolver.
 *
 * A contact with no role or group feeds NULLS, not `undefined`: the resolver
 * reads the difference between "no role" and "key absent", and an undefined key
 * is not the same statement.
 *
 * @param {{cid: string, role?: string, group_name?: string}} contact
 * @returns {{cid: string, role: string|null, group_name: string|null}}
 */
export function toResolverIdentity(contact) {
  return {
    cid: contact.cid,
    role: contact.role || null,
    group_name: contact.group_name || null,
  };
}