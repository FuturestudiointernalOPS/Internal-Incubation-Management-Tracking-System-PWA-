/**
 * ImpactOS — Authorization Foundation: FEATURE ELIGIBILITY DEFAULTS
 *
 * Pure constants ONLY (no db import, no side effects). This module is the
 * single source of truth for the per-feature allowlists used by:
 *
 *   - the eligibility seed (`./eligibility.js` — feature_eligibility rows),
 *   - the Responsibility Access defaults (`src/lib/featureAccess.js`),
 *   - the model-consistency tests (roles must stay within ROLE_CATALOG).
 *
 * FEATURES = the dashboard sections (CRM, Communication, Programs, …). Their
 * modules are the sub-sections (see MODULE_TO_FEATURE).
 *
 * TWO allowlists, split by IDENTITY KIND (Phase H vocabulary cleanup):
 *
 *   - `FEATURE_ELIGIBILITY_DEFAULTS` — the BASELINE roles and the remaining
 *     non-profile values (`mentor`, `team`). This is the role vocabulary; every
 *     entry is a label the person's account can carry.
 *   - `FEATURE_ELIGIBILITY_PROFILE_DEFAULTS` — the CONTEXTUAL profiles
 *     (`program_manager`, `participant`, `investor`, `founder`, `facilitator`).
 *     A profile lives in its catalogue and on the person's assignment cards, so
 *     its ceiling is written against `identity_type = 'profile'`, never against
 *     a role the account does not carry.
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

/**
 * The BASELINE-role ceilings. Only identities the account itself can carry:
 * `super_admin`, `staff`, `member`, plus the two non-profile legacy labels that
 * still own a seeded template (`mentor`, `team`). A contextual function is NOT
 * here — it is a profile (see `FEATURE_ELIGIBILITY_PROFILE_DEFAULTS`).
 */
export const FEATURE_ELIGIBILITY_DEFAULTS = {
  // CRM — people, contacts, duplicates, bulk import
  crm: ["super_admin", "staff"],
  // Communication — messaging, announcements, forms. `mentor` owns the Mentor
  // template, whose caps include messaging: a role must be eligible for every
  // feature its own template grants, or the whole template fails the ceiling
  // check and can never be saved.
  communication: ["super_admin", "staff", "mentor"],
  // Programs — programs, participants, submissions (facilitator module).
  // `member` is the baseline the assignment-derived model resolves to; `mentor`
  // reads program progress (same template invariant as `communication`).
  programs: ["super_admin", "staff", "mentor", "member"],
  // Ventures — incubated businesses. `member` carries the venture context.
  ventures: ["super_admin", "staff", "member"],
  // Investors — investor relations
  investors: ["super_admin", "staff"],
  // Finance — budgets, reports
  finance: ["super_admin", "staff"],
  // Operations — projects, tasks, blockers, standups, retros.
  // `team` and `mentor` own templates carrying `projects.view`.
  operations: ["super_admin", "staff", "team", "mentor"],
  // Reports — reports and analytics
  reports: ["super_admin", "staff"],
  // Knowledge — knowledge base
  knowledge: ["super_admin", "staff"],
  // LMS — capability-gated course authoring & learning
  lms: ["super_admin"],
  // Security — user administration + permission matrix
  security: ["super_admin", "staff"],
  // Settings — system configuration + engineering operations
  settings: ["super_admin", "staff"],
};

/**
 * The PROFILE ceilings — a contextual function is eligible through the profile
 * it HOLDS (Phase D), never through a role label on the account. Every entry
 * mirrors a value the role list used to carry, so moving it here preserves the
 * exact coverage (an assignment card is what makes the profile "active").
 *
 * Seeded insert-only as `identity_type = 'profile'` rows; an administrator's
 * decision is never overwritten.
 */
export const FEATURE_ELIGIBILITY_PROFILE_DEFAULTS = {
  crm: ["program_manager"],
  communication: ["program_manager", "participant", "investor"],
  programs: ["program_manager", "participant", "investor", "facilitator"],
  ventures: ["program_manager", "investor", "founder"],
  investors: ["investor"],
  operations: ["program_manager", "participant", "investor"],
  reports: ["program_manager"],
  lms: ["program_manager"],
};
