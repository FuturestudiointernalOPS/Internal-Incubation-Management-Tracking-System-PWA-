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
 * PHASE UI-6 — the defaults matrix renders a FIXED set of access-level columns
 * (the product order) plus one extra column per capability that is not part of
 * the CRUD level set (send, moderate, archive, publish, …).
 *
 * The columns are checkboxes: a module either holds a capability or it does
 * not. There is no level dropdown any more, so the matrix only has to answer
 * "can this profile do X?", which is what the engine evaluates (minLevel 1).
 */
export const MATRIX_LEVEL_ORDER = ["view", "edit", "create", "delete"];
export const MATRIX_FULL = "full";

/**
 * The CRUD capability SET the matrix edits (membership, not display order).
 * Everything outside it (send, moderate, publish, archive, grant, execute,
 * manage, …) is an "advanced" capability owned by the Advanced section.
 */
export const CRUD_CAPABILITIES = ["view", "create", "edit", "delete"];

/** Keep only the CRUD capabilities of a module. */
export function crudCapabilities(capabilities = []) {
  return capabilities.filter((capability) => CRUD_CAPABILITIES.includes(capability));
}

/** True when a module carries at least one CRUD capability. */
export function hasCrudCapabilities(capabilities = []) {
  return crudCapabilities(capabilities).length > 0;
}

/** Canonical stored level of a CRUD capability (rows above are the product
 *  order; the level numbers keep the historical ACCESS_LEVELS values). */
export const CAPABILITY_LEVELS = { view: 1, create: 2, edit: 3, delete: 4 };

/** Level stored for a checked capability (extras are plain "granted"). */
export function capabilityLevel(capability) {
  return CAPABILITY_LEVELS[capability] ?? 1;
}

/** The module-specific capabilities of a section (everything outside CRUD). */
export function extraCapabilities(section) {
  return (section?.capabilities || []).filter(
    (c) => !MATRIX_LEVEL_ORDER.includes(c),
  );
}

/**
 * Ordered column descriptors for the CRUD matrix: the fixed ladder
 * View · Edit · Create · Delete · Full. Non-CRUD capabilities are deliberately
 * NOT columns any more — they live in the Advanced section, kept out of this
 * table so it stays readable, and so that "Full" can never silently grant a
 * capability the table does not show.
 *
 * @returns {Array<{key:string, kind:"level"|"full", capability:string|null}>}
 */
export function buildSectionColumns() {
  return [
    ...MATRIX_LEVEL_ORDER.map((capability) => ({
      key: capability,
      kind: "level",
      capability,
    })),
    { key: MATRIX_FULL, kind: "full", capability: null },
  ];
}

/**
 * Keep only the modules that carry at least one CRUD capability, dropping any
 * section left empty. Modules whose capabilities are all non-CRUD (permissions,
 * facilitator, bulk_upload, …) belong to the Advanced section, not the matrix.
 *
 * @param {Array}  sections  groupModulesByFeature output
 * @param {Object} modules   module → { capabilities: string[] }
 */
export function filterSectionsToCrudModules(sections, modules) {
  return (sections || [])
    .map((section) => ({
      ...section,
      modules: (section.modules || []).filter((module) =>
        hasCrudCapabilities(modules?.[module]?.capabilities),
      ),
    }))
    .filter((section) => section.modules.length > 0);
}

/**
 * STRICT section filter (UI-6): a profile only shows the features its assigned
 * role(s) are eligible for — the UNION across those roles. A profile that is
 * not the default of any role has no role to derive the ceiling from, so it
 * shows NOTHING until it is assigned to one. Modules without a feature mapping
 * (e.g. org_membership — `unmapped`) carry no eligibility ceiling and stay
 * visible once the profile has at least one role.
 *
 * Pure: `isEligible(role, feature)` is injected (the caller supplies the
 * fail-closed role eligibility reader).
 */
export function filterSectionsByRoleEligibility(sections, roles, isEligible) {
  if (!roles || roles.length === 0) return [];
  return (sections || []).filter(
    (section) =>
      section.unmapped || roles.some((role) => isEligible(role, section.feature)),
  );
}

function cloneModule(caps, module) {
  return { ...(caps || {}), [module]: { ...((caps || {})[module] || {}) } };
}

/**
 * Toggle ONE capability of ONE module, applying the product dependencies:
 *
 *   1. View is the base capability — checking any other capability also checks
 *      View, and clearing View clears every other capability of the module.
 *   2. Capability families (optional `parents` map { child → parent }): checking
 *      a child also checks its parent; clearing a parent clears its children.
 *      A parent NEVER auto-checks its children (granting `edit` must not grant
 *      `archive`/`publish`) — the dependency only runs child → parent upwards,
 *      and parent → children on clear.
 *
 * @param {Object} caps              capabilities matrix ({module:{cap:level}})
 * @param {string} module
 * @param {string} capability
 * @param {boolean} checked
 * @param {string[]} moduleCapabilities  every capability of the module
 * @param {Object} [parents]         { childCapability → parentCapability }
 * @returns a NEW capabilities matrix (never mutates the input)
 */
export function toggleCapability(caps, module, capability, checked, moduleCapabilities = [], parents = {}) {
  const next = cloneModule(caps, module);
  const hasView = moduleCapabilities.includes("view");
  const parent = parents?.[capability] || null;
  const children = Object.keys(parents || {}).filter((child) => parents[child] === capability);

  if (checked) {
    next[module][capability] = capabilityLevel(capability);
    if (parent && !(Number(next[module][parent]) > 0)) {
      next[module][parent] = capabilityLevel(parent);
    }
    if (hasView && capability !== "view" && !(Number(next[module].view) > 0)) {
      next[module].view = capabilityLevel("view");
    }
  } else {
    next[module][capability] = 0;
    for (const child of children) next[module][child] = 0;
    if (capability === "view") {
      for (const other of moduleCapabilities) {
        if (other !== "view") next[module][other] = 0;
      }
    }
  }
  return next;
}

/**
 * Toggle the collective "Full" column for one module: every capability of the
 * module is set to level 5 (checked) or 0 (unchecked).
 */
export function toggleFullCapabilities(caps, module, checked, moduleCapabilities = []) {
  const next = cloneModule(caps, module);
  for (const capability of moduleCapabilities) {
    next[module][capability] = checked ? 5 : 0;
  }
  return next;
}

/** True when every capability of the module is held at level 5. */
export function isModuleFull(caps, module, moduleCapabilities = []) {
  if (moduleCapabilities.length === 0) return false;
  return moduleCapabilities.every(
    (c) => Number((caps || {})[module]?.[c] ?? 0) === 5,
  );
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
