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
    description: "Platform overview and system status",
    icon: "LayoutDashboard",
    href: "/platform",
    enabled: true,
    visible: true,
    permissions: ["super_admin", "admin"],
    order: 0,
  },
  {
    id: "platform-collections",
    name: "Collections",
    description: "Organize and manage data collections",
    icon: "FolderKanban",
    href: "/platform/collections",
    enabled: true,
    visible: true,
    permissions: ["super_admin"],
    order: 1,
    future: false,
  },
  {
    id: "platform-forms",
    name: "Forms",
    description: "Create and manage intelligent forms",
    icon: "FileText",
    href: "/platform/forms",
    enabled: true,
    visible: true,
    permissions: ["super_admin"],
    order: 2,
    future: false,
  },
  {
    id: "platform-assessments",
    name: "Assessments",
    description: "Configure evaluation criteria and scoring",
    icon: "BarChart3",
    href: "/platform/modules",
    enabled: true,
    visible: true,
    permissions: ["super_admin"],
    order: 3,
    future: true,
  },
  {
    id: "platform-workflows",
    name: "Workflows",
    description: "Define automated business processes",
    icon: "GitBranch",
    href: "/platform/modules",
    enabled: true,
    visible: true,
    permissions: ["super_admin"],
    order: 4,
    future: true,
  },
  {
    id: "platform-runs",
    name: "Runs",
    description: "Launch form runs, manage submissions and reviews",
    icon: "Play",
    href: "/platform/runs",
    enabled: true,
    visible: true,
    permissions: ["super_admin"],
    order: 5,
    future: false,
  },
  {
    id: "platform-responses",
    name: "Responses",
    description: "View and manage all form submissions",
    icon: "FileText",
    href: "/platform/responses",
    enabled: true,
    visible: true,
    permissions: ["super_admin"],
    order: 6,
    future: false,
  },
  {
    id: "platform-settings",
    name: "Settings",
    description: "Platform configuration and governance",
    icon: "Settings",
    href: "/platform/settings",
    enabled: true,
    visible: true,
    permissions: ["super_admin"],
    order: 7,
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
