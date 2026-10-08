/**
 * Participant service — the home dashboard assembly.
 *
 * Reads every enrolled program, computes its metrics, then assembles the action
 * centre, the announcements and the calendar. Decisions here, every statement in
 * `@/models/participantPortal` (and the Venture session source in the workspace
 * service). No SQL, no HTTP.
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
import { startOfDay } from "../rules";
import { computeProgramMetrics } from "./metrics";
import { buildActionCenter } from "./actions";
import { buildCalendarEvents, mapAnnouncements } from "./calendar";

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