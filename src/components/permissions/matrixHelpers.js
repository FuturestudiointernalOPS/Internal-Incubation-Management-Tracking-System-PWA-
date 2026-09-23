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

import { FEATURE_SUBSECTIONS } from "@/models/authorization/feature-subsections";

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
      .filter(([, mappedFeature]) => mappedFeature === feature)
      .map(([module]) => module)
      .sort();
    rows.push({
      feature,
      modules: modules
        .filter((moduleKey) => catalog?.[moduleKey])
        .map((moduleKey) => ({
          module: moduleKey,
          locked: Boolean(catalog[moduleKey].locked),
          caps: Object.keys(catalog[moduleKey].capabilities || {}).sort(),
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
      : [...new Set(modKeys.map((moduleKey) => moduleToFeature?.[moduleKey]).filter(Boolean))];

  const sections = [];
  const seen = new Set();
  const push = (feature, members, unmapped) => {
    if (seen.has(feature) || members.length === 0) return;
    seen.add(feature);
    const capSet = new Set();
    for (const moduleKey of members) {
      for (const capability of modules[moduleKey]?.capabilities || []) capSet.add(capability);
    }
    const capabilities = [...capSet].sort((first, second) => {
      const firstIndex = BASE_CAP_ORDER.indexOf(first);
      const secondIndex = BASE_CAP_ORDER.indexOf(second);
      const firstOrder = firstIndex === -1 ? BASE_CAP_ORDER.length : firstIndex;
      const secondOrder = secondIndex === -1 ? BASE_CAP_ORDER.length : secondIndex;
      return firstOrder - secondOrder || first.localeCompare(second);
    });
    sections.push({ feature, modules: members, capabilities, unmapped });
  };

  for (const feature of order) {
    push(
      feature,
      modKeys.filter((moduleKey) => moduleToFeature?.[moduleKey] === feature).sort(),
      false,
    );
  }

  // Modules without a feature mapping are never hidden: each is its own section.
  for (const modKey of modKeys.filter((moduleKey) => !moduleToFeature?.[moduleKey]).sort()) {
    push(modKey, [modKey], true);
  }

  return sections;
}

/**
 * Rows of the Access-Profile template for ONE feature.
 *
 * Rows are the dashboard sub-sections (FEATURE_SUBSECTIONS), in sidebar order,
 * each resolved to the permission module that backs it; sub-sections without a
 * module are informational. Any module of the feature that no sub-section names
 * (facilitator, users) is appended so no capability is ever hidden.
 *
 * A module named by several sub-sections is editable ONCE (its first row); the
 * later rows are informational aliases sharing the same stored capabilities.
 *
 * @param {string} feature
 * @param {Object} availableModules  module → { name, capabilities: string[] }
 * @param {Object} moduleToFeature   module → feature key
 * @returns {Array<{id:string, labelKey:string|null, module:string|null,
 *   moduleLabel:boolean, capabilities:string[], editable:boolean}>}
 */
export function buildSubsectionRows(feature, availableModules, moduleToFeature = {}) {
  const modules = availableModules || {};
  const rows = [];
  const used = new Set();

  for (const sub of FEATURE_SUBSECTIONS[feature] || []) {
    const mod = sub.module && modules[sub.module] ? sub.module : null;
    rows.push({
      id: sub.id,
      labelKey: sub.labelKey,
      module: mod,
      moduleLabel: false,
      capabilities: mod ? modules[mod].capabilities || [] : [],
      editable: Boolean(mod) && !used.has(mod),
    });
    if (mod) used.add(mod);
  }

  for (const mod of Object.keys(modules).sort()) {
    if (moduleToFeature[mod] !== feature || used.has(mod)) continue;
    rows.push({
      id: mod,
      labelKey: null,
      module: mod,
      moduleLabel: true,
      capabilities: modules[mod].capabilities || [],
      editable: true,
    });
    used.add(mod);
  }

  return rows;
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
    (capability) => !MATRIX_LEVEL_ORDER.includes(capability),
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
    (capability) => Number((caps || {})[module]?.[capability] ?? 0) === 5,
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
 * WHERE a capability comes from — the second question the Person screen has to
 * answer ("why can they do it?"), next to the effective verdict.
 *
 * The rule mirrors the RESOLVER, which does not rank its sources: it takes the
 * MAXIMUM of profile, group and direct grant, removes the capabilities that are
 * explicitly blocked, and gates the whole thing on the feature's eligibility.
 * So (a) every source that holds the capability is reported, not just the
 * strongest one, and (b) a block is reported ALONE: it beats every source, so
 * also claiming "granted directly" on the same line would be false.
 *
 * The order is the one a reader cares about: the personal exception first, then
 * the profile, then the groups.
 *
 * @param {Object} state  deriveUserCapState output
 * @param {{profileName?: string|null, groups?: string[], superAdmin?: boolean}} context
 * @returns {Array<{key: string, params: Object}>} i18n descriptors, never empty
 */
export function describeCapOrigins(
  state,
  { profileName = null, groups = [], superAdmin = false } = {},
) {
  if (!state) return [{ key: ORIGIN_KEYS.none, params: {} }];

  // Eligibility is the outer gate: nothing below it is worth reporting.
  if (state.eligible === false) {
    return [
      { key: "engineering.permissions.effectiveReasonNotEligible", params: {} },
    ];
  }
  // A block removes the capability entirely (resolver semantics).
  if (state.restricted) return [{ key: ORIGIN_KEYS.blocked, params: {} }];

  const origins = [];
  if (state.grant) origins.push({ key: ORIGIN_KEYS.direct, params: {} });
  if (state.profile) {
    origins.push(
      superAdmin
        ? { key: ORIGIN_KEYS.superAdmin, params: {} }
        : profileName
          ? { key: ORIGIN_KEYS.profile, params: { profile: profileName } }
          : { key: ORIGIN_KEYS.profileFallback, params: {} },
    );
  }
  if (state.group) {
    const names = (groups || []).filter(Boolean);
    origins.push(
      names.length
        ? { key: ORIGIN_KEYS.group, params: { group: names.join(", ") } }
        : { key: ORIGIN_KEYS.groupFallback, params: {} },
    );
  }
  if (origins.length === 0) origins.push({ key: ORIGIN_KEYS.none, params: {} });
  return origins;
}

/**
 * Origin labels. Kept here so the report and the editors name a source the
 * same way — the t() keys themselves are resolved by the caller.
 */
export const ORIGIN_KEYS = {
  direct: "engineering.permissions.capOriginDirect",
  profile: "engineering.permissions.capOriginProfile",
  profileFallback: "engineering.permissions.capOriginProfileFallback",
  group: "engineering.permissions.capOriginGroup",
  groupFallback: "engineering.permissions.capOriginGroupFallback",
  superAdmin: "engineering.permissions.capOriginSuperAdmin",
  blocked: "engineering.permissions.capOriginBlocked",
  none: "engineering.permissions.capOriginNone",
};

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

/**
 * C1 — stored capabilities the editable matrix is NOT showing, at CAPABILITY
 * granularity (a module can be editable while one of its capabilities is not).
 *
 * Three ways a stored capability can end up invisible in the template editor:
 *   - its feature is no longer eligible for the profile's roles;
 *   - its module is not a dashboard section (so it is dropped from the screen);
 *   - its capability is no longer offered by the product (retired).
 * In every case the row is still STORED, still granted to everyone who inherits
 * the profile, and still sent on save — so hiding it silently makes the screen
 * dishonest AND can make a save fail on something the admin cannot even see.
 * Return them so the editor can surface them read-only with a "remove".
 *
 * @param {Object} savedCaps  {module: {capability: level}} as persisted
 * @param {Object} editableCaps  {module: Set|Array<capability>} still offered
 * @returns {Array<{module: string, capabilities: string[]}>} sorted, non-empty
 */
export function collectHiddenStoredCaps(savedCaps, editableCaps) {
  const out = [];
  for (const [module, caps] of Object.entries(savedCaps || {})) {
    const offered = editableCaps?.[module];
    const editable = offered instanceof Set ? offered : new Set(offered || []);
    const held = Object.entries(caps || {})
      .filter(
        ([capability, level]) => Number(level) > 0 && !editable.has(capability),
      )
      .map(([capability]) => capability)
      .sort();
    if (held.length > 0) out.push({ module, capabilities: held });
  }
  return out.sort((first, second) => first.module.localeCompare(second.module));
}

/**
 * PHASE C — the features a PERSON's editor may offer.
 *
 * A person's editor must only offer what can actually be granted: the features
 * the person is eligible for, PLUS any feature where a personal exception
 * already exists (an individual grant or block). Keeping the exception visible
 * is what lets it be undone — hiding it would make it impossible to remove.
 *
 * Returns `undefined` when eligibility is unknown, so the caller hides NOTHING
 * rather than everything: a missing map must never look like "no access".
 *
 * @param {Object|null} eligibility  {feature: true | {eligible: boolean}}
 * @param {Object} moduleToFeature   module → feature
 * @param {Iterable<string>} exceptionModules  modules holding a personal exception
 * @returns {Set<string>|undefined}
 */
export function eligibleFeaturesForPerson(
  eligibility,
  moduleToFeature,
  exceptionModules = [],
) {
  if (!eligibility) return undefined;
  const features = new Set();
  for (const [feature, state] of Object.entries(eligibility)) {
    if (state === true || state?.eligible === true) features.add(feature);
  }
  for (const moduleKey of exceptionModules) {
    const feature = moduleToFeature?.[moduleKey];
    if (feature) features.add(feature);
  }
  return features;
}

/**
 * Is this person eligible for a feature, from the resolved eligibility map?
 *
 * Accepts both shapes the app produces: a plain boolean and `{eligible}`.
 * Fails OPEN on a missing map (the editor hides nothing when the data is
 * unavailable) and treats a module with no feature as not eligibility-bound.
 */
export function isPersonEligibleForFeature(eligibility, feature) {
  if (!eligibility) return true;
  if (!feature) return true;
  const state = eligibility[feature];
  return state === true || state?.eligible === true;
}
