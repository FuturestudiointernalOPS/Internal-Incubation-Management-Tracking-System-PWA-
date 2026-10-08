/**
 * Programs — the participant's progress metrics (SERVICE layer).
 *
 * The four numbers a participant's program card shows: performance-based
 * completion (from approved deliverables, falling back to approved submissions),
 * attendance (deduped distinct present sessions over unlocked sessions), and
 * KPI achievement (the participant's own share of each objective's linked
 * deliverables, with attendance as an extra factor when the program tracks it).
 *
 * Layer (see docs/LAYER_SPLIT.md): pure shaping, no SQL, no HTTP, no models.
 */

/**
 * Compute the participant metrics.
 *
 * @param {Object} input
 * @param {Array}  input.weeks            the assembled curriculum weeks
 * @param {Array}  input.unlockedSessions the unlocked session rows
 * @param {Array}  input.attendance       the participant's attendance rows
 * @param {Array}  input.submissions      the participant's submission rows
 * @param {Array}  input.deliverables     the program's requirement rows
 * @param {Array}  input.kpis             the program's objective rows
 * @param {boolean} input.attendanceTracked whether any attendance record exists
 * @returns {Object} the metrics block
 */
export function computeParticipantMetrics({
  weeks,
  unlockedSessions,
  attendance,
  submissions,
  deliverables,
  kpis,
  attendanceTracked,
}) {
  const unlockedWeeks = weeks.filter((week) => !week.locked);
  const unlockedDeliverables = unlockedWeeks.flatMap((week) => week.deliverables);

  // ─── 1. Program completion — performance-based, computed below from the
  // approved deliverables (falls back to approved submissions when the
  // program tracks no deliverables). Kept in sync with the dashboard card.

  // ─── 2. Deliverables done — exclude 'attendance' deliverables ───
  const unlockedNonAttendanceDeliverables = unlockedDeliverables.filter(
    (deliverable) => !deliverable.title?.toLowerCase().includes("attendance")
  );
  const totalDeliverables = unlockedNonAttendanceDeliverables.length;
  const completedDeliverables = unlockedNonAttendanceDeliverables.filter((deliverable) =>
    submissions.some(
      (submission) =>
        String(submission.deliverable_id || submission.document_id) === String(deliverable.id) &&
        submission.status === "approved",
    ),
  ).length;
  const percentComplete =
    totalDeliverables > 0
      ? Math.round((completedDeliverables / totalDeliverables) * 100)
      : submissions.length > 0
        ? Math.round(
            (submissions.filter((submission) => submission.status === "approved").length /
              submissions.length) *
              100,
          )
        : 0;

  // ─── 3. Attendance — for this participant only ───
  // Count distinct sessions with a "present" mark, restricted to unlocked
  // sessions, so duplicate attendance rows (same session recorded on
  // multiple dates) can never push the rate above 100%.
  const unlockedSessionIds = new Set(
    unlockedSessions.map((session) => String(session.id)),
  );
  const attendedSessions = new Set(
    attendance
      .filter(
        (record) =>
          record.status === "present" &&
          unlockedSessionIds.has(String(record.session_id)),
      )
      .map((record) => String(record.session_id)),
  ).size;
  // Total sessions this participant was expected to attend = sessions that are unlocked
  const totalSessions = unlockedSessions.length || 1;
  const attendanceRate = Math.round((attendedSessions / totalSessions) * 100);

  // ─── 4. KPI Progress — per participant ───
  // A participant's KPI achievement is the average across the program's
  // measurable objectives, each contributing the participant's own share of
  // its linked deliverables that were approved (2 of 3 counts as two
  // thirds). An objective with no linked deliverable is left out.
  let kpiCompletion = 0;
  const approvedSubmissionRows = (submissions || []).filter(
    (submission) => submission.status === "approved",
  );
  const deliverableIdsByKpi = new Map();
  for (const deliverable of deliverables || []) {
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
  // Attendance counts as an extra factor in KPI achievement when the
  // program actually tracks attendance (at least one record exists).
  const kpiFactors = (kpis || [])
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
  if (attendanceTracked) kpiFactors.push(attendanceRate);
  kpiCompletion =
    kpiFactors.length > 0
      ? Math.round(
          kpiFactors.reduce((sum, factor) => sum + factor, 0) / kpiFactors.length,
        )
      : 0;

  return {
    percentComplete,
    attendanceRate,
    kpiCompletion,
    totalDeliverables,
    completedDeliverables,
    totalSessions,
    attendedSessions,
  };
}
