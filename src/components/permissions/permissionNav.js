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
 *
 * Phase 1 reorder — the admin's mental cascade, not the engine's nouns:
 *   Home → Eligibility (the ceiling) → Access Profiles → Individual Access →
 *   Context & Scope → Advanced → Audit
 * "Governance" is a temporary home for Catalog + Responsibilities until
 * Phase 2 relocates them; Eligibility was promoted to its own primary item.
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
    // Temporary home for Catalog / Responsibilities / Responsibility Access
    // (Phase 2 relocates them). Eligibility lives at its own route above.
    key: "governance",
    href: `${PERMISSION_BASE}/governance`,
    labelKey: "engineering.permissions.navGovernance",
    defaultSub: "catalog",
    tabs: [
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
