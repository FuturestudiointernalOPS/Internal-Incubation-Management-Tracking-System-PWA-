/**
 * Recurring schedules — validation and normalisation. PURE.
 *
 * One function, one answer: `{ errors, schedule }`. `errors` carries i18n keys
 * (never English prose), so the API can refuse with the same words the form
 * shows. `schedule` is the normalised shape every other module consumes.
 */

import { isValidTimeZone } from "./timezone";

export const FREQUENCIES = ["daily", "weekly", "biweekly", "monthly"];
export const MAX_SLOTS = 12;
export const MIN_SLOT_MINUTES = 5;
export const MAX_SLOT_MINUTES = 480;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const text = (value) => (value === null || value === undefined ? "" : String(value).trim());
// Whole numbers only: a count of 2.5 days or 2.5 meetings is a typo, not a rule.
const whole = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : NaN;
};

/** One slot: a weekday, a local start time and a duration. */
function normalizeSlot(slot, errors) {
  const weekday = whole(slot?.weekday);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    errors.push("venture.schedule.error.slotWeekday");
    return null;
  }
  const start = text(slot?.start);
  if (!TIME_RE.test(start)) {
    errors.push("venture.schedule.error.slotStart");
    return null;
  }
  const minutes = whole(slot?.minutes);
  if (!Number.isInteger(minutes) || minutes < MIN_SLOT_MINUTES || minutes > MAX_SLOT_MINUTES) {
    errors.push("venture.schedule.error.slotDuration");
    return null;
  }
  return { weekday, start, minutes };
}

/**
 * @returns {{ errors: string[], schedule: object|null }}
 */
export function validateScheduleInput(input = {}) {
  const errors = [];

  const title = text(input.title);
  if (!title) errors.push("venture.schedule.error.title");

  const frequency = text(input.frequency) || "weekly";
  if (!FREQUENCIES.includes(frequency)) errors.push("venture.schedule.error.frequency");

  const intervalCount = input.interval_count === undefined || input.interval_count === "" ? 1 : whole(input.interval_count);
  if (!Number.isInteger(intervalCount) || intervalCount < 1 || intervalCount > 12) {
    errors.push("venture.schedule.error.interval");
  }

  const rawSlots = Array.isArray(input.slots) ? input.slots : [];
  if (rawSlots.length === 0 || rawSlots.length > MAX_SLOTS) {
    errors.push("venture.schedule.error.slots");
  }
  const slots = rawSlots.map((slot) => normalizeSlot(slot, errors)).filter(Boolean);

  const validFrom = text(input.valid_from);
  if (!DATE_RE.test(validFrom) || Number.isNaN(Date.parse(`${validFrom}T00:00:00Z`))) {
    errors.push("venture.schedule.error.validFrom");
  }
  const validUntil = text(input.valid_until) || null;
  if (validUntil) {
    if (!DATE_RE.test(validUntil) || Number.isNaN(Date.parse(`${validUntil}T00:00:00Z`))) {
      errors.push("venture.schedule.error.validUntil");
    } else if (validFrom && validUntil < validFrom) {
      errors.push("venture.schedule.error.validUntilBefore");
    }
  }

  let maxOccurrences = null;
  if (input.max_occurrences !== undefined && input.max_occurrences !== null && input.max_occurrences !== "") {
    maxOccurrences = whole(input.max_occurrences);
    if (!Number.isInteger(maxOccurrences) || maxOccurrences < 1) errors.push("venture.schedule.error.maxOccurrences");
  }

  const timezone = text(input.timezone) || "Africa/Porto-Novo";
  if (!isValidTimeZone(timezone)) errors.push("venture.schedule.error.timezone");

  // A weekly/biweekly schedule whose slots name no valid day can never produce
  // an occurrence: refuse it here rather than discover it in the preview.
  if ((frequency === "weekly" || frequency === "biweekly") && slots.length === 0) {
    if (!errors.includes("venture.schedule.error.slots")) errors.push("venture.schedule.error.slots");
  }

  if (errors.length > 0) return { errors, schedule: null };

  return {
    errors: [],
    schedule: {
      title,
      description: text(input.description) || null,
      session_type: text(input.session_type) || "coaching",
      timezone,
      frequency,
      interval_count: intervalCount,
      // Stable order: chronological within a day, then by day.
      slots: [...slots].sort((a, b) => (a.weekday - b.weekday) || a.start.localeCompare(b.start)),
      valid_from: validFrom,
      valid_until: validUntil,
      max_occurrences: maxOccurrences,
      milestone_ref: text(input.milestone_ref) || null,
      staff_cid: text(input.staff_cid) || null,
      staff_name: text(input.staff_name) || null,
    },
  };
}
