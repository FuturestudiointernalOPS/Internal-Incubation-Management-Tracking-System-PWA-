/**
 * Facilitator capability helpers shared by the PM facilitator UI and the
 * bulk-invitation API so the "full facilitator access" default can never drift
 * from the capabilities the UI can actually render.
 *
 * The keys are NOT declared here: they come from the dedicated animation-rights
 * definition (`@/models/authorization/constants/facilitator-capabilities`),
 * which the general capability registry also imports. One definition, no copy.
 *
 * `reviews.submit` is retained because it is CONSULTED (facilitator reviews
 * POST). Six keys were retired by product decision D7 because no decision ever
 * read them: a right nothing enforces is a false right. See
 * docs/permissions/phase-7-d7-animation-rights.md.
 */

import { FACILITATOR_CAPABILITY_KEYS } from "@/models/authorization/constants/facilitator-capabilities";

export { FACILITATOR_CAPABILITY_KEYS };

/**
 * Full facilitator access means every facilitator capability is granted within
 * the program boundary. It is intentionally NOT super-admin access.
 */
export function buildFullFacilitatorPermissions() {
  const permissions = {};
  for (const key of FACILITATOR_CAPABILITY_KEYS) {
    permissions[key] = key.endsWith(".view") ? 1 : 2;
  }
  return permissions;
}

export function parsePermissions(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_) {}
  }
  return {};
}
