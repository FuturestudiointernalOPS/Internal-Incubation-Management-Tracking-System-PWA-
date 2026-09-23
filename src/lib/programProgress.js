/**
 * PROGRAM PROGRESS — what the programme owed as of today.
 *
 * WHAT IT ANSWERS: "is this programme on schedule right now?", not "how far
 * through its plan is it?". The percentage beside a programme on the list
 * measures work produced against the WHOLE plan: it can only reach 100% at the
 * end, it falls when the plan is made more complete, and it moves when the
 * roster changes. This module measures the same four things — sessions held,
 * deliverables checked, report weeks filed, submissions approved — against what
 * was DUE by today, so 100% means "nothing is late" and stays reachable at any
 * point of the programme.
 *
 * THE TWO RULES THAT MAKE IT HONEST:
 *   1. A deadline falling today is not late yet. Only completed days count.
 *   2. Each block is capped at its own maximum, so a surplus in one block (a
 *      report filed for a week beyond the declared duration) can never pay for
 *      a deficit in another.
 *
 * PURE: no database, no React, no clock of its own — the caller passes `today`,
 * which is what makes every rule below testable.
 */

const DAY_MS = 86400000;

/** Weights, kept identical to the list-level score so the two are comparable. */
export const PROGRESS_POINTS = {
  session: 5,
  deliverable: 2,
  reportWeek: 10,
  submission: 3,
};

/**
 * A calendar day as "YYYY-MM-DD".
 *
 * A date-only string is taken as written. Anything else (an ISO timestamp, a
 * Date object) is read in LOCAL time: date columns travel as local midnight
 * serialised to UTC, so reading the UTC day back would shift every deadline by
 * one day for any timezone east of Greenwich.
 */
export function toDayString(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return localDay(parsed);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return localDay(value);
  return null;
}

function localDay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayValue(dayString) {
  const [year, month, day] = dayString.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Whole days from `from` to `to` — positive when `to` is the later day. */
export function daysBetween(from, to) {
  return Math.round((dayValue(to) - dayValue(from)) / DAY_MS);
}

/** `day` shifted by `count` days, as "YYYY-MM-DD". */
export function addDays(day, count) {
  const next = new Date(dayValue(day) + count * DAY_MS);
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  const date = String(next.getUTCDate()).padStart(2, "0");
  return `${next.getUTCFullYear()}-${month}-${date}`;
}

const isTrue = (value) =>
  value === true || value === 1 || value === "1" || value === "true";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const key = (value) => (value === null || value === undefined ? "" : String(value));

const SESSION_DONE = "completed";

/**
 * Statuses that mean "nobody has said what happened".
 *
 * Every session is created with the platform's initial status, and the UI puts a
 * session back to it when it is unlocked. Once the date has passed, a session
 * still carrying it is genuinely ambiguous: it may not have been held, or it may
 * have been held and never recorded. It stays counted as late — the record is
 * the only evidence there is — and is reported separately, so the reader is not
 * told a programme failed when its books were simply not kept.
 */
const SESSION_NO_OUTCOME = new Set(["", "not started"]);

/**
 * Marker the platform writes into `allowed_format` for items nobody produces.
 *
 * The platform auto-creates one "Attendance" requirement per session
 * (`createAttendanceRequirement` in src/models/curriculum.js passes
 * `allowedFormat = "system"`). Attendance is recorded by staff, never submitted
 * by a participant, and the three participant-facing screens already exclude
 * these rows the same way (participant home, participant progress, participant
 * programme detail). The marker is the FORMAT field, not the title: a plan may
 * legitimately hold an ordinary deliverable called "Attendance" that a
 * participant really must hand in, so the title is never used to decide this.
 */
export const SYSTEM_REQUIREMENT_FORMAT = "system";

const isSystemRequirement = (requirement) =>
  normalizeText(requirement?.allowed_format) === SYSTEM_REQUIREMENT_FORMAT;

/** Submission states, grouped by what they mean for the schedule. */
const APPROVED = new Set(["approved", "completed"]);
const AWAITING_REVIEW = new Set(["pending", "submitted", "pending_followup"]);
const SENT_BACK = new Set(["rejected", "revision_requested"]);

/**
 * Classify one participant's position on one deliverable.
 *
 * Priority is deliberate: an approval outranks a later re-submission, and
 * "sent back" is the participant's problem while "awaiting review" is the
 * programme's own backlog — the two must never be merged, which is exactly what
 * a single approved/pending percentage does.
 */
function classify(statuses) {
  if (!statuses || statuses.size === 0) return "missing";
  for (const status of statuses) if (APPROVED.has(status)) return "approved";
  for (const status of statuses) if (AWAITING_REVIEW.has(status)) return "awaiting";
  for (const status of statuses) if (SENT_BACK.has(status)) return "returned";
  // Something was handed in under a state this module does not know: treat it
  // as awaiting a decision rather than as nothing handed in.
  return "awaiting";
}

/**
 * @param {object} input
 * @param {object} input.program        the programme row (start_date, duration_weeks)
 * @param {Array}  input.sessions       (scheduled_date, week_number, status, title)
 * @param {Array}  input.requirements   deliverables (due_date, session_id, is_completed, title)
 * @param {Array}  input.reports        weekly reports (week_number)
 * @param {Array}  input.submissions    (document_id, deliverable_id, participant_id, status)
 * @param {Array}  input.participants   (id, name, email, enrolled_at)
 * @param {string|Date} [input.today]   defaults to the machine's own day
 */
export function computeProgramProgress({
  program = {},
  sessions = [],
  requirements = [],
  reports = [],
  submissions = [],
  participants = [],
  today,
} = {}) {
  const asOf = toDayString(today) || toDayString(new Date());

  // ── Clocks ────────────────────────────────────────────────────────────────
  const sessionDayById = new Map();
  let earliestSessionDay = null;
  for (const session of sessions) {
    const day = toDayString(session?.scheduled_date);
    if (!day) continue;
    sessionDayById.set(key(session?.id), day);
    if (!earliestSessionDay || day < earliestSessionDay) earliestSessionDay = day;
  }
  const declaredStart = toDayString(program?.start_date);
  const anchor = declaredStart || earliestSessionDay;
  const plannedWeeks =
    Number(program?.duration_weeks) > 0
      ? Math.floor(Number(program.duration_weeks))
      : null;

  const daysElapsed = anchor ? daysBetween(anchor, asOf) : 0;
  // Whole weeks only: the week in progress is never reported as a missing
  // report, and a week whose last day is over counts as closed.
  let weeksDue = anchor && daysElapsed > 0 ? Math.floor(daysElapsed / 7) : 0;
  if (plannedWeeks !== null) weeksDue = Math.min(weeksDue, plannedWeeks);

  // ── Sessions held ─────────────────────────────────────────────────────────
  const dueSessions = [];
  const sessionsWithoutDate = [];
  for (const session of sessions) {
    const day = toDayString(session?.scheduled_date);
    const week = Number(session?.week_number);
    if (day) {
      if (day < asOf) dueSessions.push({ session, dueDay: day });
      continue;
    }
    if (Number.isFinite(week) && week > 0 && anchor) {
      if (week <= weeksDue) dueSessions.push({ session, dueDay: addDays(anchor, week * 7) });
      continue;
    }
    sessionsWithoutDate.push(session);
  }
  const sessionsDone = dueSessions.filter(
    (entry) => normalizeText(entry.session?.status) === SESSION_DONE,
  );
  const sessionsLate = dueSessions
    .filter((entry) => normalizeText(entry.session?.status) !== SESSION_DONE)
    .map((entry) => ({
      id: key(entry.session?.id),
      title: entry.session?.title || "",
      week: entry.session?.week_number ?? null,
      dueDay: entry.dueDay,
      unrecorded: SESSION_NO_OUTCOME.has(normalizeText(entry.session?.status)),
    }));

  // ── Deliverables checked ──────────────────────────────────────────────────
  const dueRequirements = [];
  const requirementsWithoutDate = [];
  // Counted for observability only — excluding these is normal, not a fault.
  let systemRequirements = 0;
  for (const requirement of requirements) {
    // System-generated attendance is recorded by staff, not produced by
    // participants. Letting it into `dueRequirements` would invent expected
    // submissions that can never exist, permanently capping the score; so it is
    // left out of the calculation entirely — pace block, expected submissions,
    // `late.deliverables` and `overdue`. It stays a legitimate programme item,
    // hence no data-quality warning.
    if (isSystemRequirement(requirement)) {
      systemRequirements += 1;
      continue;
    }
    const own = toDayString(requirement?.due_date);
    const fromSession = sessionDayById.get(key(requirement?.session_id));
    const week = Number(requirement?.week_number);
    let dueDay = own || fromSession || null;
    if (!dueDay && Number.isFinite(week) && week > 0 && anchor) {
      dueDay = addDays(anchor, week * 7);
    }
    if (dueDay) {
      if (dueDay < asOf) dueRequirements.push({ requirement, dueDay, undated: false });
      continue;
    }
    // No date anywhere. Once the programme has started these are owed
    // immediately: an incomplete plan must not be a way to lower the target.
    // They are surfaced as a data-quality warning so the plan gets dated.
    requirementsWithoutDate.push(requirement);
    if (anchor && anchor < asOf) {
      dueRequirements.push({ requirement, dueDay: anchor, undated: true });
    }
  }
  const requirementsDone = dueRequirements.filter((entry) =>
    isTrue(entry.requirement?.is_completed),
  );
  const requirementsLate = dueRequirements
    .filter((entry) => !isTrue(entry.requirement?.is_completed))
    .map((entry) => ({
      id: key(entry.requirement?.id),
      title: entry.requirement?.title || "",
      dueDay: entry.dueDay,
      undated: entry.undated,
    }));

  // ── Report weeks filed ────────────────────────────────────────────────────
  const reportedWeeks = new Set();
  for (const report of reports) {
    const week = Number(report?.week_number);
    if (Number.isFinite(week) && week >= 1) reportedWeeks.add(week);
  }
  const dueWeekNumbers = [];
  for (let week = 1; week <= weeksDue; week += 1) dueWeekNumbers.push(week);
  const weeksDone = dueWeekNumbers.filter((week) => reportedWeeks.has(week));
  const weeksLate = dueWeekNumbers
    .filter((week) => !reportedWeeks.has(week))
    .map((week) => ({ week, dueDay: anchor ? addDays(anchor, week * 7) : null }));

  // ── Submissions approved ──────────────────────────────────────────────────
  const requirementIds = new Set(requirements.map((requirement) => key(requirement?.id)));
  const statusesByPair = new Map();
  let unlinkedSubmissions = 0;
  for (const submission of submissions) {
    const candidate = [submission?.document_id, submission?.deliverable_id]
      .map(key)
      .find((value) => value && requirementIds.has(value));
    if (!candidate) {
      unlinkedSubmissions += 1;
      continue;
    }
    const pair = `${candidate}::${key(submission?.participant_id)}`;
    if (!statusesByPair.has(pair)) statusesByPair.set(pair, new Set());
    statusesByPair.get(pair).add(normalizeText(submission?.status));
  }

  // A participant with no enrolment date counts from the start; one enrolled
  // after a deadline is not expected to have met it.
  const enrolled = [];
  const withoutEnrolmentDate = [];
  for (const participant of participants) {
    const day = toDayString(participant?.enrolled_at);
    if (day) enrolled.push({ participant, day });
    else withoutEnrolmentDate.push(participant);
  }

  const participantWork = {
    expected: 0,
    approved: 0,
    awaiting: 0,
    returned: 0,
    missing: 0,
  };
  const byPerson = new Map();
  const overdue = [];

  for (const { requirement, dueDay } of dueRequirements) {
    const requirementId = key(requirement?.id);
    const expected = [
      ...enrolled.filter((entry) => entry.day <= dueDay).map((entry) => entry.participant),
      ...withoutEnrolmentDate,
    ];
    for (const participant of expected) {
      const state = classify(statusesByPair.get(`${requirementId}::${key(participant?.id)}`));
      participantWork.expected += 1;
      participantWork[state] += 1;

      const participantId = key(participant?.id);
      if (!byPerson.has(participantId)) {
        byPerson.set(participantId, {
          id: participantId,
          name: participant?.name || participant?.email || participantId,
          expected: 0,
          approved: 0,
          awaiting: 0,
          returned: 0,
          missing: 0,
        });
      }
      const person = byPerson.get(participantId);
      person.expected += 1;
      person[state] += 1;

      // Someone awaiting a review has done their part: they are not "behind",
      // they are waiting on the programme.
      if (state === "missing" || state === "returned") {
        overdue.push({
          participantId,
          participantName: person.name,
          requirementId,
          requirementTitle: requirement?.title || "",
          dueDay,
          daysLate: Math.max(0, daysBetween(dueDay, asOf)),
          state,
        });
      }
    }
  }

  overdue.sort(
    (first, second) =>
      second.daysLate - first.daysLate ||
      first.participantName.localeCompare(second.participantName) ||
      first.requirementTitle.localeCompare(second.requirementTitle),
  );

  const blocks = {
    sessions: {
      done: sessionsDone.length,
      due: dueSessions.length,
      points: PROGRESS_POINTS.session,
    },
    deliverables: {
      done: requirementsDone.length,
      due: dueRequirements.length,
      points: PROGRESS_POINTS.deliverable,
    },
    weeks: {
      done: weeksDone.length,
      due: dueWeekNumbers.length,
      points: PROGRESS_POINTS.reportWeek,
    },
    submissions: {
      done: participantWork.approved,
      due: participantWork.expected,
      points: PROGRESS_POINTS.submission,
    },
  };

  const earned = Object.values(blocks).reduce(
    (total, block) => total + block.done * block.points,
    0,
  );
  const possible = Object.values(blocks).reduce(
    (total, block) => total + block.due * block.points,
    0,
  );

  return {
    asOf,
    startDate: anchor,
    plannedWeeks,
    weeksDue,
    ready: possible > 0,
    headline: {
      earned,
      possible,
      percent: possible > 0 ? Math.round((earned / possible) * 100) : 0,
      latePoints: possible - earned,
      late: {
        sessions: sessionsLate.length,
        deliverables: requirementsLate.length,
        weeks: weeksLate.length,
        submissions: participantWork.missing + participantWork.returned,
      },
    },
    blocks,
    late: {
      sessions: sessionsLate,
      deliverables: requirementsLate,
      weeks: weeksLate,
    },
    participantWork: {
      ...participantWork,
      people: [...byPerson.values()].sort(
        (first, second) =>
          second.missing + second.returned - (first.missing + first.returned) ||
          first.name.localeCompare(second.name),
      ),
    },
    overdue,
    dataQuality: {
      missingStartDate: !anchor,
      missingDuration: plannedWeeks === null,
      undatedRequirements: requirementsWithoutDate.length,
      undatedSessions: sessionsWithoutDate.length,
      unlinkedSubmissions,
      participantsWithoutEnrolmentDate: withoutEnrolmentDate.length,
      systemRequirements,
      pastSessionsWithoutStatus: sessionsLate.filter((entry) => entry.unrecorded).length,
    },
  };
}
