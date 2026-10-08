/**
 * Participant service — the home dashboard's per-program metrics.
 *
 * The four rates the dashboard shows, computed from the unlock rules shared
 * with the progress report. No SQL, no HTTP.
 */

import { isUnlockedSession, resolveDeliverableWeek } from "../rules";

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