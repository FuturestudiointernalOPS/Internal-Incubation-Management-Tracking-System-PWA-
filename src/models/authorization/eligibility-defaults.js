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
 * These only fill rows that have never been configured (ON CONFLICT DO
 * NOTHING) — admin edits are never overwritten.
 */
export const FEATURE_ELIGIBILITY_DEFAULTS = {
  crm: [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
  ],
  communication: [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
  ],
  finance: ["super_admin", "staff"],
  program_management: ["super_admin", "staff", "program_manager", "teacher", "participant"],
  project_ownership: [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
  ],
  operations: ["super_admin", "staff", "program_manager", "teacher", "developer"],
  reporting: [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
  ],
  knowledge_base: ["super_admin", "staff"],
  intelligence: ["super_admin", "developer"],
  engineering: ["super_admin", "developer"],
  user_management: ["super_admin", "staff"],
  system_settings: ["super_admin", "staff"],
  tasks: ["super_admin", "staff", "program_manager", "team"],
  // P1: founder is an official eligibility identity. Ventures is the founder's
  // own-venture feature (venture_own scope) — founders are NOT program
  // participants and gain no participant defaults from this row.
  // Phase 6: "member" is included because a founder is a BASELINE MEMBER with a
  // venture context — the context model cannot work if the feature is
  // ineligible for the baseline identity. Eligibility is only a CEILING:
  // the capability (granted by the relationship) + venture scope still decide.
  ventures: [
    "super_admin",
    "staff",
    "program_manager",
    "investor",
    "founder",
    "member",
  ],
  investor: ["super_admin", "staff", "investor"],
  // LMS: capability-gated authoring feature (view/create/edit/delete only).
  // Program Manager is the default non-SA holder of lms capabilities
  // (previously lms.view + lms.assign); developer is included so a developer
  // granted the LMS responsibility can open the /admin course pages. The
  // publish/enroll/assign capabilities were retired from the module
  // (see backfill.js) and can never be granted again.
  lms: ["super_admin", "program_manager", "developer"],
};
