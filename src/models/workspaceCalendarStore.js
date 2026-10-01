/**
 * Workspace — personal-calendar Venture sessions (REPOSITORY layer).
 *
 * The three statements behind a person's own Venture-session calendar: the
 * Venture scope (membership ∪ active staff assignment), the expansion of the
 * scope codes to the internal ids, and the session rows themselves.
 *
 * The decision (which scope applies, when the scope is empty and the sentinel is
 * needed) lives in `@/services/workspace/calendar`.
 *
 * SQL is byte-identical to what used to sit inline in `models/workspace.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

/** The person's Venture scope: membership ∪ active staff assignment. */
export function selectVentureScope(userId) {
  return db.execute({
    sql: `SELECT venture_id FROM venture_members
              WHERE (contact_id = ? OR user_cid = ?) AND removed_at IS NULL
            UNION
            SELECT venture_id FROM venture_staff_assignments
              WHERE staff_contact_id = ? AND status = 'active'`,
    args: [userId, userId, userId],
  });
}

/** Expand the scope codes to the internal ids too (rows may be keyed either way). */
export function selectInternalVentureIds(ventureCodes) {
  return db.execute({
    sql: `SELECT id::text AS id FROM ventures WHERE venture_id IN (${ventureCodes.map(() => "?").join(",")})`,
    args: ventureCodes,
  });
}

/** The person's sessions: own coach sessions ∪ venture-facing sessions of the scope. */
export function selectPersonalVentureSessions(userId, scopeList) {
  return db.execute({
    sql: `SELECT id, title, start_time, coach_name, status, venture_id,
                 milestone_ref, journey_stage_id, deliverable_id
          FROM venture_sessions
          WHERE start_time IS NOT NULL
            AND status NOT IN ('cancelled', 'no_show')
            AND (coach_contact_id = ?
                 OR (venture_facing = TRUE AND venture_id IN (${scopeList.map(() => "?").join(",")})))`,
    args: [userId, ...scopeList],
  });
}

// ── GET /api/calendar (venture sources) ──────────────────────────────────────

/** The calendar's Venture scope: membership ∪ active staff assignment. */
export function selectCalendarVentureScope(cid) {
  return db.execute({
    sql: `SELECT venture_id FROM venture_members
                WHERE (contact_id = ? OR user_cid = ?) AND removed_at IS NULL
                UNION
                SELECT venture_id FROM venture_staff_assignments
                WHERE staff_contact_id = ? AND status = 'active'`,
    args: [cid, cid, cid],
  });
}

/** Venture ids a contact coaches (calendar personal mode). */
export function selectCoachedVentureIds(cid) {
  return db.execute({
    sql: "SELECT DISTINCT venture_id FROM venture_sessions WHERE coach_contact_id = ?",
    args: [cid],
  });
}

/** Internal ids + codes for a set of Venture codes (calendar scope resolver). */
export function selectVentureIdsByCodes(codes) {
  return db.execute({
    sql: `SELECT id, venture_id FROM ventures WHERE venture_id IN (${codes.map(() => "?").join(",")})`,
    args: codes,
  });
}

/** The UNION scope fragment shared by the calendar's venture sources. */
function calendarVentureScope(seesAllVentures, ventureScope, scopeIds) {
  if (seesAllVentures) return { scopeSql: "", args: [] };
  return {
    scopeSql: ` AND (venture_id IN (${ventureScope.map(() => "?").join(",")}) OR venture_id IN (${scopeIds.map(() => "?").join(",")}))`,
    args: [...ventureScope, ...scopeIds],
  };
}

/** Venture sessions on the calendar (founder-facing, plus the coach's own). */
export function selectCalendarVentureSessions({ personalMode, seesAllVentures, ventureScope, scopeIds, sessionCid }) {
  const { scopeSql, args: scopeArgs } = calendarVentureScope(seesAllVentures, ventureScope, scopeIds);
  const sessionsPersonalSql = personalMode && sessionCid ? " AND (coach_contact_id = ? OR venture_facing = TRUE)" : "";
  const sessionsPersonalArgs = personalMode && sessionCid ? [sessionCid] : [];
  const sessionsBaseWhere = personalMode
    ? "start_time IS NOT NULL"
    : "venture_facing = TRUE AND start_time IS NOT NULL";
  return db.execute({
    sql: `SELECT id, title, start_time, coach_name, coach_contact_id, status FROM venture_sessions
                WHERE ${sessionsBaseWhere}${scopeSql}${sessionsPersonalSql}`,
    args: [...scopeArgs, ...sessionsPersonalArgs],
  });
}

/** Venture task deadlines on the calendar. */
export function selectCalendarVentureTasks({ seesAllVentures, ventureScope, scopeIds }) {
  const { scopeSql, args } = calendarVentureScope(seesAllVentures, ventureScope, scopeIds);
  return db.execute({
    sql: `SELECT id, title, due_date, status FROM venture_tasks
                WHERE due_date IS NOT NULL${scopeSql}`,
    args,
  });
}

/** Venture milestone target dates on the calendar. */
export function selectCalendarVentureMilestones({ seesAllVentures, ventureScope, scopeIds }) {
  const { scopeSql, args } = calendarVentureScope(seesAllVentures, ventureScope, scopeIds);
  return db.execute({
    sql: `SELECT id, title, target_date, status FROM venture_milestones
                WHERE target_date IS NOT NULL${scopeSql}`,
    args,
  });
}

/** Journey stage target dates on the calendar (stages are UUID-keyed only). */
export function selectCalendarJourneyStages({ seesAllVentures, scopeIds }) {
  return db.execute({
    sql: seesAllVentures
      ? `SELECT id, name, target_date, status FROM venture_journey_stages
                 WHERE target_date IS NOT NULL`
      : `SELECT id, name, target_date, status FROM venture_journey_stages
                 WHERE target_date IS NOT NULL AND venture_id IN (${scopeIds.map(() => "?").join(",")})`,
    args: seesAllVentures ? [] : scopeIds,
  });
}
