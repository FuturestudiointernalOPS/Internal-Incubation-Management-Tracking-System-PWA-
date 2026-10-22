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

/** Entity logins (a team is the account, not a person's role). */
export const ENTITY_IDENTITIES = ["team"];

/**
 * Contextual values still accepted at sign-in: NONE.
 *
 * The four legacy labels are now normalized to `member` at sign-in, and their
 * function comes from the contextual PROFILE. The array and its readers stay so
 * the vocabulary is still declared in one place — and so a stored legacy row is
 * still recognised (and normalized) rather than refused.
 */
export const LEGACY_CONTEXTUAL_IDENTITIES = [];

/** The labels the migration normalized. Kept for stored-row recognition only. */
export const RETIRED_CONTEXTUAL_LABELS = [
  "participant",
  "facilitator",
  "investor",
  "founder",
];

/** Every value the sign-in resolver can produce in the current vocabulary. */
export const LOGIN_IDENTITIES = [
  ...BASELINE_IDENTITIES,
  ...ENTITY_IDENTITIES,
  ...LEGACY_CONTEXTUAL_IDENTITIES,
];

export const PLATFORM_OWNER_ROLE = "super_admin";
export const INTERNAL_STAFF_ROLE = "staff";
export const PROGRAM_MANAGER_ROLE = "program_manager";
export const PROGRAM_MANAGER_PROFILE = "program_manager";

/** Normalized role label. */
export function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

/** True when the stored role is one of the three baseline identities. */
export function isBaselineIdentity(role) {
  return BASELINE_IDENTITIES.includes(normalizeRole(role));
}

/** D-2 — the platform owner family. */
export function isPlatformOwnerRole(role) {
  return normalizeRole(role) === PLATFORM_OWNER_ROLE;
}

/** D-2 — the internal staff family. */
export function isInternalStaffRole(role) {
  return normalizeRole(role) === INTERNAL_STAFF_ROLE;
}

/** D-2 — transitional value: a legacy session or an unaligned contact row. */
export function isLegacyProgramManagerRole(role) {
  return normalizeRole(role) === PROGRAM_MANAGER_ROLE;
}

/**
 * D-2 — does this value carry a given CONTEXTUAL label?
 *
 * Display and relationship rules (messaging visibility, contact filters) still
 * ask "is this person a participant / a founder?" while stored contact rows may
 * still carry the retired label. They ask it here, once, instead of comparing the
 * label inline: the comparison lives in the identity layer, and a caller reads
 * a named question.
 */
export function carriesContextualValue(role, value) {
  return normalizeRole(role) === normalizeRole(value);
}

/**
 * ONE normalization before any WRITE of an identity.
 *
 * A retired contextual label is a FUNCTION now, carried by a profile. Writing it
 * back to `contacts.role` would recreate the profile ↔ role mismatch the
 * migration just removed (the profile is only assignable to `member`). Every
 * creation and approval path runs the value through here.
 *
 * Values that are not retired identities (member, staff, super_admin, team,
 * applicant, unassigned…) pass through unchanged.
 */
export function normalizeIdentityForStorage(role) {
  const value = normalizeRole(role);
  if (RETIRED_CONTEXTUAL_LABELS.includes(value)) return "member";
  return role;
}

/**
 * D-2 — the PERSONAL surface family (a person, not a staff function).
 *
 * These identity values share the participant shell, its copy and its profile
 * link. The shell asked the question three times with an inline list; it asks
 * it here once.
 */
export const MEMBER_SURFACE_VALUES = ["participant", "member", "founder"];

export function isMemberSurfaceRole(role) {
  return MEMBER_SURFACE_VALUES.includes(normalizeRole(role));
}

/**
 * D-2 — the MEMBER identity: the baseline `member`, plus the legacy
 * `participant` value while it is still produced at sign-in.
 *
 * Deliberately distinct from `isMemberSurfaceRole`: a FOUNDER shares the
 * personal shell but is not a member identity — it may not submit as a
 * participant, and it does not become one by sharing a sidebar.
 */
export function isMemberIdentityRole(role) {
  return normalizeRole(role) === "member" || carriesContextualValue(role, "participant");
}

/**
 * D-2 — the staff FAMILY: the platform owner, internal staff, and the legacy
 * program-manager value while the D-1 rollback window is open.
 *
 * "Privileged" used to be written as an inline array in several places (the
 * calendar's venture scope, the internal-operations surfaces). It is one
 * question, so it is one function.
 */
export function isInternalStaffFamilyRole(role) {
  return (
    isPlatformOwnerRole(role) ||
    isInternalStaffRole(role) ||
    isLegacyProgramManagerRole(role)
  );
}

/**
 * D-1/D-2 — does this person hold a given CONTEXTUAL profile?
 *
 * A function is a PROFILE, not a role: a program manager is baseline `staff`
 * carrying the `program_manager` profile. Screens that mirror a
 * profile-specific rule ask this question with the list the server resolved,
 * never by reading the role label.
 */
export function holdsProfile(profiles, key) {
  const wanted = normalizeRole(key);
  return Array.isArray(profiles) && profiles.some((entry) => normalizeRole(entry) === wanted);
}

/**
 * D-1 — should a program-manager identity be resolved as baseline STAFF?
 *
 * The target is `staff` + the `program_manager` PROFILE. The profile coverage
 * audit is clean and the role-only call sites are migrated (Lot 1.3), so this
 * is the default. `AUTHZ_PM_IDENTITY=role` is the explicit rollback switch for
 * one deployment if an unexpected caller still reads the legacy label.
 */
export function programManagerIdentityMode() {
  return process.env.AUTHZ_PM_IDENTITY === "role" ? "role" : "staff";
}

/** The resolved identity for a stored `program_manager` role. */
export function resolveProgramManagerIdentity(role) {
  if (!isLegacyProgramManagerRole(role)) return role;
  return programManagerIdentityMode() === "staff"
    ? INTERNAL_STAFF_ROLE
    : PROGRAM_MANAGER_ROLE;
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
 * Transitional legacy-role derivation (kept for the I2 flag).
 *
 * There is nothing left to derive: the relationship that used to become a
 * `participant` / `founder` label is a contextual PROFILE now. A baseline
 * identity is returned unchanged, and a retired label is normalized to `member`.
 *
 * @param {{storedRole: string}} args
 * @returns {string} the role legacy gates should see
 */
export function deriveLegacyRole({ storedRole }) {
  if (isBaselineIdentity(storedRole)) return storedRole;
  if (RETIRED_CONTEXTUAL_LABELS.includes(normalizeRole(storedRole))) return "member";
  return storedRole;
}
