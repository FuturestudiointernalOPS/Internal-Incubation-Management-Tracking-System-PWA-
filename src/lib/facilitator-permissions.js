/**
 * Facilitator capability definitions shared by the PM facilitator UI and the
 * bulk-invitation API so the "full facilitator access" default can never drift
 * from the capabilities the UI can actually render.
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
