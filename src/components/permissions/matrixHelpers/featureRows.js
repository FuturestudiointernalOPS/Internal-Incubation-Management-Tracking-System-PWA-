/**
 * Permission Center matrix helpers — feature/module grouping.
 *
 * Rows and sections derived from the feature registry, the module → feature
 * map and the capability catalog. Pure: no React, no DB.
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
