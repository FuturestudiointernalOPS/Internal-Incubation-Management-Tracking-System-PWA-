/**
 * Participant service — the progress report's overall aggregation.
 *
 * The cross-program figures: completion, attendance, assignments, KPI and ritual
 * participation, plus the totals row. No SQL, no HTTP.
 */

/** The overall figures and totals across every program of the participant. */
export function summarizeProgress(programs, contributions) {
  const sum = (key) => contributions.reduce((acc, entry) => acc + entry[key], 0);

  const overallDeliverables = sum("totalDeliverables");
  const overallCompletedDeliverables = sum("completedDeliverables");
  const overallSessions = sum("totalSessions");
  const overallAttended = sum("attendedSessions");
  const overallSubmissions = sum("totalSubmissions");
  const overallApproved = sum("approvedSubmissions");
  const overallKpiPoints = sum("kpiPoints");
  const overallKpiMax = sum("kpiMax");
  const totalRituals =
    sum("standups") + sum("checkins") + sum("retros") + sum("reflections");

  return {
    overall: {
      programCompletion:
        overallDeliverables > 0
          ? Math.round((overallCompletedDeliverables / overallDeliverables) * 100)
          : 0,
      attendanceRate:
        overallSessions > 0 ? Math.round((overallAttended / overallSessions) * 100) : 0,
      assignmentCompletion:
        overallSubmissions > 0 ? Math.round((overallApproved / overallSubmissions) * 100) : 0,
      kpiCompletion:
        overallKpiMax > 0 ? Math.round((overallKpiPoints / overallKpiMax) * 100) : 0,
      ritualParticipation:
        programs.length > 0
          ? Math.round(
              programs.reduce(
                (accumulator, program) => accumulator + program.metrics.ritualParticipation,
                0,
              ) / programs.length,
            )
          : 0,
    },
    totals: {
      submissions: overallSubmissions,
      approved: overallApproved,
      sessions: overallSessions,
      attended: overallAttended,
      deliverables: overallDeliverables,
      completedDeliverables: overallCompletedDeliverables,
      rituals: totalRituals,
      programs: programs.length,
    },
  };
}