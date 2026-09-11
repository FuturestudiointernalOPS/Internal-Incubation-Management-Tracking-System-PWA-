/**
 * PHASE 2 — Permission Center matrix helpers.
 *
 * Pure derivation functions shared by the Defaults Matrix and the User
 * Matrix. Kept free of React/DB so the module-access rules are unit-tested:
 *
 *   - Module access is DERIVED from capabilities (never stored).
 *   - A module with zero capabilities remains visible ([—]).
 *   - `locked` modules are displayed with a lock state.
 *   - Scope is never encoded into capability names (displayed separately).
 */

/**
 * Feature registry rows in canonical order: each feature carries the modules
 * mapped to it (via moduleToFeature) plus any feature-level metadata.
 *
 * @param {string[]} features            ordered feature keys (eligibility FEATURE_KEYS)
 * @param {Object}   moduleToFeature     module → feature
 * @param {Object}   catalog             CAPABILITY_CATALOG (module → { capabilities })
 * @returns {Array<{feature: string, modules: Array<{module:string, locked:boolean,
 *           caps: string[]}>}>}
 */
export function buildFeatureRows(features, moduleToFeature, catalog) {
  const rows = [];
  for (const feature of features || []) {
    const modules = Object.entries(moduleToFeature || {})
      .filter(([, f]) => f === feature)
      .map(([module]) => module)
      .sort();
    rows.push({
      feature,
      modules: modules
        .filter((m) => catalog?.[m])
        .map((m) => ({
          module: m,
          locked: Boolean(catalog[m].locked),
          caps: Object.keys(catalog[m].capabilities || {}).sort(),
        })),
    });
  }
  return rows;
}

// Canonical capability progression used to order the matrix columns. Any
// module-specific capability (archive, publish, export, suspend, …) is placed
// after these, alphabetically.
const BASE_CAP_ORDER = ["view", "create", "edit", "delete"];

/**
 * Group capability modules into FEATURE sections for the defaults matrix.
 *
 * A feature is a sidebar-level section (crm, communication, programs, …); its
 * modules are the sub-sections shown as rows, and the ordered union of their
 * capabilities are the columns (the header row). Modules with no feature
 * mapping (e.g. org_membership) become their own section so nothing is ever
 * hidden.
 *
 * @param {Object}   modules         module → { name, capabilities: string[] }
 * @param {Object}   moduleToFeature module → feature key
 * @param {string[]} featureOrder    canonical feature order (falls back to map order)
 * @returns {Array<{feature:string, modules:string[], capabilities:string[], unmapped:boolean}>}
 */
export function groupModulesByFeature(modules, moduleToFeature, featureOrder) {
  const modKeys = Object.keys(modules || {});
  const order =
    featureOrder && featureOrder.length
      ? featureOrder
      : [...new Set(modKeys.map((m) => moduleToFeature?.[m]).filter(Boolean))];

  const sections = [];
  const seen = new Set();
  const push = (feature, members, unmapped) => {
    if (seen.has(feature) || members.length === 0) return;
    seen.add(feature);
    const capSet = new Set();
    for (const m of members) {
      for (const c of modules[m]?.capabilities || []) capSet.add(c);
    }
    const capabilities = [...capSet].sort((a, b) => {
      const ia = BASE_CAP_ORDER.indexOf(a);
      const ib = BASE_CAP_ORDER.indexOf(b);
      const ka = ia === -1 ? BASE_CAP_ORDER.length : ia;
      const kb = ib === -1 ? BASE_CAP_ORDER.length : ib;
      return ka - kb || a.localeCompare(b);
    });
    sections.push({ feature, modules: members, capabilities, unmapped });
  };

  for (const feature of order) {
    push(
      feature,
      modKeys.filter((m) => moduleToFeature?.[m] === feature).sort(),
      false,
    );
  }

  // Modules without a feature mapping are never hidden: each is its own section.
  for (const modKey of modKeys.filter((m) => !moduleToFeature?.[m]).sort()) {
    push(modKey, [modKey], true);
  }

  return sections;
}

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
 * Restrictions REMOVE the capability entirely (resolver semantics), so a
 * restriction beats every source and the effective flag is false with a
 * reason.
 *
 * @returns {{profile:boolean, group:boolean, grant:boolean,
 *            restricted:boolean, effective:boolean, reason:string|null}}
 */
export function deriveUserCapState(sources, module, capability) {
  const has = (layer) => Number(sources?.[layer]?.[module]?.[capability] ?? 0) > 0;
  const profile = has("profile");
  const group = has("groups");
  const grant = has("grants");
  const restricted = Boolean(sources?.restrictions?.[module]?.has?.(capability))
    || Boolean(sources?.restrictions?.[module]?.[capability]);
  const effective = (profile || group || grant) && !restricted;
  return {
    profile,
    group,
    grant,
    restricted,
    effective,
    reason: restricted ? "restriction" : null,
  };
}

/**
 * Why a capability is denied (UI-2). Returns a machine reason the UI maps to
 * localized copy — a restriction always wins, otherwise the capability simply
 * has no source at all.
 *
 * @returns {"restriction"|"no-source"|null} null when the capability is held
 */
export function deriveDenialReason(state) {
  if (!state || state.effective) return null;
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
