/**
 * PHASE I2 — Identity model helpers (pure).
 *
 * The identity correction: exactly three GLOBAL baseline identities
 * (super_admin, staff, member). Everything else is contextual. Until the
 * legacy role gates migrate (I5), a transitional DERIVED legacy role keeps
 * old consumers working while `contacts.role` stops being mutated on
 * context join (I2 mutation-stop).
 *
 * Flags (env, default OFF → current behavior unchanged):
 *   IDENTITY_STOP_ROLE_MUTATION=1  — context joins no longer rewrite
 *                                    contacts.role (mutation-stop sites).
 *   IDENTITY_DERIVE_LEGACY_ROLE=1  — session creation derives the legacy
 *                                    role from memberships when the stored
 *                                    role is a baseline (transitional view).
 *
 * Derivation rule (transitional, single legacy role; replaced by the
 * multi-context resolver in I3): member → participant (any active program
 * membership) → founder (active venture owner) → member. Staff and Super
 * Admin are never derived. Stored contextual values (legacy rows) pass
 * through unchanged.
 */

export const BASELINE_IDENTITIES = ["super_admin", "staff", "member"];

/** True when the stored role is one of the three baseline identities. */
export function isBaselineIdentity(role) {
  return BASELINE_IDENTITIES.includes(role);
}

/** Read a Phase-I2 identity flag (default OFF). */
export function identityFlag(name) {
  return process.env[name] === "1";
}

export function stopRoleMutationEnabled() {
  return identityFlag("IDENTITY_STOP_ROLE_MUTATION");
}

export function deriveLegacyRoleEnabled() {
  return identityFlag("IDENTITY_DERIVE_LEGACY_ROLE");
}

/**
 * Transitional legacy-role derivation.
 *
 * @param {Object} args
 * @param {string} args.storedRole  contacts.role
 * @param {boolean} [args.hasActiveParticipantProgram]
 * @param {boolean} [args.isActiveVentureOwner]
 * @returns {string} the role legacy gates should see
 */
export function deriveLegacyRole({
  storedRole,
  hasActiveParticipantProgram = false,
  isActiveVentureOwner = false,
}) {
  // Legacy contextual rows (already-mutated accounts) pass through unchanged —
  // they keep working until I5 migrates their surfaces.
  if (!isBaselineIdentity(storedRole)) return storedRole;
  if (storedRole !== "member") return storedRole; // staff / super_admin
  if (hasActiveParticipantProgram) return "participant";
  if (isActiveVentureOwner) return "founder";
  return "member";
}
