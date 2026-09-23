/**
 * Notification target resolution (Vinance 3 — notification hardening).
 *
 * Maps a notification row's entity context to the right in-app destination —
 * the "breadcrumb for attention" navigation layer. Staff and members have
 * different surfaces, so the same entity resolves differently per role.
 *
 * Pure function, no db access: given the row (entity_* fields) and the
 * viewer's role, returns { href, surface } or null when nothing is
 * addressable (legacy rows without context).
 */

const STAFF_SURFACE = {
  venture: (ventureId) => `/admin/ventures/${ventureId}`,
  journey_stage: (ventureId) => `/admin/ventures/${ventureId}/journey`,
  milestone: (ventureId) => `/admin/ventures/${ventureId}/milestones`,
  task: (ventureId) => `/admin/ventures/${ventureId}/tasks`,
  session: (ventureId) => `/admin/ventures/${ventureId}/sessions`,
};

const MEMBER_SURFACE = {
  venture: (ventureId) => `/participant/ventures/${ventureId}`,
  journey_stage: (ventureId) => `/participant/ventures/${ventureId}/journey`,
  milestone: (ventureId) => `/participant/ventures/${ventureId}/journey`,
  task: (ventureId) => `/participant/ventures/${ventureId}/journey`,
  session: (ventureId) => `/participant/ventures/${ventureId}/journey`,
};

/** Deepest entity present on the row wins (venture < journey < milestone < task/session). */
export function deepestEntity(row = {}) {
  if (row.entity_task_id) return "task";
  if (row.entity_session_id) return "session";
  if (row.entity_milestone_id) return "milestone";
  if (row.entity_journey_stage_id) return "journey_stage";
  if (row.entity_venture_id) return "venture";
  return null;
}

/**
 * @param {object} row  v2_notifications row (entity_* context columns)
 * @param {object} opts { role } — staff roles resolve to the admin surface
 * @returns {{ href: string|null, entity: string|null, surface: string|null }}
 */
export function resolveNotificationTarget(row = {}, { role = "" } = {}) {
  const entity = deepestEntity(row);
  if (!entity || !row.entity_venture_id) {
    return { href: null, entity, surface: null };
  }
  const staff =
    ["staff", "super_admin", "program_manager"].includes(role);
  const surface = staff ? STAFF_SURFACE : MEMBER_SURFACE;
  const href = surface[entity]
    ? surface[entity](row.entity_venture_id)
    : surface.venture(row.entity_venture_id);
  return { href, entity, surface: staff ? "staff" : "member" };
}

export default { resolveNotificationTarget, deepestEntity };
