/**
 * ImpactOS — Authorization Foundation: PERSONA CATALOGUE (PURE MODULE).
 *
 * Phase A of docs/ROADMAP_ROLES_PERSONAS_ACCESS.md.
 *
 * A PERSONA is the contextual function someone occupies (Participant of a
 * program, Founder of a venture, Facilitator of a program…) as opposed to the
 * BASELINE role on `contacts.role` (super_admin / staff / member), which is the
 * person's platform identity. A person holds ONE baseline role and any number
 * of personas, each in its own context.
 *
 * No database import — safe to share with client components and tests, exactly
 * like `eligibility-defaults.js`. The `personas` table mirrors these rows; the
 * seed inserts them with ON CONFLICT DO NOTHING, so an administrator's edit of
 * `allowed_roles` / `is_active` / `notes` always wins.
 *
 * Labels are i18n KEYS, never stored text: every user-visible string must go
 * through `t()` (see AGENTS.md §1), and the capability catalogue follows the
 * same rule.
 */

/** Contexts a persona belongs to — mirrors CONTEXT_ROLE_CONTEXTS. */
export const PERSONA_CONTEXTS = ["program", "venture", "lms", "investor"];

/**
 * Baseline roles a persona may be restricted to. `super_admin` is a valid value
 * on purpose: the platform owner is never bound by the restriction (they bypass
 * authorization entirely), but a catalogue row stays free to list it.
 */
export const PERSONA_BASELINE_ROLES = ["super_admin", "staff", "member"];

/**
 * The agreed catalogue (Product brief: "Système de rôles, profils et accès").
 * `allowedRoles` is the INITIAL value stored in the table; administrators edit
 * it from the Personas screen afterwards. The seed never overwrites an edit.
 */
export const PERSONA_CATALOG = [
  {
    key: "participant",
    labelKey: "engineering.permissions.personaParticipant",
    context: "program",
    allowedRoles: ["member"],
  },
  {
    key: "learner",
    labelKey: "engineering.permissions.personaLearner",
    context: "lms",
    allowedRoles: ["member"],
  },
  {
    key: "founder",
    labelKey: "engineering.permissions.personaFounder",
    context: "venture",
    allowedRoles: ["member"],
  },
  {
    key: "investor",
    labelKey: "engineering.permissions.personaInvestor",
    context: "investor",
    allowedRoles: ["member"],
  },
  {
    key: "facilitator",
    labelKey: "engineering.permissions.personaFacilitator",
    context: "program",
    allowedRoles: ["staff", "member"],
  },
  {
    key: "program_manager",
    labelKey: "engineering.permissions.personaProgramManager",
    context: "program",
    allowedRoles: ["staff"],
  },
  {
    key: "venture_manager",
    labelKey: "engineering.permissions.personaVentureManager",
    context: "venture",
    allowedRoles: ["staff"],
  },
];

export const PERSONA_KEYS = PERSONA_CATALOG.map((persona) => persona.key);

/** The catalogue entry for a key, or null when the key is unknown. */
export function getPersonaDefinition(key) {
  return PERSONA_CATALOG.find((persona) => persona.key === String(key || "")) || null;
}

/** True when the key names a persona this build knows. */
export function isValidPersonaKey(key) {
  return PERSONA_KEYS.includes(String(key || ""));
}

/** True when the value is one of the persona contexts. */
export function isValidPersonaContext(context) {
  return PERSONA_CONTEXTS.includes(String(context || ""));
}
