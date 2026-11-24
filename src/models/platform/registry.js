/**
 * PLATFORM MODULE REGISTRY
 *
 * Central registry for all Platform modules.
 * Each module self-registers with metadata, navigation, permissions, routes.
 *
 * To add a new module, add an entry to the `modules` array below.
 * No application code changes needed — the registry is auto-discovered.
 */

const REGISTERED_MODULES = [
  {
    id: "platform-dashboard",
    name: "Dashboard",
    description: "Forms overview and recent activity",
    icon: "LayoutDashboard",
    href: "/platform",
    enabled: true,
    visible: true,
    // Mirrors the API the screen calls (`form-runs?dashboard=true`, which
    // requires runs.view). The role list below is the legacy fallback for
    // role-only catalogue screens, never the visibility rule.
    capability: { module: "runs", capability: "view" },
    permissions: ["super_admin", "staff"],
    order: 0,
  },
  {
    id: "platform-forms",
    name: "Forms",
    description: "Create and manage forms, collections, and AI evaluation",
    icon: "FileText",
    href: "/platform/forms",
    enabled: true,
    visible: true,
    // Mirrors the backing API: /api/platform/forms + /api/platform/collections
    // read allow super_admin, admin and staff (writes stay admin-only).
    capability: { module: "forms", capability: "view" },
    permissions: ["super_admin", "staff"],
    order: 1,
    future: false,
  },
  {
    id: "platform-runs",
    name: "Runs",
    description: "Launch runs, view submissions, review and decide",
    icon: "Play",
    href: "/platform/runs",
    enabled: true,
    visible: true,
    // Governance: the `runs.view` capability (Communication feature). When a
    // capability predicate is supplied the sidebar evaluates it; the role
    // allowlist below stays the fallback for role-only consumers.
    capability: { module: "runs", capability: "view" },
    permissions: ["super_admin"],
    order: 2,
    future: false,
  },
  {
    id: "platform-import",
    name: "Historical Import",
    description: "Import past submissions from CSV with field mapping and CRM resolution",
    icon: "Upload",
    href: "/admin/platform/import",
    enabled: true,
    visible: true,
    // The import endpoints require settings.edit.
    capability: { module: "settings", capability: "edit" },
    permissions: ["super_admin"],
    order: 3,
    future: false,
  },
  {
    id: "platform-import-review",
    name: "Identity Review",
    description: "Verify identity flags raised during historical import",
    icon: "User",
    href: "/admin/platform/import/review",
    enabled: true,
    visible: true,
    // The review-flags endpoints require settings.edit.
    capability: { module: "settings", capability: "edit" },
    permissions: ["super_admin"],
    order: 4,
    future: false,
  },
  {
    id: "platform-scores",
    name: "Scores",
    description: "Filter evaluated applicants by AI score threshold",
    icon: "BarChart3",
    href: "/admin/platform/scores",
    enabled: true,
    visible: true,
    // The scores screen reads evaluations through the runs API.
    capability: { module: "runs", capability: "view" },
    permissions: ["super_admin"],
    order: 5,
    future: false,
  },
];

/**
 * Returns all registered modules, optionally filtered by a capability
 * predicate.
 *
 * Every module declares `capability` ({ module, capability }) — the right its
 * ONE API enforces. When `hasCapability` is supplied (the sidebar, and any
 * screen that gates what it offers), that predicate decides who sees the
 * module: a right is the only grant.
 *
 * `permissions` is kept ONLY for the role-only catalogue screens (the module
 * list and the settings table). It is stale metadata there, never a door: a
 * module is meant to be opened through its address and that address's API,
 * which reads the right.
 */
export function getRegisteredModules(role, hasCapability = null) {
  // Fail CLOSED on an unknown role: a caller that has not resolved the session
  // yet must never be shown the full module list (that flashed every module for
  // a moment before the real role arrived).
  if (!role) return [];
  return REGISTERED_MODULES.filter((module) => {
    if (!module.enabled) return false;
    if (typeof hasCapability === "function") {
      return module.capability ? hasCapability(module.capability) : false;
    }
    // No predicate: a catalogue screen asks the legacy role table. This is the
    // only remaining consumer of `permissions`, and it renders no door.
    if (!module.permissions || module.permissions.length === 0) return true;
    return module.permissions.includes(role);
  });
}

/**
 * Returns only active (non-future, visible) modules for navigation.
 */
export function getActiveModules(role, hasCapability = null) {
  return getRegisteredModules(role, hasCapability).filter(
    (module) => module.visible && !module.future,
  );
}

export default REGISTERED_MODULES;
