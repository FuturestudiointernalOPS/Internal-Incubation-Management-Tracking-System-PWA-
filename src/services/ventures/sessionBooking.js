/**
 * services/ventures/sessionBooking — the rules a new Venture session must meet
 * before it is written.
 *
 * Moved verbatim out of `src/app/api/ventures/[id]/sessions/route.js` (lane L2).
 * Pure decision: it answers `{ ok: true, ... }` with the cleaned values, or
 * `{ ok: false, error }` with the exact refusal the controller already sent
 * (HTTP 400). No SQL, no HTTP.
 */
import { SESSION_MIN_LEAD_MINUTES, normalizeSessionMaterials } from "@/lib/ventureSessionRules";

/**
 * @param {object} body the create_session request body
 * @param {number} [now] the current time in ms (injectable for tests)
 * @returns {{ ok: true, sessionNote: string, milestoneRef: string, materials: Array }
 *          | { ok: false, error: string }}
 */
export function checkSessionBooking(body, now = Date.now()) {
  // A session is never created without its internal note: the note is the
  // record of why the session exists and what it is expected to cover.
  const sessionNote = String(body.description || body.agenda || "").trim();
  if (!sessionNote) {
    return { ok: false, error: "A session note is required." };
  }
  // Vinance 3 rules: a session always belongs to a milestone (sessions
  // never exist outside one), always carries a concrete date and time, and
  // always starts at least SESSION_MIN_LEAD_MINUTES ahead of booking.
  const milestoneRef = body.milestone_ref ? String(body.milestone_ref) : null;
  if (!milestoneRef) {
    return { ok: false, error: "A session must belong to a milestone." };
  }
  const startAt = body.start_time ? new Date(body.start_time) : null;
  if (!startAt || Number.isNaN(startAt.getTime())) {
    return { ok: false, error: "A session date and time are required." };
  }
  if (startAt.getTime() < now + SESSION_MIN_LEAD_MINUTES * 60 * 1000) {
    return { ok: false, error: `A session must start at least ${SESSION_MIN_LEAD_MINUTES} minutes from now.` };
  }
  // Documents the participants need for this session (a deck, a brief).
  // Only paths issued by THIS Venture's session upload route are accepted.
  const materials = normalizeSessionMaterials(body.materials);
  if (materials === null) {
    return { ok: false, error: "The session materials are invalid (up to 5 documents)." };
  }
  return { ok: true, sessionNote, milestoneRef, materials };
}
