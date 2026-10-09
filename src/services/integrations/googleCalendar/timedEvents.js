import {
  getCalendarSessions,
  getCalendarFollowups,
  ensureFollowupsCreatedByColumn,
} from "@/models/workspace";
import { selectCalendarVentureSessions } from "@/models/workspaceCalendarStore";
import {
  resolveCalendarProgramScope,
  resolveCalendarFollowupVisibility,
  resolveCalendarVentureScope,
} from "@/services/workspace";

/**
 * Google Calendar — the user's TIMED objects (SERVICE layer).
 *
 * Program sessions, coaching follow-ups and venture sessions carry real times,
 * unlike the dated tasks. They are scoped EXACTLY like the in-app calendar: the
 * same relationship-derived resolvers decide which programs, follow-ups and
 * ventures belong to the person. What the user sees in the app is therefore what
 * gets copied into their Google calendar.
 *
 * Venture sessions use PERSONAL scope (the person's own assignments ∪ coached
 * sessions), never the "all ventures" privileged view — a staff member's personal
 * calendar must not receive every venture's sessions.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions only — every statement lives in
 * `@/models/workspace/**` and `@/models/workspaceCalendarStore`.
 */

const SESSION_DEFAULT_MINUTES = 60;
const FOLLOWUP_DEFAULT_MINUTES = 30;
const VENTURE_SESSION_DEFAULT_MINUTES = 60;
const DESCRIPTION_MAX = 200;

const empty = { rows: [] };

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
 * The person's timed objects as normalized events:
 * { source, sourceId, title, description, location, startsAt, endsAt }.
 * A row without a start instant is skipped (nothing to place in a calendar).
 */
export async function listUserTimedEvents({ userId, role }) {
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

  const [sessions, followups, ventureSessions] = await Promise.all([
    getCalendarSessions(programScopeSql, programScopeArgs).catch(() => empty),
    getCalendarFollowups(
      programScopeSql,
      programScopeArgs,
      followupVisibilitySql,
      followupVisibilityArgs,
    ).catch(() => empty),
    includeVentures
      ? selectCalendarVentureSessions({
          personalMode: true,
          seesAllVentures: false,
          ventureScope,
          scopeIds,
          sessionCid: userId,
        }).catch(() => empty)
      : Promise.resolve(empty),
  ]);

  const events = [];

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
      startsAt,
      endsAt: plusMinutes(startsAt, VENTURE_SESSION_DEFAULT_MINUTES),
    });
  }

  return events;
}
