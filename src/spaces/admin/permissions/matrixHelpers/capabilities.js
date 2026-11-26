/**
 * Permission Center matrix helpers — capability levels and section filters.
 *
 * The capability ladder (View · Edit · Create · Delete · Full), the CRUD set
 * and the section filters that keep the matrix limited to CRUD-bearing,
 * role-eligible features. Pure: no React, no DB.
 */

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
