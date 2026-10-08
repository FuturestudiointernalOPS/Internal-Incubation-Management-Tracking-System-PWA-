/**
 * The stand-up draft's localStorage access.
 *
 * Pure: no React, no state. The page keeps the timer, the recovery banner and
 * the four draft handlers; they read and write through these, so the "which key
 * and how to parse it" details live here. Moved out of page.js as-is.
 */

/** The key this person's draft for the named week lives under (or null). */
export function draftKey(userCid, week, year) {
  if (!userCid) return null;
  return `standup_draft_${userCid}_${week}_${year}`;
}

/** The parsed draft at `key`, or null when there is none or it is unreadable. */
export function readDraft(key) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Persist `draft` at `key`; a full or unavailable store is ignored. */
export function writeDraft(key, draft) {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/** Remove any draft at `key`; a failure to remove is ignored. */
export function removeDraft(key) {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
