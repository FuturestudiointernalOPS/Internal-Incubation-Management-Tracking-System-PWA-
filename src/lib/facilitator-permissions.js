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
  "attendance.view",
  "attendance.record",
  "assignments.view",
  "assignments.grade",
  "sessions.conduct",
  // Retained: `reviews.submit` is CONSULTED (api/facilitator-reviews POST), so
  // it is a real right. Six keys used to sit above it — participants.manage,
  // assignments.review, sessions.record, progress.view, groups.view,
  // groups.manage — granted "on paper" but whose level was NEVER read by any
  // decision. They were retired (product decision D7, Phase 7): a right nothing
  // enforces is a false right, and the spec forbids a latent MANAGE that opens
  // other actions. See docs/permissions/phase-7-d7-animation-rights.md.
  "reviews.submit",
];

/**
 * Full facilitator access means every facilitator capability is granted within
 * the program boundary. It is intentionally NOT super-admin access.
 */
export function buildFullFacilitatorPermissions() {
  const permissions = {};
  for (const key of FACILITATOR_CAPABILITY_KEYS) {
    permissions[key] = key.startsWith("view") ? 1 : 2;
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
