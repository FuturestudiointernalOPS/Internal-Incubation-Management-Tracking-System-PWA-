import { toDayString } from "@/lib/programProgress";
import { getLocalToday } from "@/lib/constants";

/**
 * How participant screens read a program's state (profile, program list,
 * program detail).
 *
 * - The stored status is compared without regard to case ("Active" and
 *   "active" are the same state).
 * - A program whose end date is over is shown as ended, even when nobody has
 *   closed it yet: it is no longer something the person is "currently" in.
 *
 * Display only: the stored status is never changed here.
 */

const ACTIVE_STATUSES = new Set(["", "active", "in progress", "inprogress"]);

const STATUS_KEYS = {
  active: "status.active",
  "in progress": "status.inProgress",
  inprogress: "status.inProgress",
  paused: "status.paused",
  planned: "status.planned",
  draft: "status.draft",
  completed: "status.completed",
  archived: "status.archived",
};

const normalize = (status) => String(status ?? "").trim().toLowerCase();

/** True once the program's last day is behind `today` ("YYYY-MM-DD", local). */
export function isProgramEnded(endDate, today = getLocalToday()) {
  const endDay = toDayString(endDate);
  return Boolean(endDay) && endDay < today;
}

/** Active = an active stored status (any case) and an end date not yet passed. */
export function isProgramActive(status, endDate, today = getLocalToday()) {
  return ACTIVE_STATUSES.has(normalize(status)) && !isProgramEnded(endDate, today);
}

/**
 * The i18n key for the badge, or null when the stored status is unknown (the
 * caller then shows the stored value as is).
 */
export function programStatusKey(status, endDate, today = getLocalToday()) {
  if (isProgramEnded(endDate, today)) return "status.completed";
  const key = normalize(status);
  if (key === "") return "status.active";
  return STATUS_KEYS[key] || null;
}

/**
 * The status a badge should show, as a bare status name ("active",
 * "completed", "inProgress"…) that `status.<name>` translates: an ended
 * program reads "completed", and the stored value is normalised. An unknown
 * status is returned as stored.
 */
export function programDisplayStatus(status, endDate, today = getLocalToday()) {
  const key = programStatusKey(status, endDate, today);
  return key ? key.slice("status.".length) : status;
}
