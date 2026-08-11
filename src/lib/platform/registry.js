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
    permissions: ["super_admin", "admin"],
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
    permissions: ["super_admin"],
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
    permissions: ["super_admin"],
    order: 2,
    future: false,
  },
];

/**
 * Returns all registered modules, optionally filtered by role.
 */
export function getRegisteredModules(role) {
  if (!role) return [...REGISTERED_MODULES];
  return REGISTERED_MODULES.filter((m) => {
    if (!m.enabled) return false;
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
export function getActiveModules(role) {
  return getRegisteredModules(role).filter((m) => m.visible && !m.future);
}

export default REGISTERED_MODULES;
