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
