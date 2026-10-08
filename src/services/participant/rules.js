/**
 * Participant service — the SHARED week/unlock rules.
 *
 * One rule set for both portal screens: the home dashboard and the progress
 * report must never disagree about which week a participant is on, so the
 * unlock test and the deliverable-week resolution live here and both read
 * them.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions only — no SQL, no HTTP.
 */

/** A copy of `date` at local midnight (the comparison base of every rule). */
export function startOfDay(date) {
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