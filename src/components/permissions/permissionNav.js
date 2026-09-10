/**
 * PHASE UI-1 — Permission Center navigation model (pure module).
 *
 * Single source of truth shared by the shell, the Overview screen, the route
 * segments, and the UI contract tests. No React / Next imports, so it can be
 * unit-tested directly.
 *
 * Every primary item is a REAL route (deep linkable). `tabs` are sub-tabs
 * rendered by the shell; the selected sub-tab is reflected in the URL
 * (`?sub=`), so links to a specific sub-screen keep working.
 */

export const PERMISSION_BASE = "/admin/security/permissions";

export const PERMISSION_NAV = [
  {
    key: "overview",
    href: PERMISSION_BASE,
    labelKey: "engineering.permissions.navOverview",
  },
  {
    key: "profiles",
    href: `${PERMISSION_BASE}/profiles`,
    labelKey: "engineering.permissions.navProfiles",
    defaultSub: "profiles",
    tabs: [
      { key: "profiles", labelKey: "engineering.permissions.tabAccessProfiles" },
      { key: "roles", labelKey: "engineering.permissions.tabRoleDefaults" },
      { key: "defaultsMatrix", labelKey: "engineering.permissions.tabDefaultsMatrix" },
    ],
  },
  {
    key: "people",
    href: `${PERMISSION_BASE}/people`,
    labelKey: "engineering.permissions.navPeople",
    defaultSub: "search",
    tabs: [
      { key: "search", labelKey: "engineering.permissions.tabUserSearch" },
      { key: "matrix", labelKey: "engineering.permissions.tabUserMatrix" },
    ],
  },
  {
    key: "context",
    href: `${PERMISSION_BASE}/context-scope`,
    labelKey: "engineering.permissions.navContextScope",
    defaultSub: "roles",
    tabs: [
      { key: "roles", labelKey: "engineering.permissions.tabContextRoles" },
      { key: "policies", labelKey: "engineering.permissions.tabScopePolicies" },
    ],
  },
  {
    key: "governance",
    href: `${PERMISSION_BASE}/governance`,
    labelKey: "engineering.permissions.tabGovernance",
    defaultSub: "eligibility",
    tabs: [
      { key: "eligibility", labelKey: "engineering.permissions.tabEligibility" },
      { key: "catalog", labelKey: "engineering.permissions.tabCatalog" },
      { key: "responsibilities", labelKey: "engineering.permissions.tabResponsibilities" },
      { key: "access", labelKey: "engineering.permissions.tabResponsibilityAccess" },
    ],
  },
  {
    key: "audit",
    href: `${PERMISSION_BASE}/audit`,
    labelKey: "engineering.permissions.tabAudit",
  },
];

export function navByKey(key) {
  return PERMISSION_NAV.find((n) => n.key === key) || null;
}

/** Relative route segment under the Permission Center base ("" = overview). */
export function routeSegmentFor(navItem) {
  if (!navItem || navItem.key === "overview") return "";
  return navItem.href.slice(PERMISSION_BASE.length + 1);
}
