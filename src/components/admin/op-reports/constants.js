export function formatLabel(value) {
  if (!value || value === "—") return "—";
  if (typeof value !== "string") return String(value);
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getWeekNumber(date) {
  const utcDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);
}

// Note: InfoBlock and parseJsonArray have been removed (unused after task-table refactor)

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ─── Read shapers (module scope: built once, never per render) ──────────────
// Each one returns the value the screen shows, and the empty shape when the
// server refuses: the shared hook reports a refusal as a value, not an event.
export const pickReports = (payload) => (payload?.success ? payload.reports || [] : []);
export const pickProjects = (payload) => (payload?.success ? payload.projects || [] : []);
export const pickBlockers = (payload) => (payload?.success ? payload.blockers || [] : []);
export const pickTasks = (payload) => (payload?.success ? payload.tasks || [] : []);
