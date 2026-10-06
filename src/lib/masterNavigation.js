/**
 * ImpactOS — Master Navigation
 *
 * ONE canonical navigation tree for the whole application, consumed by every
 * role. Roles never define navigation structure; they only declare ACCESS to
 * the master tree:
 *
 *   MASTER_NAVIGATION (structure — defined once)
 *        ↓
 *   ROLE_ACCESS (flat id masks + href/icon overrides per role)
 *        ↓
 *   buildRoleNav(role) → the role's projected view (a filter, not a copy)
 *
 * Rules:
 * - A node (concept) exists exactly once, identified by its stable `id`.
 * - Route differences between roles (e.g. /admin/programs vs /pm/programs)
 *   are a ROUTING concern, resolved via ROLE_ACCESS.hrefs — never by
 *   duplicating the node.
 * - ROLE_ACCESS contains only pointers (ordered id arrays) and overrides —
 *   zero structure. Do not add navigation sections to a role config; extend
 *   MASTER_NAVIGATION instead.
 * - Node ids are the contract shared with NAV_KEY_MAP (labels), CRUMB_PATH_MAP
 *   (breadcrumbs), buildAccessNav (access), badges, active-route
 *   detection and the permission system. Never rename an id.
 * - Icons are stored as string names here (keeps this module test-friendly);
 *   the sidebar resolves them to components (see NAV_ICONS in DashboardLayout).
 *
 * This module is a barrel; the implementation lives in ./masterNavigation/:
 *   nodes.js    — the master node tables
 *   access.js   — role access, capability requirements and href fallbacks
 *   builders.js — pure projection builders
 */

export * from "./masterNavigation/nodes";
export * from "./masterNavigation/access";
export * from "./masterNavigation/builders";
