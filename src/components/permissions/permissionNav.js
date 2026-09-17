/**
 * PHASE UI-5 — Permission Center navigation model (pure module).
 *
 * Single source of truth shared by the shell, the route segments and the UI
 * contract tests. No React / Next imports, so it can be unit-tested directly.
 *
 * SIX places, named as work rather than as machinery, in the order an admin
 * actually asks the questions:
 *
 *   1 People            — change what ONE person can do
 *   2 Templates         — change what a WHOLE group gets
 *   3 Rules             — who may even have this, and why can't I grant it
 *   4 Where it applies  — which programs / ventures / courses it covers
 *   5 Operations        — run the two portfolio-wide jobs, each behind a confirm
 *   6 History           — what changed, who did it, and why
 *
 * Operations (UI-8) is the sixth door on purpose: it names the two consequential
 * actions that used to have no button anywhere — re-deriving capability grants
 * from contextual relationships, and reading who would LOSE access if the
 * portfolio-wide defaults were narrowed. It is a door rather than a sub-tab of
 * "Where it applies" because that tab already carries its three sub-tasks and
 * the "never more than 3" rule is what keeps a tab readable.
 *
 * Rules that keep it readable (locked by __tests__/ui1-permission-shell.test.js):
 *   • never more than 3 sub-tasks under a tab;
 *   • a sub-tab is never named like its own tab;
 *   • every item is a REAL route (deep linkable), the selected sub-tab is
 *     reflected in the URL (`?sub=`), so a screen is at most two clicks deep.
 *
 * Retired in this phase: the separate Home door (its numbers head History), the
 * separate Audit door (History IS the audit), the Catalog tab (a link inside
 * Rules), the Role → Profile tab (a control inside a template) and the
 * Identity → Feature tab (the same edits as editing the template itself).
 */

export const PERMISSION_BASE = "/admin/security/permissions";

export const PERMISSION_NAV = [
  {
    // Slot 1 — the daily job. Task-first: this is what an admin came to do.
    key: "people",
    href: `${PERMISSION_BASE}/people`,
    labelKey: "engineering.permissions.navPeople",
    defaultSub: "access",
    tabs: [
      { key: "access", labelKey: "engineering.permissions.tabIndividualAccess" },
      { key: "jobs", labelKey: "engineering.permissions.tabJobShortcuts" },
    ],
  },
  {
    // No sub-tabs on purpose: the door IS the screen.
    key: "templates",
    href: `${PERMISSION_BASE}/profiles`,
    labelKey: "engineering.permissions.navTemplates",
  },
  {
    key: "rules",
    href: `${PERMISSION_BASE}/eligibility`,
    labelKey: "engineering.permissions.navRules",
    defaultSub: "ceilings",
    tabs: [
      { key: "ceilings", labelKey: "engineering.permissions.tabEligibilityCeilings" },
      { key: "warnings", labelKey: "engineering.permissions.tabResponsibilityAccess" },
    ],
  },
  {
    key: "context",
    href: `${PERMISSION_BASE}/context-scope`,
    labelKey: "engineering.permissions.navWhereItApplies",
    defaultSub: "roles",
    tabs: [
      { key: "roles", labelKey: "engineering.permissions.tabContextRoles" },
      { key: "memberships", labelKey: "engineering.permissions.tabMemberships" },
      { key: "policies", labelKey: "engineering.permissions.tabScopePolicies" },
    ],
  },
  {
    // Slot 5 — the portfolio-wide jobs. No sub-tabs: the door IS the screen, and
    // each action states its own consequences before it runs (see
    // ./SyncContextGrantsPanel and ./ContextGrantReadinessPanel).
    key: "operations",
    href: `${PERMISSION_BASE}/operations`,
    labelKey: "engineering.permissions.navOperations",
  },
  {
    // Slot 6 — the numbers head the log; both are the same story at two lengths.
    key: "history",
    href: `${PERMISSION_BASE}/audit`,
    labelKey: "engineering.permissions.navHistory",
  },
];

/**
 * Sub-tab values that existed before Individual Access was merged into one
 * screen. The route redirects them to `access` so old bookmarks keep working.
 */
export const PERMISSION_PEOPLE_SUB_ALIASES = {
  search: "access",
  matrix: "access",
};

export function navByKey(key) {
  return PERMISSION_NAV.find((n) => n.key === key) || null;
}

/** Relative route segment under the Permission Center base ("" = landing). */
export function routeSegmentFor(navItem) {
  if (!navItem || navItem.key === "overview") return "";
  return navItem.href.slice(PERMISSION_BASE.length + 1);
}
