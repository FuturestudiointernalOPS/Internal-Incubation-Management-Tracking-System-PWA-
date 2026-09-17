/**
 * dashboardSession — module-level cache of the dashboard shell's session.
 *
 * DashboardLayout is rendered by each page, so it remounts on every client-side
 * navigation. Without a cache, each navigation re-runs the full auth chain
 * (session → groups → responsibilities → notifications → badges), which caused
 * the black-screen flash and slow transitions. This module survives remounts
 * (it lives at module scope), so the shell can restore its state instantly and
 * only re-validate once per full page load.
 */

let session = null;
const listeners = new Set();

export function getDashboardSession() {
  return session;
}

export function setDashboardSession(value) {
  session = value;
  // The shell is the only writer. Anything rendering from this cache subscribes
  // (see useSessionUser), so a screen can pick up the identity as soon as the
  // shell has fetched it instead of re-reading the browser's stored copy.
  for (const listener of listeners) listener();
}

/**
 * Subscribe to changes of the cached session; returns an unsubscribe function,
 * which is the shape useSyncExternalStore expects.
 */
export function subscribeDashboardSession(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ─── The identity, including the browser's stored copy ───────────────────────
//
// The session above is the authority, but it is EMPTY until the shell has fetched
// it — and on a cold load the shell needs something to paint with before that, as
// does each section's guard, which renders OUTSIDE the shell it guards. The
// browser's stored copy is that something.
//
// The read is cached against the RAW STRING it came from. That is what makes it
// usable as a store snapshot: an unchanged copy must return the SAME object (a
// fresh one would re-render forever), while a copy that was replaced — or removed
// at sign-out — must be noticed immediately.

let storedRaw = null;
let storedParsed = null;

/** The browser's stored copy of the user, or null. */
export function getStoredUserOnce() {
  let raw = null;
  try {
    raw = localStorage.getItem("user");
  } catch {
    raw = null;
  }
  if (raw !== storedRaw) {
    storedRaw = raw;
    try {
      storedParsed = raw ? JSON.parse(raw) : null;
    } catch {
      storedParsed = null;
    }
  }
  return storedParsed;
}

/**
 * The signed-in user to paint with: the session the shell published, or — while
 * the session has none yet — the browser's stored copy. Returns the same object
 * while nothing changes, so it can be read as a store snapshot.
 */
export function getDashboardSessionUser() {
  return getDashboardSession()?.user || getStoredUserOnce() || null;
}
