import {
  getCalendarSessions,
  getCalendarFollowups,
  ensureFollowupsCreatedByColumn,
} from "@/models/workspace";
import {
  selectCalendarVentureSessions,
  selectCalendarVentureMilestones,
} from "@/models/workspaceCalendarStore";
import { selectInvitedSessionsForContact, selectInviteesBySessionIds } from "@/models/ventureSessionInviteesStore";
import {
  resolveCalendarProgramScope,
  resolveCalendarFollowupVisibility,
  resolveCalendarVentureScope,
} from "@/services/workspace";

/**
 * Google Calendar — the objects copied into a user's calendar (SERVICE layer).
 *
 * Program sessions, coaching follow-ups and venture sessions carry real times
 * (timed events); venture milestones carry a date (all-day events). They are
 * scoped EXACTLY like the in-app calendar: the same relationship-derived
 * resolvers decide which programs, follow-ups and ventures belong to the person.
 *
 * Venture sources use PERSONAL scope (the person's own assignments ∪ coached
 * sessions ∪ member ventures), never the "all ventures" privileged view — a
 * staff member's personal calendar must not receive every venture's items.
 *
 * Tasks are deliberately NOT synced (removed on request): a task is internal
 * work, not an appointment.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions only — every statement lives in
 * `@/models/workspace/**` and `@/models/workspaceCalendarStore`.
 */

const SESSION_DEFAULT_MINUTES = 60;
const FOLLOWUP_DEFAULT_MINUTES = 30;
const VENTURE_SESSION_DEFAULT_MINUTES = 60;
const DESCRIPTION_MAX = 200;

/**
 * The guests a session invites, or `[]` when this sync is not the one that
 * speaks for the session.
 *
 * A guest is an ADDRESS — an external coach or a partner needs no ImpactOS
 * account. Google sends the invitation itself, from the organiser's own
 * calendar, so the guest gets a real invitation (accept / decline) that follows
 * later edits and cancellations.
 *
 * WHO SPEAKS FOR A SESSION: exactly one calendar may carry the guest list, or
 * the same person is invited once per connected account (the organiser's, the
 * coach's, every invited member's). The organiser of record is the session's
 * creator, and the coach is the stand-in when no creator was recorded. Every
 * other copy of the session goes out WITHOUT guests — it is the same event, not
 * a second invitation.
 */
export function sessionAttendees({ invitees, session, userId } = {}) {
  const rows = Array.isArray(invitees) ? invitees : [];
  if (rows.length === 0) return [];

  const organiser = String(session?.created_by || session?.coach_contact_id || "");
  if (!organiser || organiser !== String(userId || "")) return [];

  const seen = new Set();
  const attendees = [];
  for (const row of rows) {
    const email = String(row?.email || "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    // The organiser is the host, not a guest of their own session.
    if (row?.contact_cid && String(row.contact_cid) === String(userId)) continue;
    seen.add(email);
    attendees.push({ email, ...(row?.name ? { displayName: String(row.name) } : {}) });
  }
  return attendees;
}

/** Invitee rows for the given session ids, keyed by session id. Best-effort. */
async function inviteesBySessionId(sessionIds) {
  const ids = [...new Set((sessionIds || []).filter((id) => id !== null && id !== undefined))];
  if (ids.length === 0) return new Map();
  try {
    const { rows } = await selectInviteesBySessionIds(ids);
    const bySession = new Map();
    for (const row of rows || []) {
      const key = String(row.session_id);
      if (!bySession.has(key)) bySession.set(key, []);
      bySession.get(key).push(row);
    }
    return bySession;
  } catch (_) {
    // A guest list that cannot be read never empties the calendar.
    return new Map();
  }
}

const empty = { rows: [] };

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** A value → 'YYYY-MM-DD', or null. */
function toDay(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function plusMinutes(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

/** 'HH:MM[:SS]' → minutes since midnight, or null. */
function timeToMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = String(value).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/** The session's real length from its start/end clock times, or the default. */
function sessionDurationMinutes(session) {
  const start = timeToMinutes(session.start_time);
  const end = timeToMinutes(session.end_time);
  if (start === null || end === null || end <= start) return SESSION_DEFAULT_MINUTES;
  return end - start;
}

/**
 * The person's calendar objects as normalized events. A timed object carries
 * { startsAt, endsAt }; an all-day object carries { allDay, startDate, endDate }.
 * A row without a usable date is skipped.
 */
export async function listUserCalendarEvents({ userId, role }) {
  if (!userId) return [];

  const [
    { programScopeSql, programScopeArgs },
    { followupVisibilitySql, followupVisibilityArgs },
    ventureScopeResult,
  ] = await Promise.all([
    resolveCalendarProgramScope(userId, role),
    Promise.resolve(resolveCalendarFollowupVisibility(userId, role)),
    resolveCalendarVentureScope(userId, role, true).catch(() => ({
      seesAllVentures: false,
      ventureScope: [],
      scopeIds: null,
    })),
  ]);

  await ensureFollowupsCreatedByColumn().catch(() => {});

  const { seesAllVentures, ventureScope, scopeIds } = ventureScopeResult;
  const includeVentures = seesAllVentures || (ventureScope && ventureScope.length > 0);
  const ventureArgs = { personalMode: true, seesAllVentures: false, ventureScope, scopeIds, sessionCid: userId };

  const [sessions, followups, ventureSessions, ventureMilestones, invitedSessions] = await Promise.all([
    getCalendarSessions(programScopeSql, programScopeArgs).catch(() => empty),
    getCalendarFollowups(
      programScopeSql,
      programScopeArgs,
      followupVisibilitySql,
      followupVisibilityArgs,
    ).catch(() => empty),
    includeVentures
      ? selectCalendarVentureSessions(ventureArgs).catch(() => empty)
      : Promise.resolve(empty),
    includeVentures
      ? selectCalendarVentureMilestones({
          seesAllVentures: false,
          ventureScope,
          scopeIds,
        }).catch(() => empty)
      : Promise.resolve(empty),
    // Sessions the person was INVITED to by e-mail — included whatever their
    // Venture scope: an invitation reaches a guest the scope never named.
    selectInvitedSessionsForContact(userId).catch(() => empty),
  ]);

  const events = [];

  // The guest list belongs to the session, not to the calendar it is copied
  // into — read once for both legs below.
  const inviteesBySession = await inviteesBySessionId([
    ...(ventureSessions.rows || []).map((row) => row.id),
    ...(invitedSessions.rows || []).map((row) => row.id),
  ]);

  for (const session of sessions.rows || []) {
    const startsAt = toIso(session.start_at);
    if (!startsAt) continue;
    const label = session.type ? String(session.type) : "Session";
    events.push({
      source: "session",
      sourceId: String(session.id),
      title: session.title || "Session",
      description: session.program_name ? `${label} — ${session.program_name}` : label,
      location: null,
      allDay: false,
      startsAt,
      endsAt: plusMinutes(startsAt, sessionDurationMinutes(session)),
    });
  }

  for (const followup of followups.rows || []) {
    const startsAt = toIso(followup.scheduled_at);
    if (!startsAt) continue;
    const title = followup.team_name
      ? `Coaching: ${followup.team_name}`
      : `Follow-up: ${followup.program_name || ""}`.trim();
    events.push({
      source: "followup",
      sourceId: String(followup.id),
      title,
      description: followup.comment ? String(followup.comment).slice(0, DESCRIPTION_MAX) : null,
      location: null,
      allDay: false,
      startsAt,
      endsAt: plusMinutes(startsAt, FOLLOWUP_DEFAULT_MINUTES),
    });
  }

  for (const session of ventureSessions.rows || []) {
    const startsAt = toIso(session.start_time);
    if (!startsAt) continue;
    events.push({
      source: "venture_session",
      sourceId: String(session.id),
      title: session.title || "Venture session",
      description: session.coach_name ? `Coach: ${session.coach_name}` : null,
      location: null,
      allDay: false,
      startsAt,
      endsAt: plusMinutes(startsAt, VENTURE_SESSION_DEFAULT_MINUTES),
      attendees: sessionAttendees({
        invitees: inviteesBySession.get(String(session.id)),
        session,
        userId,
      }),
    });
  }

  for (const milestone of ventureMilestones.rows || []) {
    const day = toDay(milestone.target_date);
    if (!day) continue;
    events.push({
      source: "venture_milestone",
      sourceId: String(milestone.id),
      title: `${milestone.title || "Milestone"} (milestone)`,
      description: null,
      location: null,
      allDay: true,
      startDate: day,
      endDate: day,
    });
  }

  // Invited sessions: same source/id as a scoped Venture session, so an invited
  // member's own session is deduplicated by the sync planner, never doubled.
  for (const session of invitedSessions.rows || []) {
    const startsAt = toIso(session.start_time);
    if (!startsAt) continue;
    events.push({
      source: "venture_session",
      sourceId: String(session.id),
      title: session.title || "Venture session",
      description: session.coach_name ? `Coach: ${session.coach_name}` : null,
      location: null,
      allDay: false,
      startsAt,
      endsAt: plusMinutes(startsAt, VENTURE_SESSION_DEFAULT_MINUTES),
      // Usually empty: an invited member is not the organiser (see
      // sessionAttendees — one copy of a session carries the guest list).
      attendees: sessionAttendees({
        invitees: inviteesBySession.get(String(session.id)),
        session,
        userId,
      }),
    });
  }

  return events;
}
