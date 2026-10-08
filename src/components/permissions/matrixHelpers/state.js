/**
 * Permission Center matrix helpers — effective capability state.
 *
 * Derives what a user/profile effectively holds for a module capability from
 * the source layers (profile/group/grant → effective, minus restrictions) and
 * explains denials. Pure: no React, no DB.
 */

/**
 * Levels of the capabilities a user/profile holds for a module, derived from
 * a capabilities matrix ({module: {cap: level}}).
 *
 * @returns {{ held: string[], heldCount: number, accessible: boolean }}
 */
export function deriveModuleCaps(capsMatrix, module) {
  const held = [];
  for (const [cap, level] of Object.entries(capsMatrix?.[module] || {})) {
    if (Number(level) > 0) held.push(cap);
  }
  held.sort();
  return { held, heldCount: held.length, accessible: held.length > 0 };
}

/**
 * Effective capability state for one module capability across the source
 * layers of the authorization model (profile/group/grant → effective).
 *
 * Mirrors `authorize()`: eligibility is the OUTER gate and is checked first,
 * then the merged sources minus restrictions. Restrictions REMOVE the
 * capability entirely (resolver semantics), so a restriction beats every
 * source. `eligible` defaults to true so callers that do not know about
 * eligibility keep the previous semantics; Super Admin must pass true (its
 * eligibility is bypassed server-side).
 *
 * @param {boolean} [eligible]  feature eligibility for the person (outer gate)
 * @returns {{profile:boolean, group:boolean, grant:boolean,
 *            restricted:boolean, eligible:boolean, effective:boolean,
 *            reason:"not-eligible"|"restriction"|null}}
 */
export function deriveUserCapState(sources, module, capability, eligible = true) {
  const has = (layer) => Number(sources?.[layer]?.[module]?.[capability] ?? 0) > 0;
  const profile = has("profile");
  const group = has("groups");
  const grant = has("grants");
  const restricted = Boolean(sources?.restrictions?.[module]?.has?.(capability))
    || Boolean(sources?.restrictions?.[module]?.[capability]);
  const effective = eligible && (profile || group || grant) && !restricted;
  return {
    profile,
    group,
    grant,
    restricted,
    eligible,
    effective,
    reason: !eligible ? "not-eligible" : restricted ? "restriction" : null,
  };
}

/**
 * Why a capability is denied (UI-2). Returns a machine reason the UI maps to
 * localized copy. The order mirrors authorize(): ineligibility is the outer
 * gate, a restriction is next, and otherwise the capability simply has no
 * source at all.
 *
 * @returns {"not-eligible"|"restriction"|"no-source"|null} null when held
 */
export function deriveDenialReason(state) {
  if (!state || state.effective) return null;
  if (state.eligible === false) return "not-eligible";
  if (state.restricted) return "restriction";
  if (!state.profile && !state.group && !state.grant) return "no-source";
  return null;
}

/**
 * Union of modules that appear in ANY source layer — the User Matrix only
 * renders rows that exist in the user's actual context.
 */
export function collectContextModules(sources) {
  const modules = new Set();
  for (const layer of ["profile", "groups", "grants"]) {
    for (const mod of Object.keys(sources?.[layer] || {})) modules.add(mod);
  }
  for (const mod of Object.keys(sources?.restrictions || {})) modules.add(mod);
  return [...modules].sort();
}
