/**
 * ImpactOS — Authorization Foundation: PROFILE CATALOGUE (PURE MODULE).
 *
 * A PROFILE is the contextual function someone occupies (Participant of a
 * program, Founder of a venture, Facilitator of a program…) as opposed to the
 * BASELINE role on `contacts.role` (super_admin / staff / member), which is the
 * person's platform identity. A person holds ONE baseline role and any number
 * of profiles, each in its own context.
 *
 * THE DATABASE IS THE SOURCE OF TRUTH. Profiles are DYNAMIC: they are stored in
 * the `profiles` table and created / edited / deleted from the profiles screen.
 * This module holds only:
 *   - the fixed VOCABULARIES (contexts, baseline roles, the enforcement switch,
 *     the key SHAPE) — enums the code needs, not a list of profiles; and
 *   - an initial SEED (`PROFILE_CATALOG`) that fills a fresh database once.
 * Nothing at runtime reads the catalogue to decide which profiles exist: the
 * eligibility screen, the validation and the restriction lookup all read the
 * `profiles` table (see `profilesStore.listProfiles`).
 *
 * No database import — safe to share with client components and tests, exactly
 * like `eligibility-defaults.js`. The seed inserts with ON CONFLICT DO NOTHING,
 * so an administrator's edit of `allowed_roles` / `is_active` / `notes` — or a
 * profile they created — always wins.
 *
 * Labels are i18n KEYS, never stored text: every user-visible string must go
 * through `t()` (see AGENTS.md §1), and the capability catalogue follows the
 * same rule.
 */

/** Contexts a profile belongs to — mirrors CONTEXT_ROLE_CONTEXTS, plus the two
 * groups the profiles-takeover conversion introduces: `global` (baseline-role
 * profiles) and `staff` (staff personas such as Project Owner). Contexts are a
 * display grouping, not a constraint — a profile's context never decides access. */
export const PROFILE_CONTEXTS = ["program", "venture", "lms", "investor", "global", "staff"];

/**
 * The profile ↔ role rule's enforcement switch (Phases B and H of
 * docs/ROADMAP_ROLES_PROFILES_ACCESS.md).
 *
 *   "warn"  (Phase B) — holding a profile from a baseline role its
 *           `allowed_roles` does not list is REPORTED as an écart, never
 *           blocked: while the history still carried legacy profile values on
 *           `contacts.role`, blocking would have cost people their access.
 *   "block" (Phase H, current) — the same discrepancy REFUSES the attribution.
 *           The legacy role values have been aligned onto the baseline
 *           (scripts/align-legacy-roles.mjs, the survey at
 *           /api/engineering/permissions/legacy-role-cleanup), so every person
 *           is a baseline identity and the profile rule can be strict.
 *
 * Read by both control points (the automatic context reconcile and the manual
 * responsibility assignment). Phase H flipped this one constant.
 */
export const PROFILE_ROLE_ENFORCEMENT = "block";

/**
 * Baseline roles a profile may be restricted to. `super_admin` is a valid value
 * on purpose: the platform owner is never bound by the restriction (they bypass
 * authorization entirely), but a catalogue row stays free to list it.
 */
export const PROFILE_BASELINE_ROLES = ["super_admin", "staff", "member"];

/**
 * The initial SEED (bootstrap). `allowedRoles` is the value inserted into the
 * `profiles` table the first time; administrators edit it — and add or remove
 * profiles — from the Profiles screen afterwards. The seed is insert-only, so it
 * never overwrites an edit, and it is NOT read at runtime to decide which
 * profiles exist.
 */
export const PROFILE_CATALOG = [
  {
    key: "participant",
    labelKey: "engineering.permissions.profileParticipant",
    context: "program",
    allowedRoles: ["member"],
  },
  {
    key: "learner",
    labelKey: "engineering.permissions.profileLearner",
    context: "lms",
    allowedRoles: ["member"],
  },
  {
    key: "founder",
    labelKey: "engineering.permissions.profileFounder",
    context: "venture",
    allowedRoles: ["member"],
  },
  {
    key: "investor",
    labelKey: "engineering.permissions.profileInvestor",
    context: "investor",
    allowedRoles: ["member"],
  },
  {
    key: "facilitator",
    labelKey: "engineering.permissions.profileFacilitator",
    context: "program",
    allowedRoles: ["staff", "member"],
  },
  {
    key: "program_manager",
    labelKey: "engineering.permissions.profileProgramManager",
    context: "program",
    allowedRoles: ["staff"],
  },
  {
    key: "venture_manager",
    labelKey: "engineering.permissions.profileVentureManager",
    context: "venture",
    allowedRoles: ["staff"],
  },
];

export const PROFILE_KEYS = PROFILE_CATALOG.map((profile) => profile.key);

/**
 * A profile key is a FREE identifier (profiles are DYNAMIC): lowercase letters,
 * digits and underscores, 2-64 chars, starting with a letter. `isValidProfileKey`
 * checks the *seeded* catalogue; this checks the SHAPE, which is what any
 * profile created from the profiles screen must satisfy.
 */
export const PROFILE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export function isValidProfileKeyShape(key) {
  return PROFILE_KEY_PATTERN.test(String(key ?? ""));
}

/** The catalogue entry for a key, or null when the key is unknown. */
export function getProfileDefinition(key) {
  return PROFILE_CATALOG.find((profile) => profile.key === String(key || "")) || null;
}

/** True when the key names a profile this build knows. */
export function isValidProfileKey(key) {
  return PROFILE_KEYS.includes(String(key || ""));
}

/** True when the value is one of the profile contexts. */
export function isValidProfileContext(context) {
  return PROFILE_CONTEXTS.includes(String(context || ""));
}

/**
 * The BASELINE identity a legacy `contacts.role` value carrying this profile
 * must be aligned onto (Phase H), so the profile stays OPEN to the person.
 *
 * A staff-only profile (program_manager, venture_manager) aligns to `staff`;
 * every other profile is open to the member baseline (or to both) and aligns to
 * `member`. An UNKNOWN value is not a profile: the caller falls back to the
 * member default. This is the inverse of `allowed_roles`, kept beside the
 * catalogue so the two can never disagree.
 *
 * @param {string} key
 * @returns {"super_admin"|"staff"|"member"|null}
 */
export function baselineRoleForProfile(key) {
  const definition = getProfileDefinition(key);
  if (!definition) return null;
  const allowed = definition.allowedRoles || [];
  if (allowed.includes("member")) return "member";
  if (allowed.includes("staff")) return "staff";
  return "member";
}
