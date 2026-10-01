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