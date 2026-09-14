/**
 * Venture session scheduling rules (Vinance 3).
 *
 * A session always belongs to a milestone, and every session carries a concrete
 * date and time that is at least SESSION_MIN_LEAD_MINUTES ahead of the moment it
 * is booked. Shared by the server (enforcement) and the booking UI (its date and
 * time pickers use minSessionStart so an invalid choice cannot be made).
 *
 * No db import — safe to import from client components.
 */
export const SESSION_MIN_LEAD_MINUTES = 30;

/** Earliest start a session may be booked for. */
export function minSessionStart(now = Date.now()) {
  return new Date(now + SESSION_MIN_LEAD_MINUTES * 60 * 1000);
}

/**
 * Earliest bookable MINUTE: now + SESSION_MIN_LEAD_MINUTES, rounded UP to the
 * next whole minute. The booking form must use this (not minSessionStart) for
 * both the prefilled value and the picker floor: an `HH:MM` value floored from
 * `now + 30min` would carry seconds forward and be rejected by the server, which
 * compares with millisecond precision at request time.
 */
export function minSessionStartInput(now = Date.now()) {
  const target = now + SESSION_MIN_LEAD_MINUTES * 60 * 1000;
  return new Date(Math.ceil(target / 60000) * 60000);
}

/** True when the given start time is a valid, at-least-30-minutes-ahead time. */
export function isValidSessionStart(value, now = Date.now()) {
  if (value === null || value === undefined || value === "") return false;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  return t >= now + SESSION_MIN_LEAD_MINUTES * 60 * 1000;
}
