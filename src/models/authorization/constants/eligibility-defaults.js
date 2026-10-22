/**
 * ImpactOS — Authorization Foundation: FEATURE ELIGIBILITY DEFAULTS
 *
 * Pure constants ONLY (no db import, no side effects). The per-feature
 * allowlists the eligibility seed writes (`../eligibility.js` —
 * feature_eligibility rows), the Responsibility Access defaults
 * (`src/lib/featureAccess.js`), and the assignment-derived seed rows.
 * The model-consistency tests keep roles within ROLE_CATALOG.
 *
 * TWO allowlists, split by IDENTITY KIND:
 *
 *   - `FEATURE_ELIGIBILITY_DEFAULTS` — the BASELINE roles only (`super_admin`,
 *     `staff`, `member`). These are the only labels a person's account carries.
 *   - `FEATURE_ELIGIBILITY_PROFILE_DEFAULTS` — every CONTEXTUAL function
 *     (`program_manager`, `participant`, `investor`, `founder`, `facilitator`, …).
 *     A profile lives in its catalogue and on the person's assignment cards, so
 *     its ceiling is written against `identity_type = 'profile'`, never against
 *     a role the account does not carry. The legacy role labels (`mentor`,
 *     `team`, …) are gone: their function is a profile now.
 *
 * These only fill rows that have never been configured (ON CONFLICT DO
 * NOTHING) — admin edits are never overwritten.
 */

/**
 * The BASELINE-role ceilings. Only the three identities the account itself can
 * carry: `super_admin`, `staff`, `member`. Every contextual function is a
 * profile (see `FEATURE_ELIGIBILITY_PROFILE_DEFAULTS`); legacy role labels
 * (`mentor`, `team`, …) are gone from this list.
 */
export const FEATURE_ELIGIBILITY_DEFAULTS = {
  // CRM — people, contacts, duplicates, bulk import
  crm: ["super_admin", "staff"],
  // Communication — messaging, announcements, forms. The contextual functions
  // that read messaging (mentor) are PROFILES now, so their ceiling rides the
  // profile identity (see `FEATURE_ELIGIBILITY_PROFILE_DEFAULTS`). Only the
  // baseline roles remain on the role list.
  communication: ["super_admin", "staff"],
  // Programs — programs, participants, submissions (facilitator module).
  // `member` is the baseline the assignment-derived model resolves to.
  programs: ["super_admin", "staff", "member"],
  // Ventures — incubated businesses. `member` carries the venture context.
  ventures: ["super_admin", "staff", "member"],
  // Investors — investor relations
  investors: ["super_admin", "staff"],
  // Finance — budgets, reports
  finance: ["super_admin", "staff"],
  // Operations — projects, tasks, blockers, standups, retros. The templates that
  // carried `projects.view` (team / mentor) are PROFILES now.
  operations: ["super_admin", "staff"],
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
  communication: ["program_manager", "participant", "investor"],
  programs: ["program_manager", "participant", "facilitator"],
  ventures: ["program_manager", "investor", "founder"],
  investors: ["investor"],
  operations: ["program_manager", "participant", "investor"],
  reports: ["program_manager"],
  lms: ["program_manager"],
};

/**
 * Assignment-derived program access: the eligibility rows the per-program
 * assignment model needs on databases that bootstrapped before it existed.
 *
 * A facilitator / program manager receives capabilities from the program
 * assignment (Context Roles → profile → additive grants). Eligibility is
 * checked BEFORE capability and fails closed, so without these rows the grant
 * would look inert and the person would be refused — the opposite of the
 * "already in production, must not be blocked" requirement.
 *
 * Insert-only (ON CONFLICT DO NOTHING): an administrator's decision — including
 * an explicit deny — is never overwritten. MIRRORS FEATURE_ELIGIBILITY_DEFAULTS.programs.
 */
export const PROGRAM_ASSIGNMENT_ROWS = {
  programs: ["member"],
};
