/**
 * ImpactOS — Authorization Foundation: PROFILE CATALOGUE (SERVICE layer).
 *
 * Phases A + B of docs/ROADMAP_ROLES_PROFILES_ACCESS.md. The validation and the
 * normalization behind the profile administration API
 * (GET/PUT /api/engineering/permissions/profiles), plus the pure profile ↔ role
 * rule (Phase B) the attribution paths consult. No HTTP here: the reads/writes
 * live in `@/models/authorization/profilesStore`, and the pure vocabulary in
 * `@/models/authorization/profile-catalog`.
 *
 * Semantics:
 *   - allowed_roles is the LIST of baseline roles that may hold the profile,
 *     initial value from the catalogue. `[]` is a real state ("explicitly
 *     nobody"), never confused with "not configured".
 *   - is_active toggles the whole profile without deleting it.
 *   - `evaluateProfileRoleFit` is the DECISION of the profile ↔ role rule; it
 *     blocks nothing on its own. `PROFILE_ROLE_ENFORCEMENT` ("block" since
 *     Phase H) is read through `profileRoleGateDecision`, which the automatic
 *     context reconcile and the manual responsibility assignment both call.
 */

import {
  PROFILE_BASELINE_ROLES,
  PROFILE_CATALOG,
  PROFILE_CONTEXTS,
  PROFILE_KEYS,
  PROFILE_ROLE_ENFORCEMENT,
  getProfileDefinition,
  isValidProfileContext,
  isValidProfileKey,
} from "@/models/authorization/profile-catalog";
import { ensureProfilesSchema, getProfileRow } from "@/models/authorization/profilesStore";
import { getContactBaseState } from "@/models/authorization/baseCapabilityReads";

export {
  PROFILE_BASELINE_ROLES,
  PROFILE_CATALOG,
  PROFILE_CONTEXTS,
  PROFILE_KEYS,
  PROFILE_ROLE_ENFORCEMENT,
  getProfileDefinition,
  isValidProfileContext,
  isValidProfileKey,
};

/**
 * Normalize a stored allowed_roles value (a JSON string from the driver, an
 * array, or null) into an array of role strings.
 */
export function normalizeAllowedRoles(value) {
  if (Array.isArray(value)) return value.map((role) => String(role));
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((role) => String(role)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * A profile key is a free identifier (profiles are DYNAMIC since the takeover):
 * lowercase, digits and underscores. It is the stable identity of the profile,
 * so it is validated by SHAPE — the fixed catalogue is no longer the vocabulary.
 */
export const PROFILE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

/** True when a value is a well-formed profile key. */
export function isValidProfileKeyShape(key) {
  return PROFILE_KEY_PATTERN.test(String(key ?? ""));
}

/**
 * Validate + normalize one profile edit.
 *
 * @param {{key: string, allowed_roles: unknown, is_active?: unknown}} input
 * @returns {{valid: boolean, errors: string[], normalized: {key, allowed_roles, is_active}}}
 *   `allowed_roles` is de-duplicated; unknown roles are rejected (the baseline
 *   roles are the fixed vocabulary), and the key must be well-formed. Existence
 *   is the ROUTE's check (it owns the database read).
 */
export function validateProfileUpdate({ key, allowed_roles, is_active } = {}) {
  const errors = [];
  const profileKey = String(key ?? "");

  if (!isValidProfileKeyShape(profileKey)) {
    errors.push(`invalid profile key: ${profileKey}`);
  }

  const roles = normalizeAllowedRoles(allowed_roles);
  const unknown = roles.filter((role) => !PROFILE_BASELINE_ROLES.includes(role));
  if (unknown.length > 0) {
    errors.push(`unknown roles: ${unknown.join(", ")}`);
  }

  if (
    is_active !== undefined &&
    typeof is_active !== "boolean" &&
    is_active !== 0 &&
    is_active !== 1
  ) {
    errors.push("is_active must be a boolean");
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      key: profileKey,
      allowed_roles: [...new Set(roles)],
      is_active: is_active === undefined ? true : Boolean(is_active),
    },
  };
}

/**
 * Validate + normalize the creation of a NEW profile. Same rules as an edit,
 * plus a required display label and a known context.
 */
export function validateProfileCreate({ key, label, context, allowed_roles } = {}) {
  const base = validateProfileUpdate({ key, allowed_roles });
  const errors = [...base.errors];
  const labelText = typeof label === "string" ? label.trim() : "";
  if (!labelText) errors.push("label is required");
  if (!PROFILE_CONTEXTS.includes(String(context ?? ""))) {
    errors.push(`unknown context: ${context}`);
  }
  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      key: base.normalized.key,
      label: labelText.slice(0, 120),
      context: String(context ?? ""),
      allowed_roles: base.normalized.allowed_roles,
    },
  };
}

// ── Phase B — the profile ↔ role rule (docs/ROADMAP_ROLES_PROFILES_ACCESS.md) ──

/**
 * Is a profile active? Accepts a catalogue definition (no flag → active) and a
 * stored row (`is_active` 1/0 or a boolean).
 */
function profileIsActive(profile) {
  const raw = profile?.isActive ?? profile?.is_active;
  if (raw === undefined || raw === null) return true;
  return raw === true || Number(raw) === 1;
}

/** The stored-or-catalogue allowed roles of a profile-shaped object. */
function profileAllowedRoles(profile) {
  return normalizeAllowedRoles(profile?.allowedRoles ?? profile?.allowed_roles);
}

/**
 * The profile ↔ role rule (PURE).
 *
 * A profile is open only to the baseline roles its `allowed_roles` lists. This
 * is the DECISION only — nothing here blocks anything: the two control points
 * report or refuse the écart according to `PROFILE_ROLE_ENFORCEMENT` ("block"
 * since Phase H).
 *
 * `profile` may be a catalogue definition (`allowedRoles`) or a stored row
 * (`allowed_roles`, `is_active`). Super Admin bypasses the restriction
 * altogether (docs/ROADMAP_ROLES_PROFILES_ACCESS.md §0.5: "le Super Admin reste
 * hors plafond"), so it is never an écart.
 *
 * @param {{allowedRoles?: string[], allowed_roles?: unknown, isActive?: boolean,
 *   is_active?: number|boolean}|null|undefined} profile
 * @param {string|null|undefined} role  the baseline role on `contacts.role`
 * @returns {{allowed: boolean, reason: 'ok'|'role-not-allowed'|'profile-inactive'}}
 */
export function evaluateProfileRoleFit(profile, role) {
  if (!profileIsActive(profile)) {
    return { allowed: false, reason: "profile-inactive" };
  }

  const baselineRole = String(role ?? "");
  if (baselineRole === "super_admin") return { allowed: true, reason: "ok" };

  if (!profileAllowedRoles(profile).includes(baselineRole)) {
    return { allowed: false, reason: "role-not-allowed" };
  }
  return { allowed: true, reason: "ok" };
}

/**
 * The profile a (context, roleKey) pair names, or null when the pair carries no
 * profile. The automatic reconcile speaks in `(context, roleKey)` and the three
 * supported couples (`venture:founder`, `program:facilitator`,
 * `program:program_manager`) are exactly the profile keys, so the mapping is
 * the catalogue's own context.
 */
export function profileKeyForContextRole(context, roleKey) {
  const definition = getProfileDefinition(roleKey);
  if (!definition) return null;
  return definition.context === String(context || "") ? definition.key : null;
}

/**
 * The role restriction to apply for a profile KEY: the administrator's stored
 * row when the catalogue table exists, the catalogue definition otherwise. A
 * read failure is soft — the catalogue is the fallback, never a crash, because
 * both control points run on hot paths.
 *
 * @returns {Promise<{key: string, allowedRoles: string[], isActive: boolean}|null>}
 */
export async function loadProfileRestriction(profileKey) {
  const definition = getProfileDefinition(profileKey);
  if (!definition) return null;
  try {
    await ensureProfilesSchema();
    const res = await getProfileRow(profileKey);
    const row = res?.rows?.[0];
    if (row) {
      return {
        key: definition.key,
        allowedRoles: normalizeAllowedRoles(row.allowed_roles),
        isActive: profileIsActive(row),
      };
    }
  } catch (error) {
    console.warn(
      `[Authz] loadProfileRestriction(${profileKey}) fell back to the catalogue:`,
      error.message,
    );
  }
  return {
    key: definition.key,
    allowedRoles: [...definition.allowedRoles],
    isActive: true,
  };
}

/** The baseline role on `contacts.role` for a cid, or null when unknown. */
export async function loadBaselineRole(cid) {
  if (!cid) return null;
  try {
    const res = await getContactBaseState(String(cid));
    return res?.rows?.[0]?.role ?? null;
  } catch (error) {
    console.warn(`[Authz] loadBaselineRole(${cid}) failed:`, error.message);
    return null;
  }
}

/**
 * Build the profile ↔ role écart for one assignment, or null when the profile
 * is unknown, unconfigured, or the role fits.
 *
 * @param {{profileKey?: string|null, cid?: string|null, role?: string|null}} args
 *   pass `role` to avoid a read; otherwise it is read from `cid`.
 * @returns {Promise<{profile, role, reason}|null>} the écart, never an effect
 */
export async function buildProfileRoleGap({ profileKey, cid = null, role } = {}) {
  if (!profileKey) return null;
  const restriction = await loadProfileRestriction(profileKey);
  if (!restriction) return null;
  const baselineRole = role !== undefined ? role : await loadBaselineRole(cid);
  const fit = evaluateProfileRoleFit(restriction, baselineRole);
  if (fit.allowed) return null;
  return { profile: restriction.key, role: baselineRole ?? null, reason: fit.reason };
}

/**
 * The switch, as a decision. Both control points turn an écart into a block or
 * a report through this one function, so Phase H only flips
 * `PROFILE_ROLE_ENFORCEMENT` — never a call site's logic.
 *
 * @param {object|null} gap  the écart from `buildProfileRoleGap`
 * @param {string} [mode]  defaults to the live constant
 * @returns {{blocked: boolean, gap: object|null, mode: string}}
 */
export function profileRoleGateDecision(gap, mode = PROFILE_ROLE_ENFORCEMENT) {
  return { blocked: Boolean(gap) && mode === "block", gap: gap || null, mode };
}
