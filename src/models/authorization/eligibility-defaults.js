/**
 * ImpactOS — Authorization Foundation: FEATURE ELIGIBILITY DEFAULTS
 *
 * Pure constants ONLY (no db import, no side effects). This module is the
 * single source of truth for the per-feature role allowlists used by:
 *
 *   - the eligibility seed (`./eligibility.js` — feature_eligibility rows),
 *   - the Responsibility Access defaults (`src/lib/featureAccess.js`),
 *   - the model-consistency tests (roles must stay within ROLE_CATALOG).
 *
 * FEATURES = the dashboard sections (CRM, Communication, Programs, …). Their
 * modules are the sub-sections (see MODULE_TO_FEATURE).
 *
 * These only fill rows that have never been configured (ON CONFLICT DO
 * NOTHING) — admin edits are never overwritten.
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

export const FEATURE_ELIGIBILITY_DEFAULTS = {
  // CRM — people, contacts, duplicates, bulk import
  crm: [
    "super_admin",
    "staff",
    "program_manager",
    "developer",
  ],
  // Communication — messaging, announcements, forms
  //
  // INVARIANT: a role must be eligible for every feature its OWN default
  // template grants. The default templates seeded by seedDefaultAccessProfiles
  // include messaging caps for Participant / Mentor / Investor, so those roles
  // belong here — without the row, the whole template fails the ceiling check
  // and can never be saved ("Template contains capabilities the identity is not
  // eligible for").
  communication: [
    "super_admin",
    "staff",
    "program_manager",
    "developer",
    "participant",
    "mentor",
    "investor",
  ],
  // Programs — programs, participants, submissions (facilitator module)
  // Mentor / Investor resolve to the Mentor template, which reads program
  // progress — same invariant as `communication` above.
  programs: [
    "super_admin",
    "staff",
    "program_manager",
    "participant",
    "mentor",
    "investor",
  ],
  // Ventures — incubated businesses (founder eligible for own-venture access).
  ventures: [
    "super_admin",
    "staff",
    "program_manager",
    "investor",
    "founder",
    "member",
  ],
  // Investors — investor relations
  investors: ["super_admin", "staff", "investor"],
  // Finance — budgets, reports
  finance: ["super_admin", "staff"],
  // Operations — projects, tasks, blockers, standups, retros
  // Participant / Mentor / Investor templates carry `projects.view`.
  operations: [
    "super_admin",
    "staff",
    "program_manager",
    "developer",
    "team",
    "participant",
    "mentor",
    "investor",
  ],
  // Reports — reports and analytics
  reports: [
    "super_admin",
    "staff",
    "program_manager",
    "developer",
  ],
  // Knowledge — knowledge base
  knowledge: ["super_admin", "staff", "developer"],
  // LMS — capability-gated course authoring & learning
  lms: ["super_admin", "program_manager", "developer"],
  // Security — user administration + permission matrix
  security: ["super_admin", "staff"],
  // Settings — system configuration + engineering operations
  settings: ["super_admin", "staff", "developer"],
};
