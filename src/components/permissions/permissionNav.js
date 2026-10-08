/**
 * Permission Center navigation model (pure module).
 *
 * Adopted from the "Centre de permissions" prototype, reconciled with the
 * project's own rules (docs and __tests__/ui1-permission-shell.test.js):
 *
 *   FIVE places, named as work rather than as machinery, in the order an admin
 *   actually asks the questions:
 *
 *     1 People       — change what ONE person can do, plus the two people-wide
 *                      registries that answer the same question at a glance:
 *                      Groups (what a collection gets) and Administrators
 *                      (who holds the platform-wide bypass).
 *     2 Profiles     — change what a WHOLE kind of person gets by default, and
 *                      the contextual roles that map a relationship to one.
 *     3 Rules        — who may even have this (eligibility ceilings), which
 *                      roles may use a responsibility's feature, and the scope
 *                      policies that bound where a right operates.
 *     4 Operations   — the two portfolio-wide jobs, each behind a confirm.
 *     5 History      — what changed, who did it, why, plus the governance and
 *                      membership health that used to need its own door.
 *
 * Rules that keep it readable (locked by the shell contract test):
 *   • never more than 3 sub-tasks under a tab;
 *   • a sub-tab is never named like its own tab;
 *   • every item is a REAL route (deep linkable), the selected sub-tab is
 *     reflected in the URL (`?sub=`), so a screen is at most two clicks deep.
 *
 * Retired with this phase: the separate "Where it applies" door (its three
 * sub-tasks moved to the question each one answers), and the standalone
 * memberships screen (it now heads History, beside the log it summarizes).
 * Both keep forwarding from their old routes so old bookmarks never 404.
 */

export const PERMISSION_BASE = "/admin/security/permissions";

export const PERMISSION_NAV = [
  {
    // Slot 1 — the daily job, now carrying the two people-wide registries.
    key: "people",
    href: `${PERMISSION_BASE}/people`,
    labelKey: "engineering.permissions.navPeople",
    defaultSub: "people",
    tabs: [
      { key: "people", labelKey: "engineering.permissions.tabIndividualAccess" },
      { key: "groups", labelKey: "engineering.permissions.tabGroups" },
      { key: "admins", labelKey: "engineering.permissions.tabAdmins" },
    ],
  },
  {
    // Slot 2 — a profile IS the capability set, so there is nothing to edit
    // beside it and nothing to roll up. The second sub-tab maps a contextual
    // relationship onto a profile.
    key: "templates",
    href: `${PERMISSION_BASE}/profiles`,
    labelKey: "engineering.permissions.navTemplates",
    defaultSub: "matrix",
    tabs: [
      { key: "matrix", labelKey: "engineering.permissions.tabProfileCapabilities" },
      { key: "contextRoles", labelKey: "engineering.permissions.tabContextRoles" },
    ],
  },
  {
    // Slot 3 — every ceiling in one place: eligibility, the responsibility role
    // allowlists, and the scope policies that bound where a right applies.
    key: "rules",
    href: `${PERMISSION_BASE}/eligibility`,
    labelKey: "engineering.permissions.navRules",
    defaultSub: "eligibility",
    tabs: [
      { key: "eligibility", labelKey: "engineering.permissions.tabEligibilityCeilings" },
      { key: "responsibilities", labelKey: "engineering.permissions.tabResponsibilityAccess" },
      { key: "scope", labelKey: "engineering.permissions.tabScopePolicies" },
    ],
  },
  {
    // Slot 4 — the portfolio-wide jobs. No sub-tabs: the door IS the screen, and
    // each action states its own consequences before it runs.
    key: "operations",
    href: `${PERMISSION_BASE}/operations`,
    labelKey: "engineering.permissions.navOperations",
  },
  {
    // Slot 5 — the health numbers head the log; both are the same story at two
    // lengths.
    key: "history",
    href: `${PERMISSION_BASE}/audit`,
    labelKey: "engineering.permissions.navHistory",
  },
];

export function navByKey(key) {
  return PERMISSION_NAV.find((navItem) => navItem.key === key) || null;
}

/** Relative route segment under the Permission Center base ("" = landing). */
export function routeSegmentFor(navItem) {
  if (!navItem || navItem.key === "overview") return "";
  return navItem.href.slice(PERMISSION_BASE.length + 1);
}
