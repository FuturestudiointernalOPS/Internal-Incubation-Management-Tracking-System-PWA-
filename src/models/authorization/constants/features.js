/**
 * ImpactOS — Authorization Foundation: FEATURE VOCABULARY (pure)
 *
 * Pure constants ONLY (no db import, no side effects). The dashboard sections
 * the permissions UI is organized around, and the capability-module → feature
 * map the resolver authorizes against.
 */

/**
 * Canonical order of the features — mirrors the dashboard sections so the
 * Permissions UI lists them the way the sidebar does (NOT alphabetically).
 */
export const FEATURE_ORDER = [
  "crm",
  "communication",
  "programs",
  "ventures",
  "investors",
  "finance",
  "operations",
  "reports",
  "knowledge",
  "lms",
  "security",
  "settings",
];

// Capability module → feature key. Features ARE the dashboard sections; the
// modules are their sub-sections. The resolver authorizes against capability
// modules (PERMISSION_MODULES); eligibility is expressed per feature.
export const MODULE_TO_FEATURE = {
  // CRM — people data + the CRM records layer
  contacts: "crm",
  duplicates: "crm",
  bulk_upload: "crm",
  crm: "crm",
  // Organizational membership — the CRM section owns it in the navigation (the
  // `crm_membership` node).
  org_membership: "crm",
  // Communication
  messaging: "communication",
  internal_comms: "communication",
  forms: "communication",
  runs: "communication",
  collections: "communication",
  // Programs
  programs: "programs",
  facilitator: "programs",
  // Ventures / Investors
  ventures: "ventures",
  investor: "investors",
  // Finance
  finance: "finance",
  // Operations — projects + tasks share the dashboard OPERATIONS section
  projects: "operations",
  tasks: "operations",
  // Reports
  reports: "reports",
  // Knowledge
  knowledge: "knowledge",
  // LMS
  lms: "lms",
  // Security — user administration + permissions
  users: "security",
  permissions: "security",
  // Settings — system configuration + engineering operations
  settings: "settings",
  engineering: "settings",
};
