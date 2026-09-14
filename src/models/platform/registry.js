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
    permissions: ["super_admin", "admin", "staff"],
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
    permissions: ["super_admin", "admin", "staff"],
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
    permissions: ["super_admin"],
    order: 5,
    future: false,
  },
];

/**
 * Returns all registered modules, optionally filtered by role and/or by a
 * capability predicate.
 *
 * A module may declare `capability` ({ module, capability }) to be governed by
 * the resolver instead of a role allowlist. When `hasCapability` is supplied,
 * that predicate decides; otherwise the module falls back to its legacy
 * `permissions` role list so role-only consumers keep working.
 */
export function getRegisteredModules(role, hasCapability = null) {
  // Fail CLOSED on an unknown role: a caller that has not resolved the session
  // yet must never be shown the full module list (that flashed every module for
  // a moment before the real role arrived).
  if (!role) return [];
  return REGISTERED_MODULES.filter((m) => {
    if (!m.enabled) return false;
    if (m.capability && typeof hasCapability === "function") {
      return hasCapability(m.capability);
    }
    if (!m.permissions || m.permissions.length === 0) return true;
    return m.permissions.includes(role);
  });
}

/**
 * Returns a single module by ID.
 */
export function getModuleById(moduleId) {
  return REGISTERED_MODULES.find((m) => m.id === moduleId) || null;
}

/**
 * Returns only active (non-future, visible) modules for navigation.
 */
export function getActiveModules(role, hasCapability = null) {
  return getRegisteredModules(role, hasCapability).filter(
    (m) => m.visible && !m.future,
  );
}

export default REGISTERED_MODULES;
