/**
 * The feature sections a profile may edit
 *
 * The catalogue as sections, narrowed ONLY when the profile is a role's
 * default: a standalone profile keeps every section, and the eligibility
 * ceiling narrows it for the people who inherit it that way.
 *
 * Cut out of src/components/permissions/permission-center/AccessProfilesView.js
 * as-is: no state of its own, no reads. The panel keeps every state value, every
 * read and both loaders, and hands this factory what it reads through `values`
 * — plus what the factories above it return. The names it needs are listed in
 * the signature — nothing else.
 */

import {
  collectHiddenStoredCaps,
  filterSectionsByRoleEligibility,
  groupModulesByFeature,
} from "@/components/permissions/matrixHelpers";

export function catalogSections({
  eligibilityRows,
  availableModules,
  moduleToFeature,
  featureKeys,
  selectedIsDefaultFor,
  savedCaps,
}) {
  // A role is eligible for a feature when at least one row says yes and no
  // row explicitly denies it — mirrors the resolver's fail-closed semantics.
  const isRoleEligibleForFeature = (role, feature) => {
    let anyEligible = false;
    for (const row of eligibilityRows) {
      if (
        row.identity_type !== "role" ||
        row.identity_value !== role ||
        row.feature_key !== feature
      ) {
        continue;
      }
      if (Number(row.eligible) === 1) anyEligible = true;
      else return false; // explicit deny wins
    }
    return anyEligible;
  };

  // Feature sections: each FEATURE (sidebar-level section) carries its modules
  // as sub-sections (rows) and the ordered union of their capabilities (the
  // header row).
  //
  // Unmapped modules (modules with no feature — e.g. org_membership) are NOT
  // features and are dropped: the template only ever shows dashboard sections.
  const allSections = groupModulesByFeature(
    availableModules,
    moduleToFeature,
    featureKeys,
  ).filter((section) => !section.unmapped);

  // A profile is configurable ON ITS OWN. It does not have to be a role's
  // default to be edited (see docs/ACCESS_PROFILE_CLEANUP.md). Only a profile
  // that IS bound as a role default is narrowed to those roles' eligibility —
  // that is the ceiling the resolver enforces for the people who inherit it
  // that way. A standalone profile shows the whole catalogue; its ceiling is
  // still enforced where it actually binds, at assignment time
  // (assertTemplateCapsEligible in /api/access-profiles/assign).
  const eligibleSections =
    selectedIsDefaultFor.length > 0
      ? filterSectionsByRoleEligibility(
          allSections,
          selectedIsDefaultFor,
          isRoleEligibleForFeature,
        )
      : allSections;

  // The features the profile's roles are eligible for. Also the ceiling for the
  // Advanced section, so it never offers what the roles cannot hold.
  const visibleFeatures = new Set(
    eligibleSections.map((section) => section.feature),
  );

  // Every module of every eligible feature is listed as a sub-section — INCLUDING
  // modules whose capabilities are all non-CRUD (bulk_upload, permissions,
  // facilitator): the feature must show its real sub-sections. Those capabilities
  // are edited in the Advanced section below; the CRUD cells stay empty for them.
  const visibleSections = eligibleSections;

  // C1 — modules the matrix above can edit. Anything STORED outside this set is
  // invisible to the editor (ineligible feature, or module without a dashboard
  // section) yet still granted AND still validated on save, so it must stay
  // visible and removable instead of silently blocking the save.
  const editableModules = new Set(
    visibleSections.flatMap((section) => section.modules),
  );

  // Capability granularity: a module can be editable while one of its
  // capabilities is no longer offered (retired), so the hidden set is computed
  // per capability, not per module.
  const editableCaps = {};
  for (const moduleKey of editableModules) {
    editableCaps[moduleKey] = availableModules[moduleKey]?.capabilities || [];
  }

  const hiddenStoredCaps = collectHiddenStoredCaps(savedCaps, editableCaps);

  return {
    visibleFeatures,
    visibleSections,
    hiddenStoredCaps,
  };
}
