/**
 * Venture milestone date rules (journey timeline).
 *
 * A roadmap only reads forwards. Every date a manager can set is therefore
 * measured against the timeline around it:
 *   - a milestone is owed on or after the milestone it follows, and never after
 *     the ones that come later in the journey — nor after a deliverable it owes;
 *   - a deliverable is due on or after the milestone it belongs to.
 *
 * Two kinds of rule, judged differently:
 *   - ORDER is intrinsic to the plan (a milestone's date against the other
 *     dates) and is ALWAYS checked, so the roadmap cannot be made to read
 *     backwards;
 *   - the FLOOR is today, a moving reference that older roadmaps inevitably
 *     predate, and is judged ONLY on a date the manager has just set — an
 *     untouched stored date stays saveable, so nothing existing is locked out
 *     of its own form.
 *
 * The create form, the edit form and the deliverable forms all ask their
 * question here instead of re-deriving the journey order themselves, and the
 * rules are pure — no db import, safe from a client component.
 */
import { toDateInput } from "@/lib/ventureSessionRules";

/** Today, in the YYYY-MM-DD form a date input reads and writes. */
export const todayDateInput = (now = new Date()) => toDateInput(now);

/** The date-only part of a stored value (a date string, a timestamp or a Date). */
export function dateOnly(value) {
  if (!value) return "";
  if (value instanceof Date) return toDateInput(value);
  return String(value).slice(0, 10);
}

/** The earliest of a list of stored dates, or null when none of them carries one. */
export function earliestStoredDate(values) {
  return (values || []).map(dateOnly).filter(Boolean).sort()[0] || null; // ISO dates sort chronologically
}

/**
 * Every milestone of the journey in the order the manager sees them: journeys
 * in journey order and milestones in display order inside each journey (the
 * read already hands both sorted). Archived journeys are left out — they are no
 * longer part of the roadmap being built.
 */
export function journeyTimeline(stages) {
  return (stages || [])
    .filter((stage) => stage && stage.is_archived !== true)
    .flatMap((stage) =>
      (stage.milestones || []).map((milestone) => ({
        id: String(milestone.id),
        stageId: String(stage.id),
        target_date: dateOnly(milestone.target_date) || null,
      })),
    );
}

/**
 * The latest date a milestone may carry: the earliest target date among the
 * milestones downstream of it, and never one further along than that. Returns
 * null when nothing downstream is dated — the milestone is then bounded by
 * today alone.
 *
 * `milestoneId` names an existing milestone being edited. Without it the
 * milestone is being CREATED in `stageId`, and it is appended to that journey:
 * it then sits after the journey's own last milestone and before every
 * milestone of each later journey — which also covers a journey that has no
 * milestones of its own yet.
 */
export function nextMilestoneDate(stages, { stageId = null, milestoneId = null } = {}) {
  const timeline = journeyTimeline(stages);

  if (milestoneId) {
    const index = timeline.findIndex((milestone) => milestone.id === String(milestoneId));
    if (index < 0) return null;
    return earliestStoredDate(timeline.slice(index + 1).map((milestone) => milestone.target_date));
  }

  const journeyIds = (stages || [])
    .filter((stage) => stage && stage.is_archived !== true)
    .map((stage) => String(stage.id));
  const journeyIndex = journeyIds.indexOf(String(stageId));
  if (journeyIndex < 0) return null;
  const laterJourneys = new Set(journeyIds.slice(journeyIndex + 1));
  return earliestStoredDate(timeline.filter((milestone) => laterJourneys.has(milestone.stageId)).map((milestone) => milestone.target_date));
}

/**
 * Why a milestone date cannot be saved, as a code the caller translates, or
 * null when it can:
 *   `milestone_date_past`               — dated before today
 *   `milestone_date_after_next`         — dated after a milestone that follows it
 *   `milestone_date_after_deliverable`  — dated after a deliverable it owes
 *
 * `deliverableDates` are the due dates already attached to this milestone: a
 * milestone cannot be pushed past what it is supposed to produce. `enforceFloor`
 * is off while editing a milestone whose stored date has not been touched — only
 * the floor is then skipped, never the order.
 */
export function milestoneDateIssue({
  targetDate,
  nextDate = null,
  deliverableDates = [],
  today = todayDateInput(),
  enforceFloor = true,
} = {}) {
  const date = dateOnly(targetDate);
  if (!date) return null;
  if (enforceFloor && date < today) return "milestone_date_past";
  if (nextDate && date > dateOnly(nextDate)) return "milestone_date_after_next";
  const earliestDue = earliestStoredDate(deliverableDates);
  if (earliestDue && date > earliestDue) return "milestone_date_after_deliverable";
  return null;
}

/**
 * Why a deliverable date cannot be saved, as a code the caller translates, or
 * null when it can:
 *   `deliverable_date_before` — due before the milestone it belongs to
 *   `deliverable_date_past`   — due before today (the milestone carries no date
 *                               to compare against)
 *
 * `enforceFloor` skips the floor only, for the same reason as above.
 */
export function deliverableDateIssue({ dueDate, milestoneDate = "", today = todayDateInput(), enforceFloor = true } = {}) {
  const due = dateOnly(dueDate);
  if (!due) return null;
  const milestone = dateOnly(milestoneDate);
  if (milestone) return due < milestone ? "deliverable_date_before" : null;
  return enforceFloor && due < today ? "deliverable_date_past" : null;
}
