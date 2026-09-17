/**
 * Facilitator capability definitions shared by the PM facilitator UI and the
 * bulk-invitation API so the "full facilitator access" default can never drift
 * from the capabilities the UI can actually render.
 *
 * This list, PERMISSION_MODULES.facilitator.capabilities (src/lib/auth.js) and
 * CAPABILITY_CATALOG.facilitator.capabilities (src/models/authorization/
 * capability-catalog.js) are three declarations of ONE vocabulary. They are
 * kept in exact sync by src/__tests__/facilitator-capability-coverage.test.js,
 * which also records which keys are enforced at request level and which are
 * still assignment-only.
 */

export const FACILITATOR_CAPABILITY_KEYS = [
  "participants.view",
  "participants.manage",
  "attendance.view",
  "attendance.record",
  "assignments.view",
  "assignments.review",
  "assignments.grade",
  "sessions.conduct",
  "sessions.record",
  "progress.view",
  "groups.view",
  "groups.manage",
  // Was declared in PERMISSION_MODULES + the catalog but missing here, so the
  // PM UI could never render it and "full facilitator access" never granted it.
  "reviews.submit",
];

/**
 * Full facilitator access means every facilitator capability is granted within
 * the program boundary. It is intentionally NOT super-admin access.
 */
export function buildFullFacilitatorPermissions() {
  const perms = {};
  for (const key of FACILITATOR_CAPABILITY_KEYS) {
    perms[key] = key.startsWith("view") ? 1 : 2;
  }
  return perms;
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
