// Shared presentational constants for the admin Security console.
// `formatDate` renders a timestamp for the overview, sessions, events and
// login-history views; `SEVERITY_COLORS` maps an event severity to its badge
// classes. They live here so the extracted tab components and the page's inline
// login-history table render identically.

export const SEVERITY_COLORS = {
  info: "text-blue-400 bg-blue-500/10",
  warning: "text-amber-400 bg-amber-500/10",
  error: "text-red-400 bg-red-500/10",
  critical: "text-rose-400 bg-rose-500/10",
};

export function formatDate(dateValue) {
  if (!dateValue) return "";
  return new Date(dateValue).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
