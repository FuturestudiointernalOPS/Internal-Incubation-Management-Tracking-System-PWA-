/**
 * Participant service — the progress report assembly.
 *
 * Reads every enrolled program and its rituals in parallel, computes each
 * program's progress (`./program`) and the overall figures (`./summary`). Every
 * statement lives in `@/models/participantPortal` (plus the enrollment source in
 * `@/models/participant-membership`). No SQL, no HTTP.
 */

import { getParticipantProgramIds } from "@/models/participant-membership";
import {
  getProgressProgramById,
  getProgressSessionsByProgramId,
  getProgressDeliverablesByProgramId,
  getProgressSubmissionsByProgram,
  getProgressAttendanceByProgram,
  getProgressKpisByProgramId,
  getProgressStandupsByUser,
  getProgressCheckinsByParticipantProgram,
  getProgressRetrosByUser,
  getProgressReflectionsByUser,
  countProgressAttendanceByProgramId,
} from "@/models/participantPortal";
import { startOfDay } from "../rules";
import { computeProgramProgress } from "./program";
import { summarizeProgress } from "./summary";

/**
 * Assemble the whole progress report: read every enrolled program, compute its
 * progress, then the overall figures and totals.
 */
export async function buildParticipantProgress({ cid, email, contact }) {
  const programIds = new Set(await getParticipantProgramIds({ cid, email, contact }));
  const programsData = [];
  const contributions = [];
  const today = startOfDay(new Date());

  for (const programId of Array.from(programIds)) {
    const [
      programResult,
      sessionsResult,
      deliverablesResult,
      submissionsResult,
      attendanceResult,
      kpisResult,
      standupsResult,
      checkinsResult,
      retrosResult,
      reflectionsResult,
    ] = await Promise.all([
      getProgressProgramById(programId),
      getProgressSessionsByProgramId(programId),
      getProgressDeliverablesByProgramId(programId),
      getProgressSubmissionsByProgram(cid, programId),
      getProgressAttendanceByProgram(programId, cid),
      getProgressKpisByProgramId(programId),
      getProgressStandupsByUser(cid),
      getProgressCheckinsByParticipantProgram(cid, programId),
      getProgressRetrosByUser(cid),
      getProgressReflectionsByUser(cid),
    ]);

    const program = programResult.rows[0];
    if (!program) continue;

    // A program "tracks" attendance only when attendance records actually exist.
    const attendanceMetaResult = await countProgressAttendanceByProgramId(programId);
    const attendanceTracked = parseInt(attendanceMetaResult.rows[0]?.total || 0) > 0;

    const result = computeProgramProgress({
      program,
      sessions: sessionsResult.rows || [],
      deliverables: deliverablesResult.rows || [],
      submissions: submissionsResult.rows || [],
      attendance: attendanceResult.rows || [],
      kpis: kpisResult.rows || [],
      standups: standupsResult.rows || [],
      checkins: checkinsResult.rows || [],
      retros: retrosResult.rows || [],
      reflections: reflectionsResult.rows || [],
      attendanceTracked,
      today,
    });

    programsData.push({
      id: program.id,
      name: program.name,
      cohort: contact.group_name || "Cohort 1",
      currentWeek: result.currentWeek,
      durationWeeks: program.duration_weeks,
      metrics: result.metrics,
      stats: result.stats,
      milestones: result.milestones,
      history: result.history,
    });
    contributions.push(result.contribution);
  }

  const { overall, totals } = summarizeProgress(programsData, contributions);
  return { programs: programsData, overall, totals };
}