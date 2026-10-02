/**
 * RESPONSIBILITY CATALOG DECISIONS (SERVICE layer).
 *
 * The catalog routes (`/api/responsibilities` and `/api/responsibilities/access`)
 * decided two things inline that are pure policy:
 *   - WHICH fields a PUT writes (and, critically, that an absent field writes
 *     nothing while an explicit `null` is a deliberate clear);
 *   - what `allowed_roles` MEANS — `null` is "not configured, use the seed
 *     defaults" while `[]` is a real state meaning "explicitly nobody". The two
 *     are not interchangeable, and conflating them silently locks a feature.
 *
 * Both move here; the routes keep the HTTP shaping.
 *
 * Rules, unchanged:
 *   - A PUT only touches the fields present in the body. The guard is
 *     `!== undefined`, never truthiness: `null`, `false` and `0` are deliberate
 *     values and are written.
 *   - The write order is fixed (name, key, description, icon, is_active) so an
 *     `updated_at` ordering and any future audit replay stay deterministic.
 *   - `allowed_roles`: `null`/`undefined` → store NULL (seed defaults apply).
 *     Otherwise → store a JSON array of unique non-empty strings, preserving
 *     order. A list that cleans down to nothing stores `"[]"`, never NULL:
 *     "nobody" is a decision.
 *   - DELETE counts assignments before deleting, and reports the count. The
 *     count is a REPORT for the UI, not a guard — the delete proceeds and the
 *     cascade handles the rows.
 *
 * Every statement is in `@/models/responsibilities` (the repository); nothing
 * here runs SQL and nothing here builds a Response.
 */

/**
 * The writable fields, in the order the PUT applies them. A field is written
 * only when it is present (`!== undefined`).
 */
export const RESPONSIBILITY_FIELDS = [
  "name",
  "key",
  "description",
  "icon",
  "is_active",
];

/**
 * Which fields a body actually carries, in the fixed write order.
 *
 * @param {Object} body
 * @returns {string[]} present field names, ordered
 */
export function presentResponsibilityFields(body) {
  return RESPONSIBILITY_FIELDS.filter((field) => body?.[field] !== undefined);
}

/**
 * Resolves what to store in `responsibility.allowed_roles`.
 *
 * @param {string[]|null|undefined} rawRoles
 * @returns {{ok: true, value: string|null} | {ok: false, error: string}}
 *   `value` is a JSON string to persist, or `null` to reset to the seed
 *   defaults. Returns `ok: false` only when a non-array, non-null value is
 *   supplied — the caller answers 400.
 */
export function resolveAllowedRolesValue(rawRoles) {
  if (rawRoles === null || rawRoles === undefined) {
    // Explicit reset → back to NULL so the seed defaults apply.
    return { ok: true, value: null };
  }

  if (!Array.isArray(rawRoles)) {
    return { ok: false, error: "allowed_roles must be an array of roles" };
  }

  // Deduplicate, keep non-empty strings only.
  const cleaned = [
    ...new Set(rawRoles.filter((role) => typeof role === "string" && role.trim())),
  ];
  return { ok: true, value: JSON.stringify(cleaned) };
}