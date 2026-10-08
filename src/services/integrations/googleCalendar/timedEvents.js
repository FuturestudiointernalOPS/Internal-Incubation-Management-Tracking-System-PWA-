import {
  getCalendarSessions,
  getCalendarFollowups,
  ensureFollowupsCreatedByColumn,
} from "@/models/workspace";
import {
  resolveCalendarProgramScope,
  resolveCalendarFollowupVisibility,
} from "@/services/workspace";

/**
 * Google Calendar — the user's TIMED objects (SERVICE layer).
 *
 * Program sessions and coaching follow-ups carry a real start (and, for
 * follow-ups, a duration), unlike the dated tasks. They are scoped EXACTLY like
 * the in-app calendar: the same relationship-derived resolvers decide which
 * programs the person may see and which follow-ups are theirs. What the user
 * sees in the app is therefore what gets copied into their Google calendar.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions only — every statement lives in
 * `@/models/workspace/**` (scope) and `@/models/workspace` (rows).
 */

const SESSION_DEFAULT_MINUTES = 60;
const FOLLOWUP_DEFAULT_MINUTES = 30;
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

/**
 * The person's timed objects as normalized events:
 * { source, sourceId, title, description, location, startsAt, endsAt }.
 * A row without a start instant is skipped (nothing to place in a calendar).
 */
export async function listUserTimedEvents({ userId, role }) {
  if (!userId) return [];

  const [{ programScopeSql, programScopeArgs }, { followupVisibilitySql, followupVisibilityArgs }] =
    await Promise.all([
      resolveCalendarProgramScope(userId, role),
      Promise.resolve(resolveCalendarFollowupVisibility(userId, role)),
    ]);

  await ensureFollowupsCreatedByColumn().catch(() => {});

  const [sessions, followups] = await Promise.all([
    getCalendarSessions(programScopeSql, programScopeArgs).catch(() => empty),
    getCalendarFollowups(
      programScopeSql,
      programScopeArgs,
      followupVisibilitySql,
      followupVisibilityArgs,
    ).catch(() => empty),
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
      endsAt: plusMinutes(startsAt, SESSION_DEFAULT_MINUTES),
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

  return events;
}
