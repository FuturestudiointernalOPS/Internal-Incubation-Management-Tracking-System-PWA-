/**
 * ImpactOS — Authorization Foundation: PROFILE CATALOGUE (PURE MODULE).
 *
 * Phase A of docs/ROADMAP_ROLES_PROFILES_ACCESS.md.
 *
 * A PROFILE is the contextual function someone occupies (Participant of a
 * program, Founder of a venture, Facilitator of a program…) as opposed to the
 * BASELINE role on `contacts.role` (super_admin / staff / member), which is the
 * person's platform identity. A person holds ONE baseline role and any number
 * of profiles, each in its own context.
 *
 * No database import — safe to share with client components and tests, exactly
 * like `eligibility-defaults.js`. The `profiles` table mirrors these rows; the
 * seed inserts them with ON CONFLICT DO NOTHING, so an administrator's edit of
 * `allowed_roles` / `is_active` / `notes` always wins.
 *
 * Labels are i18n KEYS, never stored text: every user-visible string must go
 * through `t()` (see AGENTS.md §1), and the capability catalogue follows the
 * same rule.
 */

/** Contexts a profile belongs to — mirrors CONTEXT_ROLE_CONTEXTS. */
export const PROFILE_CONTEXTS = ["program", "venture", "lms", "investor"];

/**
 * The profile ↔ role rule's enforcement switch (Phase B of
 * docs/ROADMAP_ROLES_PROFILES_ACCESS.md).
 *
 *   "warn"  (default) — holding a profile from a baseline role its
 *           `allowed_roles` does not list is REPORTED as an écart, never
 *           blocked: the history still carries legacy profile values on
 *           `contacts.role`, and Phase B must cost nobody their access.
 *   "block" (Phase H) — the same discrepancy refuses the attribution, once the
 *           legacy role values have been cleaned up.
 *
 * Read by both control points (the automatic context reconcile and the manual
 * responsibility assignment). Phase H flips this one constant.
 */
export const PROFILE_ROLE_ENFORCEMENT = "warn";

/**
 * Baseline roles a profile may be restricted to. `super_admin` is a valid value
 * on purpose: the platform owner is never bound by the restriction (they bypass
 * authorization entirely), but a catalogue row stays free to list it.
 */
export const PROFILE_BASELINE_ROLES = ["super_admin", "staff", "member"];

/**
 * The agreed catalogue (Product brief: "Système de rôles, profils et accès").
 * `allowedRoles` is the INITIAL value stored in the table; administrators edit
 * it from the Profiles screen afterwards. The seed never overwrites an edit.
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
