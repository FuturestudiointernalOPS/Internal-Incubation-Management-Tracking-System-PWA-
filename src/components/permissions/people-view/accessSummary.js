/**
 * Live counts behind the Access summary band.
 *
 * Pure derivation — no React, no fetch, no stored total. Every number is
 * recomputed from the person's resolved sources and the module catalogue, so
 * the summary can never drift from the matrix it heads.
 *
 * The definitions mirror the matrix exactly:
 *   - a capability is "shown" when the catalogue offers it for the module OR
 *     any source (profile, group, direct grant, restriction) holds it;
 *   - Permissions   = capabilities that are effectively held;
 *   - Inherited     = held capabilities whose profile or group layer is on;
 *   - Direct grants = held capabilities with a personal grant;
 *   - Restrictions  = capabilities an explicit block removes.
 * Overlap is real (a right can be inherited AND granted directly), so the
 * counts are not meant to add up — each answers its own question.
 */

/**
 * The capabilities a module may show: the catalogue's own list, or — when the
 * catalogue has none for it — every capability any source layer holds.
 */
export function moduleCaps(module, sources) {
  if (module?.caps?.length) return module.caps;
  const mod = module?.module;
  return [
    ...new Set([
      ...Object.keys(sources?.profile?.[mod] || {}),
      ...Object.keys(sources?.groups?.[mod] || {}),
      ...Object.keys(sources?.grants?.[mod] || {}),
      ...Object.keys(sources?.restrictions?.[mod] || {}),
    ]),
  ].sort();
}

export function summarizeAccess({ sources, modules, eligibleFor, deriveState, scope }) {
  let permissions = 0;
  let inherited = 0;
  let direct = 0;
  let restricted = 0;

  for (const entry of modules || []) {
    for (const capability of moduleCaps(entry, sources)) {
      const state = deriveState(entry.module, capability, eligibleFor(entry.module));
      if (state.restricted) restricted += 1;
      if (!state.effective) continue;
      permissions += 1;
      if (state.profile || state.group) inherited += 1;
      if (state.grant) direct += 1;
    }
  }

  const scopeCount = (scope || []).filter((entry) => (entry.count ?? 0) > 0).length;

  return { permissions, inherited, direct, restricted, scopeCount };
}
