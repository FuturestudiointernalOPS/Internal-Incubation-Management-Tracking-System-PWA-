/**
 * ImpactOS — Authorization Foundation: PERSONA CATALOGUE (SERVICE layer).
 *
 * Phase A of docs/ROADMAP_ROLES_PERSONAS_ACCESS.md. The validation and the
 * normalization behind the persona administration API
 * (GET/PUT /api/engineering/permissions/personas). No SQL, no HTTP here: the
 * reads/writes live in `@/models/authorization/personasStore`, and the pure
 * vocabulary in `@/models/authorization/persona-catalog`.
 *
 * Semantics:
 *   - allowed_roles is the LIST of baseline roles that may hold the persona,
 *     initial value from the catalogue. `[]` is a real state ("explicitly
 *     nobody"), never confused with "not configured".
 *   - is_active toggles the whole persona without deleting it.
 */

import {
  PERSONA_BASELINE_ROLES,
  PERSONA_CATALOG,
  PERSONA_CONTEXTS,
  PERSONA_KEYS,
  getPersonaDefinition,
  isValidPersonaContext,
  isValidPersonaKey,
} from "@/models/authorization/persona-catalog";

export {
  PERSONA_BASELINE_ROLES,
  PERSONA_CATALOG,
  PERSONA_CONTEXTS,
  PERSONA_KEYS,
  getPersonaDefinition,
  isValidPersonaContext,
  isValidPersonaKey,
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
 * Validate + normalize one persona edit.
 *
 * @param {{key: string, allowed_roles: unknown, is_active?: unknown}} input
 * @returns {{valid: boolean, errors: string[], normalized: {key, allowed_roles, is_active}}}
 *   `allowed_roles` is de-duplicated; unknown roles and unknown keys are
 *   rejected (the catalogue is the vocabulary, not free text).
 */
export function validatePersonaUpdate({ key, allowed_roles, is_active } = {}) {
  const errors = [];
  const personaKey = String(key ?? "");

  if (!isValidPersonaKey(personaKey)) {
    errors.push(`unknown persona: ${personaKey}`);
  }

  const roles = normalizeAllowedRoles(allowed_roles);
  const unknown = roles.filter((role) => !PERSONA_BASELINE_ROLES.includes(role));
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
      key: personaKey,
      allowed_roles: [...new Set(roles)],
      is_active: is_active === undefined ? true : Boolean(is_active),
    },
  };
}
