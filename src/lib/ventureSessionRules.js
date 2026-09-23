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

/** A Date → the `YYYY-MM-DD` value an <input type="date"> expects (LOCAL day). */
export function toDateInput(date) {
  const pad2 = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** A Date → the `HH:MM` value an <input type="time"> expects (LOCAL clock). */
export function toTimeInput(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** True when the given start time is a valid, at-least-30-minutes-ahead time. */
export function isValidSessionStart(value, now = Date.now()) {
  if (value === null || value === undefined || value === "") return false;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  return timestamp >= now + SESSION_MIN_LEAD_MINUTES * 60 * 1000;
}

// ─── Session materials (documents attached while booking) ────────────────────
// A session may carry documents the participants need (a deck, a brief). The
// files live in the PRIVATE evidence bucket under this prefix and are signed on
// read like deliverable evidence, so only people with Venture access can open
// them.

/** Most files one session may carry. */
export const SESSION_MATERIALS_MAX = 5;

/** Storage prefix every session material path must carry. */
export const SESSION_MATERIALS_PREFIX = "sessions/";

/** True when a stored path was issued by the session material upload route. */
export function isSessionMaterialPath(value) {
  const path = String(value || "").trim();
  if (!path.startsWith(SESSION_MATERIALS_PREFIX)) return false;
  if (path.includes("..") || path.length > 300) return false;
  return path.length > SESSION_MATERIALS_PREFIX.length;
}

/**
 * Normalise the materials payload of a booking request into [{path,name,size}].
 * Returns `null` for a malformed payload so the caller can answer 400 instead
 * of storing something the read layer cannot sign.
 */
export function normalizeSessionMaterials(input) {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > SESSION_MATERIALS_MAX) return null;
  const materials = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const path = String(item.path || "").trim();
    if (!isSessionMaterialPath(path)) return null;
    materials.push({
      path,
      name: String(item.name || path.split("/").pop() || "file").slice(0, 255),
      size: Number.isFinite(Number(item.size)) ? Number(item.size) : null,
    });
  }
  return materials;
}
