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
export const FEATURE_ELIGIBILITY_DEFAULTS = {
  // CRM — people, contacts, duplicates, bulk import
  crm: [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
  ],
  // Communication — messaging, announcements, forms
  communication: [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
  ],
  // Programs — programs, participants, submissions (facilitator module)
  programs: ["super_admin", "staff", "program_manager", "teacher", "participant"],
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
  operations: [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
    "team",
  ],
  // Reports — reports and analytics
  reports: [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
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
