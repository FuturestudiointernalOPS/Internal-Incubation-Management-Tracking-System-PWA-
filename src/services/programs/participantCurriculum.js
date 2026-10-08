/**
 * Programs — the participant's weekly curriculum assembly (SERVICE layer).
 *
 * Turns the raw session/deliverable/submission rows of one program into the
 * week-by-week curriculum a participant sees: which weeks are unlocked (by
 * session status, scheduled date or the current week) and, per week, the
 * deliverables with the participant's own submission attached.
 *
 * Layer (see docs/LAYER_SPLIT.md): pure shaping, no SQL, no HTTP, no models.
 */

/**
 * Build the participant curriculum weeks.
 *
 * @param {Object} input
 * @param {Array}  input.sessions     the program's session rows
 * @param {Array}  input.deliverables the program's requirement rows
 * @param {Array}  input.submissions  the participant's submission rows
 * @returns {{weeks: Array, unlockedSessions: Array, currentWeek: number}}
 */
export function buildCurriculumWeeks({ sessions, deliverables, submissions }) {
  // ─── Determine locked/unlocked status for all weeks ───
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkUnlocked = (session) => {
    const status = String(session.status || "").toLowerCase();
    if (["active", "in progress", "completed"].includes(status)) return true;
    if (!session.scheduled_date) return true;
    const scheduledDate = new Date(session.scheduled_date);
    scheduledDate.setHours(0, 0, 0, 0);
    return scheduledDate <= today;
  };

  const unlockedSessions = sessions.filter(checkUnlocked);
  const unlockedSessionWeekNumbers = new Set(
    unlockedSessions.map((session) => session.week_number || 1),
  );

  const currentWeek =
    unlockedSessions.length > 0
      ? Math.max(...unlockedSessions.map((session) => session.week_number || 1))
      : 1;

  // Build weekly curriculum from all content
  const weeks = [];
  const weekMap = new Map();
  for (const session of sessions) {
    const weekNumber = session.week_number || 1;
    if (!weekMap.has(weekNumber))
      weekMap.set(weekNumber, {
        number: weekNumber,
        sessions: [],
        deliverables: [],
      });
    weekMap.get(weekNumber).sessions.push(session);
  }
  for (const deliverable of deliverables) {
    const weekNumber =
      deliverable.session_id != null
        ? sessions.find((session) => String(session.id) === String(deliverable.session_id))
            ?.week_number ?? deliverable.week_number ?? 1
        : deliverable.week_number ?? 1;
    if (!weekMap.has(weekNumber))
      weekMap.set(weekNumber, {
        number: weekNumber,
        sessions: [],
        deliverables: [],
      });
    weekMap.get(weekNumber).deliverables.push(deliverable);
  }

  for (const [weekNumber, weekData] of weekMap) {
    const completedDeliverableCount = weekData.deliverables.filter((deliverable) =>
      submissions.some(
        (submission) =>
          String(submission.deliverable_id || submission.document_id) === String(deliverable.id) &&
          submission.status === "approved",
      ),
    ).length;

    const isWeekUnlocked = weekData.sessions.some(checkUnlocked) || unlockedSessionWeekNumbers.has(weekNumber) || (weekNumber <= currentWeek);

    weeks.push({
      number: weekData.number,
      sessions: weekData.sessions,
      locked: !isWeekUnlocked,
      deliverables: weekData.deliverables.map((deliverable) => {
        const matchedSubmission = submissions.find(
          (submission) => String(submission.deliverable_id || submission.document_id) === String(deliverable.id),
        );
        return {
          id: deliverable.id,
          title: deliverable.title,
          description: deliverable.description,
          dueDate: deliverable.due_date || deliverable.created_at,
          allowedFormat: deliverable.allowed_format,
          weight: deliverable.weight,
          submission: matchedSubmission
            ? {
                id: matchedSubmission.id,
                status: matchedSubmission.status,
                fileUrl: matchedSubmission.file_url,
                score: matchedSubmission.score,
                submittedAt: matchedSubmission.created_at,
              }
            : null,
        };
      }),
      completed:
        weekData.deliverables.length > 0 &&
        completedDeliverableCount === weekData.deliverables.length,
      isCurrent: weekData.number === currentWeek,
    });
  }
  weeks.sort((first, second) => first.number - second.number);

  return { weeks, unlockedSessions, currentWeek };
}
