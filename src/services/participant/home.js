/**
 * Participant service — the participant home dashboard.
 *
 * Layer (see docs/LAYER_SPLIT.md): every DECISION of the home dashboard lives
 * here — the week/unlock rules, the completion, attendance and KPI rates, the
 * overdue / due-soon / upcoming classifications, and the calendar assembly.
 * Every statement lives in `@/models/participantPortal` (and the Venture
 * session source in the workspace service). No SQL, no HTTP.
 */

import { getParticipantProgramIds } from "@/models/participant-membership";
import {
  getHomeProgramById,
  getHomeSessionsByProgramId,
  getHomeDeliverablesByProgramId,
  getHomeSubmissionsByParticipantProgram,
  getHomeAttendanceByProgram,
  getHomeKpisByProgramId,
  countHomeAttendanceByProgramId,
  getHomeNotifications,
  getHomeEventsByProgramIds,
} from "@/models/participantPortal";
import { getCalendarVentureSessions } from "@/services/workspace/calendar";

const DAY_MS = 1000 * 60 * 60 * 24;

/** A copy of `date` at local midnight (the comparison base of every rule). */
function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * A session unlocks once its status is active / in progress / completed (the PM
 * marks the current week), its scheduled date has passed, or it has no date yet.
 * Aligned with the program detail route so the dashboard week matches the detail
 * view.
 */
export function isUnlockedSession(session, today) {
  const status = String(session.status || "").toLowerCase();
  if (["active", "in progress", "completed"].includes(status)) return true;
  if (!session.scheduled_date) return true;
  return startOfDay(new Date(session.scheduled_date)) <= today;
}

/**
 * Resolve a deliverable's week from its session (type-safe string comparison),
 * falling back to its own week_number, then to 1.
 */
export function resolveDeliverableWeek(deliverable, sessions) {
  if (deliverable.session_id != null) {
    const matchingSession = sessions.find(
      (session) => String(session.id) === String(deliverable.session_id),
    );
    if (matchingSession?.week_number != null) return matchingSession.week_number;
  }
  return deliverable.week_number ?? 1;
}

/**
 * The current week plus the four rates the dashboard shows.
 *
 * - programCompletion: approved, non-attendance deliverables over the unlocked
 *   ones; falls back to assignmentCompletion when the program tracks no
 *   deliverable but has submissions.
 * - attendanceRate: distinct unlocked sessions marked present over the unlocked
 *   sessions (duplicate attendance rows can never push it above 100%).
 * - assignmentCompletion: approved submissions over every submission.
 * - kpiCompletion: the average of each measurable objective's participant share
 *   (an objective with no linked deliverable is left out); attendance joins as
 *   one extra factor only when the program actually tracks it.
 */
export function computeProgramMetrics({
  sessions,
  deliverables,
  submissions,
  attendance,
  kpis,
  attendanceTracked,
  today,
}) {
  const unlockedSessions = sessions.filter((session) => isUnlockedSession(session, today));
  const unlockedSessionWeekNumbers = new Set(
    unlockedSessions.map((session) => session.week_number || 1),
  );
  const unlockedDeliverables = deliverables.filter((deliverable) =>
    unlockedSessionWeekNumbers.has(resolveDeliverableWeek(deliverable, sessions)),
  );

  const currentWeek =
    unlockedSessions.length > 0
      ? Math.max(...unlockedSessions.map((session) => session.week_number || 1))
      : 1;

  // System-generated attendance deliverables are recorded by staff, not
  // submitted by participants — exclude them from completion.
  const nonAttendanceDeliverables = unlockedDeliverables.filter(
    (deliverable) => !deliverable.title?.toLowerCase().includes("attendance"),
  );
  const totalDeliverables = nonAttendanceDeliverables.length || 1;
  const completedDeliverables = nonAttendanceDeliverables.filter((deliverable) => {
    const matchingSubmission = submissions.find(
      (submission) =>
        String(submission.deliverable_id || submission.document_id) ===
        String(deliverable.id),
    );
    return matchingSubmission && matchingSubmission.status === "approved";
  }).length;
  let programCompletion = Math.round((completedDeliverables / totalDeliverables) * 100);

  // Expected attendance = sessions unlocked so far (future sessions don't count).
  const totalExpectedDays = unlockedSessions.length || 1;
  // Count distinct sessions with a "present" mark, restricted to unlocked
  // sessions, so duplicate attendance rows (same session recorded on multiple
  // dates) can never push the rate above 100%.
  const unlockedSessionIds = new Set(unlockedSessions.map((session) => String(session.id)));
  const attendedSessions = new Set(
    attendance
      .filter(
        (record) =>
          record.status === "present" &&
          unlockedSessionIds.has(String(record.session_id)),
      )
      .map((record) => String(record.session_id)),
  ).size;
  const attendanceRate = Math.round((attendedSessions / totalExpectedDays) * 100);

  // KPI attendance factor only considers the days where presence was actually
  // marked for this participant (unmarked sessions don't penalize it).
  const markedAttendanceDays = new Set(
    attendance.map((record) => record.date).filter(Boolean),
  ).size;
  const presentAttendanceDays = new Set(
    attendance
      .filter((record) => record.status === "present")
      .map((record) => record.date)
      .filter(Boolean),
  ).size;
  const markedAttendanceRate =
    markedAttendanceDays > 0
      ? Math.round((presentAttendanceDays / markedAttendanceDays) * 100)
      : 0;

  const totalAssignments = submissions.length || 1;
  const approvedAssignments = submissions.filter(
    (submission) => submission.status === "approved",
  ).length;
  const assignmentCompletion = Math.round(
    (approvedAssignments / totalAssignments) * 100,
  );

  // No deliverables tracked for this program → fall back to submissions so
  // programCompletion stays consistent with assignmentCompletion.
  if (unlockedDeliverables.length === 0 && submissions.length > 0) {
    programCompletion = assignmentCompletion;
  }

  let kpiCompletion = 0;
  const approvedSubmissions = submissions.filter(
    (submission) => submission.status === "approved",
  );
  const deliverableIdsByKpi = new Map();
  for (const deliverable of deliverables) {
    let linkedKpiIds = [];
    try {
      linkedKpiIds =
        typeof deliverable.kpi_ids === "string"
          ? JSON.parse(deliverable.kpi_ids || "[]")
          : deliverable.kpi_ids || [];
    } catch (_) {
      linkedKpiIds = [];
    }
    for (const kpiId of linkedKpiIds) {
      const kpiKey = String(kpiId);
      if (!deliverableIdsByKpi.has(kpiKey)) {
        deliverableIdsByKpi.set(kpiKey, new Set());
      }
      deliverableIdsByKpi.get(kpiKey).add(String(deliverable.id));
    }
  }
  const kpiFactors = kpis
    .map((kpi) => {
      const linkedDeliverableIds = deliverableIdsByKpi.get(String(kpi.id)) || new Set();
      if (linkedDeliverableIds.size === 0) return null;
      const approvedDeliverableIds = new Set();
      for (const submission of approvedSubmissions) {
        const deliverableId = String(submission.deliverable_id || "");
        const documentId = String(submission.document_id || "");
        if (deliverableId && linkedDeliverableIds.has(deliverableId)) {
          approvedDeliverableIds.add(deliverableId);
        } else if (documentId && linkedDeliverableIds.has(documentId)) {
          approvedDeliverableIds.add(documentId);
        }
      }
      return Math.round((approvedDeliverableIds.size / linkedDeliverableIds.size) * 100);
    })
    .filter((rate) => rate !== null);
  if (attendanceTracked) kpiFactors.push(markedAttendanceRate);
  kpiCompletion =
    kpiFactors.length > 0
      ? Math.round(kpiFactors.reduce((sum, factor) => sum + factor, 0) / kpiFactors.length)
      : 0;

  return {
    currentWeek,
    metrics: {
      percentComplete: programCompletion,
      programCompletion,
      attendanceRate,
      assignmentCompletion,
      kpiCompletion,
    },
  };
}

/**
 * The action centre of the primary program: what is overdue, what is due within
 * a week, the pending submissions, and the next sessions. System-generated
 * attendance tasks never appear as overdue or due soon.
 */
export function buildActionCenter(programsData, today) {
  const primaryProgram = programsData[0] || null;
  const primarySubmissions = primaryProgram ? primaryProgram.submissions : [];
  const pendingSubmissions = primarySubmissions.filter(
    (submission) => submission.status === "pending",
  );

  const overdue = [];
  const dueSoon = [];

  if (primaryProgram) {
    for (const deliverable of primaryProgram.deliverables) {
      if (deliverable.title?.toLowerCase().includes("attendance")) continue;
      if (!deliverable.due_date && !deliverable.created_at) continue;
      const dueDate = startOfDay(new Date(deliverable.due_date || deliverable.created_at));
      const existingSubmission = primaryProgram.submissions.find(
        (submission) =>
          String(submission.document_id) === String(deliverable.id) ||
          String(submission.deliverable_id) === String(deliverable.id),
      );
      const isApproved = existingSubmission?.status === "approved";
      if (!isApproved && dueDate < today) {
        overdue.push({
          id: deliverable.id,
          title: deliverable.title,
          type: "deliverable",
          dueDate: deliverable.due_date || deliverable.created_at,
          daysOverdue: Math.floor((today - dueDate) / DAY_MS),
          programId: primaryProgram.id,
          programName: primaryProgram.name,
        });
      } else if (!isApproved && dueDate >= today) {
        const diffDays = Math.ceil((dueDate - today) / DAY_MS);
        if (diffDays <= 7) {
          dueSoon.push({
            id: deliverable.id,
            title: deliverable.title,
            type: "deliverable",
            dueDate: deliverable.due_date || deliverable.created_at,
            daysLeft: diffDays,
            programId: primaryProgram.id,
            programName: primaryProgram.name,
          });
        }
      }
    }
  }

  const upcomingSessions = primaryProgram
    ? primaryProgram.sessions
        .filter((session) => {
          if (!session.start_at && !session.scheduled_date) return false;
          return new Date(session.start_at || session.scheduled_date) >= today;
        })
        .slice(0, 5)
    : [];

  return { overdue, dueSoon, pendingSubmissions, upcomingSessions };
}

/**
 * The calendar events of every enrolled program: sessions (v2), requirement
 * deadlines (marked submitted when one exists), program events (v2_events and
 * the Venture sessions of the Ventures the person belongs to). Deduplicated by
 * stable event key and sorted by date.
 */
export function buildCalendarEvents({ programsData, events = [], ventureSessions = [] }) {
  const calendarEvents = [];
  const seenEventKeys = new Set();

  for (const program of programsData) {
    for (const session of program.sessions || []) {
      const sessionDate = session.start_at || session.scheduled_date;
      if (!sessionDate) continue;
      const dateStr = new Date(sessionDate).toISOString().split("T")[0];
      const eventKey = `session-${session.id}`;
      if (seenEventKeys.has(eventKey)) continue;
      seenEventKeys.add(eventKey);
      calendarEvents.push({
        id: eventKey,
        title: session.title,
        date: dateStr,
        time: session.start_time || null,
        type: "session",
        source: "v2_sessions",
        relatedId: session.id,
        programId: program.id,
        description: program.name,
      });
    }

    for (const deliverable of program.deliverables || []) {
      if (deliverable.title?.toLowerCase().includes("attendance")) continue;
      if (!deliverable.due_date && !deliverable.created_at) continue;
      const existingSubmission = (program.submissions || []).find(
        (submission) =>
          String(submission.document_id) === String(deliverable.id) ||
          String(submission.deliverable_id) === String(deliverable.id),
      );
      const dueDate = new Date(deliverable.due_date || deliverable.created_at);
      const dateStr = dueDate.toISOString().split("T")[0];
      const eventKey = `deliverable-${deliverable.id}`;
      if (seenEventKeys.has(eventKey)) continue;
      seenEventKeys.add(eventKey);
      calendarEvents.push({
        id: eventKey,
        title: existingSubmission
          ? `${deliverable.title} (submitted)`
          : `${deliverable.title} (due)`,
        date: dateStr,
        time: null,
        type: existingSubmission ? "submission" : "deadline",
        source: "v2_document_requirements",
        relatedId: deliverable.id,
        programId: program.id,
        description: existingSubmission
          ? `Status: ${existingSubmission.status}`
          : program.name,
      });
    }
  }

  for (const event of events) {
    const eventDate = new Date(event.start_time);
    const dateStr = eventDate.toISOString().split("T")[0];
    const timeStr = eventDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const eventKey = `event-${event.id}`;
    if (seenEventKeys.has(eventKey)) continue;
    seenEventKeys.add(eventKey);
    calendarEvents.push({
      id: eventKey,
      title: event.title || "Meeting",
      date: dateStr,
      time: timeStr,
      type: "event",
      source: "v2_events",
      relatedId: event.id,
      programId: event.program_id,
      description: event.description || event.event_type || "Review",
    });
  }

  // Venture sessions (Vinance 3): booked sessions of the Ventures this person
  // belongs to. The source returns venture-facing sessions only — internal
  // staff sessions are never exposed to a founder.
  for (const session of ventureSessions) {
    const eventKey = `vsess-${session.id}`;
    if (seenEventKeys.has(eventKey)) continue;
    seenEventKeys.add(eventKey);
    const sessionStart = new Date(session.start_time);
    calendarEvents.push({
      id: eventKey,
      title: session.title,
      date: sessionStart.toISOString().split("T")[0],
      time: sessionStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      type: "venture_session",
      source: "session",
      relatedId: session.id,
      description: session.coach_name ? `Coach: ${session.coach_name}` : null,
    });
  }

  calendarEvents.sort((first, second) => first.date.localeCompare(second.date));
  return calendarEvents;
}

/** The announcements the participant sees, in the dashboard's shape. */
export function mapAnnouncements(rows = []) {
  return rows.map((notification) => ({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type || "announcement",
    isRead: notification.is_read,
    createdAt: notification.created_at,
  }));
}

/**
 * Assemble the whole home dashboard: read every enrolled program, compute its
 * metrics, then the action centre, the announcements and the calendar.
 */
export async function buildParticipantHome({ cid, email, contact }) {
  const programIds = new Set(await getParticipantProgramIds({ cid, email, contact }));
  const programIdList = Array.from(programIds);
  const programsData = [];
  const today = startOfDay(new Date());

  for (const programId of programIdList) {
    const [
      programResult,
      sessionsResult,
      deliverablesResult,
      submissionsResult,
      attendanceResult,
      kpisResult,
    ] = await Promise.all([
      getHomeProgramById(programId),
      getHomeSessionsByProgramId(programId),
      getHomeDeliverablesByProgramId(programId),
      getHomeSubmissionsByParticipantProgram(cid, programId),
      getHomeAttendanceByProgram(cid, programId),
      getHomeKpisByProgramId(programId),
    ]);

    const program = programResult.rows[0];
    if (!program) continue;

    const sessions = sessionsResult.rows || [];
    const submissions = submissionsResult.rows || [];
    const deliverables = deliverablesResult.rows || [];
    const attendance = attendanceResult.rows || [];
    const kpis = kpisResult.rows || [];

    // A program "tracks" attendance only when attendance records actually exist.
    const attendanceMetaResult = await countHomeAttendanceByProgramId(program.id);
    const attendanceTracked = parseInt(attendanceMetaResult.rows[0]?.total || 0) > 0;

    const { currentWeek, metrics } = computeProgramMetrics({
      sessions,
      deliverables,
      submissions,
      attendance,
      kpis,
      attendanceTracked,
      today,
    });

    programsData.push({
      id: program.id,
      name: program.name,
      description: program.description,
      status: program.status,
      startDate: program.start_date,
      endDate: program.end_date,
      durationWeeks: program.duration_weeks,
      currentWeek,
      cohort: contact.group_name || "Cohort 1",
      metrics,
      sessions,
      deliverables,
      submissions,
      attendance,
    });
  }

  const actionCenter = buildActionCenter(programsData, today);

  const notificationsResult = await getHomeNotifications(cid, email);
  const announcements = mapAnnouncements(notificationsResult.rows || []);

  let events = [];
  try {
    if (programIdList.length > 0) {
      const eventsResult = await getHomeEventsByProgramIds(programIdList);
      events = eventsResult.rows || [];
    }
  } catch (_) {}

  let ventureSessions = [];
  try {
    const ventureSessionsResult = await getCalendarVentureSessions(cid);
    ventureSessions = ventureSessionsResult.rows || [];
  } catch (_) {}

  const calendarEvents = buildCalendarEvents({ programsData, events, ventureSessions });

  return {
    programsData,
    primaryProgram: programsData[0] || null,
    actionCenter,
    calendarEvents,
    announcements,
  };
}
