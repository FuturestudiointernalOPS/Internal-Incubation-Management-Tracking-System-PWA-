/**
 * Participant service — the progress report of ONE program.
 *
 * The metrics, the stats, the milestone timeline, the per-week history and the
 * slice of the overall aggregation this program contributes. The unlock / week
 * rules come from the shared module, so this view and the home dashboard can
 * never disagree. No SQL, no HTTP.
 */

import { isUnlockedSession, resolveDeliverableWeek } from "../rules";

/**
 * The metrics, the stats, the milestone timeline, the per-week history and the
 * slice of the overall aggregation for one program.
 *
 * KPI achievement: each objective contributes the participant's own share of
 * its linked deliverables that were approved (2 of 3 counts as two thirds, not
 * 0 and not 1). An objective with no linked deliverable cannot be measured, so
 * it is left out of the average rather than counted as 0.
 */
export function computeProgramProgress({
  program,
  sessions,
  deliverables,
  submissions,
  attendance,
  kpis,
  standups,
  checkins,
  retros,
  reflections,
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
  const completedDeliverables = nonAttendanceDeliverables.filter((deliverable) =>
    submissions.some(
      (submission) =>
        submission.status === "approved" &&
        (String(submission.document_id) === String(deliverable.id) ||
          String(submission.deliverable_id) === String(deliverable.id)),
    ),
  ).length;
  const programCompletion = Math.round((completedDeliverables / totalDeliverables) * 100);

  // Count distinct sessions with a "present" mark, restricted to unlocked
  // sessions, so duplicate attendance rows can never push the rate above 100%.
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
  const totalSessions = unlockedSessions.length || 1;
  const attendanceRate = Math.round((attendedSessions / totalSessions) * 100);

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

  const approvedSubmissions = submissions.filter(
    (submission) => submission.status === "approved",
  ).length;
  const totalSubmissions = submissions.length || 1;
  const assignmentCompletion = Math.round((approvedSubmissions / totalSubmissions) * 100);

  const approvedSubmissionRows = submissions.filter(
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
  const measurableKpiRates = kpis
    .map((kpi) => {
      const linkedDeliverableIds = deliverableIdsByKpi.get(String(kpi.id)) || new Set();
      if (linkedDeliverableIds.size === 0) return null;
      const approvedDeliverableIds = new Set();
      for (const submission of approvedSubmissionRows) {
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
  const totalKpis = kpis.length;
  const targetMetKpis = measurableKpiRates.filter((rate) => rate >= 100).length;
  const kpiFactors = [...measurableKpiRates];
  if (attendanceTracked) kpiFactors.push(markedAttendanceRate);
  const kpiCompletion =
    kpiFactors.length > 0
      ? Math.round(kpiFactors.reduce((sum, factor) => sum + factor, 0) / kpiFactors.length)
      : 0;

  const weeksWithRituals = new Set();
  standups.forEach((standup) => weeksWithRituals.add(standup.week_number));
  checkins.forEach((checkin) => weeksWithRituals.add(checkin.week_number));
  retros.forEach((retro) => weeksWithRituals.add(retro.week_number));
  reflections.forEach((reflection) => weeksWithRituals.add(reflection.week_number));
  const totalWeeks = program.duration_weeks || currentWeek || 1;
  const ritualParticipation = Math.round((weeksWithRituals.size / totalWeeks) * 100);

  const milestones = [];
  sessions.forEach((session) => {
    const attendanceRecord = attendance.find(
      (record) => String(record.session_id) === String(session.id),
    );
    milestones.push({
      id: `session-${session.id}`,
      title: `Attended: ${session.title}`,
      type: "attendance",
      week: session.week_number,
      achieved: attendanceRecord?.status === "present",
      date: attendanceRecord?.date || session.start_at,
    });
  });
  deliverables.forEach((deliverable) => {
    // Attendance tasks are recorded by staff, not submitted by participants.
    if (deliverable.title?.toLowerCase().includes("attendance")) return;
    const matchedSubmission = submissions.find(
      (submission) =>
        String(submission.document_id) === String(deliverable.id) ||
        String(submission.deliverable_id) === String(deliverable.id),
    );
    milestones.push({
      id: `deliverable-${deliverable.id}`,
      title: `Completed: ${deliverable.title}`,
      type: "deliverable",
      week: deliverable.week_number || 0,
      achieved: matchedSubmission?.status === "approved",
      date: matchedSubmission?.created_at || deliverable.created_at,
      score: matchedSubmission?.score || 0,
    });
  });
  milestones.sort((first, second) => {
    if (first.achieved !== second.achieved) return first.achieved ? -1 : 1;
    return (second.week || 0) - (first.week || 0);
  });

  const historyByWeek = [];
  for (let week = 1; week <= currentWeek; week++) {
    const weekDeliverables = deliverables.filter(
      (deliverable) =>
        (deliverable.week_number || 1) === week &&
        !deliverable.title?.toLowerCase().includes("attendance"),
    );
    const weekCompletedDeliverables = weekDeliverables.filter((deliverable) =>
      submissions.some(
        (submission) =>
          submission.status === "approved" &&
          (String(submission.document_id) === String(deliverable.id) ||
            String(submission.deliverable_id) === String(deliverable.id)),
      ),
    ).length;
    const weekSessions = sessions.filter((session) => (session.week_number || 1) === week);
    const weekAttended = weekSessions.filter((session) =>
      attendance.some(
        (record) =>
          String(record.session_id) === String(session.id) && record.status === "present",
      ),
    ).length;
    historyByWeek.push({
      week,
      deliverablesCompleted: weekCompletedDeliverables,
      deliverablesTotal: weekDeliverables.length,
      sessionsAttended: weekAttended,
      sessionsTotal: weekSessions.length,
      hasRitual: weeksWithRituals.has(week),
    });
  }

  return {
    currentWeek,
    metrics: {
      programCompletion,
      attendanceRate,
      assignmentCompletion,
      kpiCompletion,
      ritualParticipation,
    },
    stats: {
      totalDeliverables,
      completedDeliverables,
      totalSessions,
      attendedSessions,
      totalSubmissions,
      approvedSubmissions,
      totalKpis,
      targetMetKpis,
      standups: standups.length,
      checkins: checkins.length,
      retros: retros.length,
      reflections: reflections.length,
    },
    milestones,
    history: historyByWeek,
    // The slice of the overall aggregation this program contributes.
    contribution: {
      totalDeliverables,
      completedDeliverables,
      totalSessions,
      attendedSessions,
      totalSubmissions,
      approvedSubmissions,
      kpiPoints:
        measurableKpiRates.reduce((sum, rate) => sum + rate, 0) +
        (attendanceTracked ? markedAttendanceRate : 0),
      kpiMax: measurableKpiRates.length * 100 + (attendanceTracked ? 100 : 0),
      standups: standups.length,
      checkins: checkins.length,
      retros: retros.length,
      reflections: reflections.length,
    },
  };
}