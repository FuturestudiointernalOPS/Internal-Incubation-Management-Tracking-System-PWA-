/**
 * The approved "Centre de permissions" prototype's navigation model (pure).
 *
 * Single source of truth for the four questions the centre answers and the
 * tabs each one opens. Shared by the shell (`PermissionPrototype`) and the UI
 * contract tests — no React / Next imports, so it can be required directly.
 *
 *   1 people      — what can ONE person do? (the person, the groups, the
 *                   platform-wide administrators, and the contextual links)
 *   2 profiles    — what does a role receive by default? (the profile matrix
 *                   and the contextual role → profile mapping)
 *   3 rules       — what is the maximum that can ever be granted? (the
 *                   eligibility ceiling, responsibility access, scope policies)
 *   4 journal     — what changed, who changed it, and why? (no sub-tabs: the
 *                   log IS the screen)
 */

export const PROTOTYPE_SECTIONS = ["people", "profiles", "rules", "journal"];

/** Tabs of each section, in the order the prototype shows them. */
export const PROTOTYPE_TABS = {
  people: ["people", "groups", "administrators", "context"],
  profiles: ["matrix", "contextRoles"],
  rules: ["eligibility", "responsibilities", "scope"],
  journal: [],
};

/**
 * A person's own detail tabs (opened by clicking a row) — the same prototype
 * vocabulary, kept next to the section tabs it belongs with.
 */
export const PERSON_TABS = ["rights", "why", "scope", "responsibilities", "history"];

export function sectionTabs(section) {
  return PROTOTYPE_TABS[section] || [];
}
/** The tab a section opens on ("" for the tab-less journal). */
export function firstTab(section) {
  return sectionTabs(section)[0] || "";
}

/**
 * Route door → prototype section, the same mapping the route contract test
 * locks: the centre's four questions live behind the four existing doors.
 */
export const NAV_KEY_TO_SECTION = {
  people: "people",
  templates: "profiles",
  rules: "rules",
  history: "journal",
};
