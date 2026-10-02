/**
 * Pure helpers of the Venture Journey manager panel: how the journey, sessions
 * and reports reads are shaped, and the bounds of the date pickers. Module scope
 * on purpose — built once, never per render. No React, no fetching.
 */
import { dateOnly } from "@/lib/ventureMilestoneDates";

// ─── Read shapers (module scope: built once, never per render) ───────────

// What the journey read starts from, and what a refused answer leaves standing.
export const EMPTY_JOURNEY = {
  stages: [],
  access: { create: false, edit: false, manage: false },
  templateSource: null,
  milestoneAuthority: false,
  deliverablesUnavailable: false,
};

export const pickJourney = (payload) =>
  payload?.success
    ? {
        stages: payload.stages || [],
        access: payload.access || EMPTY_JOURNEY.access,
        templateSource: payload.template_source || null,
        milestoneAuthority: Boolean(payload.milestone_authority),
        deliverablesUnavailable: Boolean(payload.deliverables_unavailable),
      }
    : EMPTY_JOURNEY;

export const pickSessions = (payload) => (payload?.success ? payload.sessions || [] : []);

// Why a milestone or deliverable date was refused, in the reader's language.
export const DATE_ISSUE_KEYS = {
  milestone_date_past: "venture.manager.milestoneDatePast",
  milestone_date_after_next: "venture.manager.milestoneDateAfterNext",
  milestone_date_after_deliverable: "venture.manager.milestoneDateAfterDeliverable",
  deliverable_date_before: "venture.manager.deliverableDateBeforeMilestone",
  deliverable_date_past: "venture.manager.deliverableDatePast",
};

/** The milestone being edited, as the journey read gave it (deliverables included). */
export const findStageMilestone = (stages, milestoneId) =>
  (stages || []).flatMap((stage) => stage.milestones || []).find((milestone) => String(milestone.id) === String(milestoneId)) || null;

/**
 * The floor a date picker may show: the natural floor, unless the stored date
 * is already earlier — an existing record is corrected, never blocked, by the
 * picker itself (an untouched stored date is re-validated on save instead).
 */
export const datePickerFloor = (naturalFloor, storedDate) => {
  const stored = dateOnly(storedDate);
  return stored && stored < naturalFloor ? stored : naturalFloor;
};

/**
 * The ceiling a date picker may show, on the same principle: a milestone whose
 * stored date already sits past the bound it is measured against stays
 * selectable, so a legacy roadmap is never locked out of its own edit form.
 * Returns null when nothing bounds it.
 */
export const datePickerCeiling = (naturalCeiling, storedDate) => {
  if (!naturalCeiling) return null;
  const stored = dateOnly(storedDate);
  return stored && stored > naturalCeiling ? stored : naturalCeiling;
};

// A report BELONGS to a journey, so the payload is grouped by the journey it is
// anchored to. Legacy period-based reports are not journey-anchored: they stay
// readable in history and are simply not shown against a journey.
export const pickReportsByStage = (payload) => {
  const grouped = {};
  if (!payload?.success) return grouped;
  for (const report of payload.reports || []) {
    const key = String(report.journey_stage_id || "");
    if (!key) continue;
    (grouped[key] ||= []).push(report);
  }
  return grouped;
};
