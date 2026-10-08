/**
 * Permission Centre — the DERIVATIONS behind every screen of the prototype.
 *
 * Pure functions (no React, no fetch, no i18n) that turn the resolver's own
 * output — one person's context — into what the prototype's tables show:
 * the rights rows, their counts, the three gates, and the risk of a change.
 *
 * They read `deriveUserCapState` from the shared matrix helpers so the centre
 * can never disagree with the People screen about what a person holds: one
 * derivation, several surfaces.
 */

import { deriveUserCapState } from "../matrixHelpers/state";

/** Feature eligibility is the outer gate: fail closed, Super Admin bypasses. */
export function isFeatureEligible(ctx, feature) {
  if (!feature) return true;
  if (ctx?.isSuperAdmin) return true;
  return ctx?.eligibility?.[feature] === true;
}

/** Highest level any source holds for one capability (0 = none). */
function sourceLevel(sources, module, capability) {
  let level = 0;
  for (const layer of ["profile", "groups", "grants"]) {
    const value = Number(sources?.[layer]?.[module]?.[capability] ?? 0);
    if (value > level) level = value;
  }
  return level;
}

/** The single origin the prototype's "Source" column shows. */
export function sourceOf(state) {
  if (!state) return "none";
  if (state.restricted) return "restriction";
  if (state.grant) return "direct";
  if (state.profile) return "profile";
  if (state.group) return "group";
  return "none";
}

/**
 * One row per module capability of the person's context — the prototype's
 * "Feature ▸ Sub-section | Level | Source" table, on real data.
 *
 * Modules come from the catalog union the person's actual sources, so a
 * capability the person never touches does not become an empty row, while a
 * block on an uncatalogued module still shows.
 */
export function buildRightRows({ ctx, catalog = {}, moduleToFeature = {} }) {
  const sources = ctx?.sources || {};
  const modules = new Set([
    ...Object.keys(catalog),
    ...Object.keys(sources.profile || {}),
    ...Object.keys(sources.groups || {}),
    ...Object.keys(sources.grants || {}),
    ...Object.keys(sources.restrictions || {}),
  ]);

  const rows = [];
  for (const module of modules) {
    const feature = moduleToFeature[module] || "";
    const capabilities = new Set(Object.keys(catalog?.[module]?.capabilities || {}));
    for (const layer of ["profile", "groups", "grants"]) {
      for (const capability of Object.keys(sources?.[layer]?.[module] || {})) capabilities.add(capability);
    }
    for (const capability of Object.keys(sources?.restrictions?.[module] || {})) capabilities.add(capability);

    for (const capability of capabilities) {
      const eligible = isFeatureEligible(ctx, feature);
      const state = deriveUserCapState(sources, module, capability, eligible);
      const restricted = Boolean(sources?.restrictions?.[module]?.[capability]);
      const level = sourceLevel(sources, module, capability);
      const origin = sourceOf(state);
      rows.push({
        key: `${module}.${capability}`,
        feature,
        module,
        capability,
        level,
        restricted,
        eligible,
        effective: state.effective,
        origin,
        sources: { profile: state.profile, group: state.group, direct: state.grant },
      });
    }
  }

  rows.sort(
    (a, b) =>
      a.feature.localeCompare(b.feature) ||
      a.module.localeCompare(b.module) ||
      a.capability.localeCompare(b.capability),
  );
  return rows;
}

/**
 * The four KPIs of the person header: effective, inherited, direct, restricted.
 * A row counts as inherited or direct by its WINNING origin, so the four
 * numbers always add up to the table's row count.
 */
export function countRights(rows) {
  const counts = { effective: 0, inherited: 0, direct: 0, restricted: 0 };
  for (const row of rows) {
    if (row.restricted) counts.restricted += 1;
    if (!row.effective) continue;
    counts.effective += 1;
    if (row.origin === "direct") counts.direct += 1;
    else counts.inherited += 1;
  }
  return counts;
}

/**
 * The three gates of the "Why" tab for ONE row: eligibility → capacity →
 * scope. `scopeRecords` is how many records the scope engine currently
 * resolves for the person; a gate that cannot be decided is "pending", never
 * a silent yes.
 */
export function gatesForRow(row, scopeRecords = 0) {
  const eligibility = row.eligible ? "yes" : "no";
  const capacity = !row.eligible ? "pending" : row.effective ? "yes" : "no";
  const scope = capacity !== "yes" ? "pending" : scopeRecords > 0 ? "yes" : "pending";
  return [eligibility, capacity, scope];
}

/**
 * Risk of one edit, as the prototype rates it: raising a person to Delete or
 * Full is critical, Edit is high, removing an already-high right is high.
 * `action` is "grant" | "revoke" | "restrict".
 */
export function changeRisk(action, fromLevel, toLevel) {
  if (action === "revoke" || action === "restrict") {
    return Number(fromLevel) >= 3 ? "high" : "normal";
  }
  if (toLevel >= 4) return "critical";
  if (toLevel === 3) return "high";
  return "normal";
}

/** The prototype's eligibility cell cycle: eligible → denied → unset → … */
export function nextEligibilityState(state) {
  if (state === 1) return 0;
  if (state === 0) return null;
  return 1;
}

/** module → feature inverted, so a feature owns the list of its modules. */
export function modulesByFeature(moduleToFeature = {}) {
  const byFeature = {};
  for (const [module, feature] of Object.entries(moduleToFeature)) {
    (byFeature[feature] = byFeature[feature] || []).push(module);
  }
  for (const modules of Object.values(byFeature)) modules.sort();
  return byFeature;
}

/**
 * The eligibility rows as a lookup: {identityValue: {feature: 1 | 0}}.
 * A missing identity or feature means "no row configured" — which the engine
 * treats exactly like a denial, so callers compare against 1, never truthiness.
 */
export function buildEligibilityMatrix(rows = []) {
  const matrix = {};
  for (const row of rows || []) {
    if (row.identity_type !== "role") continue;
    matrix[row.identity_value] = matrix[row.identity_value] || {};
    matrix[row.identity_value][row.feature_key] = Number(row.eligible);
  }
  return matrix;
}

/**
 * The capabilities a PROFILE holds inside one feature — the cell of the
 * Profiles matrix, and the write set of its drawer.
 *
 * @returns {Object} {module: {capability: level}}
 */
export function profileFeatureCaps(profileCaps = {}, feature, moduleToFeature = {}) {
  const out = {};
  for (const [module, capabilities] of Object.entries(profileCaps)) {
    if (moduleToFeature[module] !== feature) continue;
    out[module] = { ...capabilities };
  }
  return out;
}

/** Does this profile grant ANY capability inside the feature? */
export function profileGrantsFeature(profileCaps = {}, feature, moduleToFeature = {}) {
  return Object.keys(profileFeatureCaps(profileCaps, feature, moduleToFeature)).length > 0;
}

/**
 * The roles whose default profile is this profile.
 *
 * @returns {string[]}
 */
export function rolesDefaultingTo(profile, roleDefaults = {}) {
  return Object.entries(roleDefaults)
    .filter(([, value]) => String(value?.profileId ?? value?.profile_id) === String(profile?.id))
    .map(([role]) => role);
}

/**
 * Is a profile ABOVE the eligibility ceiling of a feature?
 *
 * The prototype's 🔒: a profile that still grants a feature whose ceiling the
 * role behind it no longer opens. A profile with no role default has no
 * ceiling to measure against and is never locked.
 */
export function profileOverCeiling(profile, feature, { roleDefaults = {}, eligibilityMatrix = {} } = {}) {
  const roles = rolesDefaultingTo(profile, roleDefaults);
  if (roles.length === 0) return false;
  return roles.some((role) => eligibilityMatrix[role]?.[feature] !== 1);
}
