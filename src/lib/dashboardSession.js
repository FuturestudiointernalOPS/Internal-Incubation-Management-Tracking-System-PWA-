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

export function getDashboardSession() {
  return session;
}

export function setDashboardSession(value) {
  session = value;
}
