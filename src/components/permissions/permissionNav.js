/**
 * PHASE UI-1 — Permission Center navigation model (pure module).
 *
 * Single source of truth shared by the shell, the Overview screen, the route
 * segments, and the UI contract tests. No React / Next imports, so it can be
 * unit-tested directly.
 *
 * Every primary item is a REAL route (deep linkable). `tabs` are the ONLY
 * navigation below a door: the shell renders them and reflects the selection
 * in the URL (`?sub=`), so links to a specific sub-screen keep working and no
 * view is reachable through two different navs.
 *
 * Phase 1 reorder — the admin's mental cascade, not the engine's nouns:
 *   Home → Eligibility (the ceiling) → Access Profiles → Individual Access →
 *   Context & Scope → Audit
 *
 * Phase 2 consolidation — the temporary "Advanced" door was retired and its
 * three screens moved to the question they belong to:
 *   Catalog          → Access Profiles  (?sub=catalog)
 *   Responsibilities → Individual Access (?sub=jobs)
 *   Resp. access     → Eligibility      (?sub=warnings)
 * Six doors, one navigation per door: a sub-tab is the only way to reach a
 * screen, so nothing is reachable twice.
 */

export const PERMISSION_BASE = "/admin/security/permissions";

export const PERMISSION_NAV = [
  {
    key: "overview",
    href: PERMISSION_BASE,
    labelKey: "engineering.permissions.navOverview",
  },
  {
    // Slot 2: the ceiling every capability is gated by ("who may ever
    // receive this?"), asked before any profile or person.
    key: "eligibility",
    href: `${PERMISSION_BASE}/eligibility`,
    labelKey: "engineering.permissions.navEligibility",
    defaultSub: "ceilings",
    tabs: [
      { key: "ceilings", labelKey: "engineering.permissions.tabEligibilityCeilings" },
      { key: "warnings", labelKey: "engineering.permissions.tabResponsibilityAccess" },
    ],
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
      { key: "catalog", labelKey: "engineering.permissions.tabCatalog" },
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
      { key: "jobs", labelKey: "engineering.permissions.tabJobShortcuts" },
    ],
  },
  {
    key: "context",
    href: `${PERMISSION_BASE}/context-scope`,
    labelKey: "engineering.permissions.navContextScope",
    defaultSub: "roles",
    tabs: [
      { key: "roles", labelKey: "engineering.permissions.tabContextRoles" },
      { key: "memberships", labelKey: "engineering.permissions.tabMemberships" },
      { key: "policies", labelKey: "engineering.permissions.tabScopePolicies" },
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
