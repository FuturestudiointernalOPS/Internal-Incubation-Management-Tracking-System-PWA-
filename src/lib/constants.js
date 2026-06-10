/**
 * ImpactOS — Shared Constants & Utilities
 *
 * Consolidates patterns duplicated across 7+ pages.
 * Import these instead of redefining STATUS_CONFIG, MONTHS,
 * formatLabel, getWeekNumber in every component.
 */

// ─── STATUS CONFIGURATION ──────────────────────────────────────────────

export const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    dot: "bg-slate-400",
  },
  in_progress: {
    label: "Active",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    dot: "bg-blue-400",
  },
  blocked: {
    label: "Blocked",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    dot: "bg-rose-400",
  },
  completed: {
    label: "Done",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  carried_over: {
    label: "Carryover",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    dot: "bg-indigo-400",
  },
};

export const STATUS_LIST = Object.keys(STATUS_CONFIG);

// ─── SEVERITY COLORS ───────────────────────────────────────────────────

export const SEVERITY_COLORS = {
  low: "text-slate-400 bg-slate-500/10",
  medium: "text-amber-400 bg-amber-500/10",
  high: "text-rose-400 bg-rose-500/10",
  critical: "text-red-400 bg-red-500/10",
};

export const SEVERITY_LIST = Object.keys(SEVERITY_COLORS);

// ─── MONTHS ────────────────────────────────────────────────────────────

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ─── WEEK DAYS ─────────────────────────────────────────────────────────

export const DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

export const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── DATE UTILITIES ────────────────────────────────────────────────────

/**
 * Get ISO week number for a given date
 */
export function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * Get current week number and year
 */
export function getCurrentWeek() {
  const now = new Date();
  return { week: getWeekNumber(now), year: now.getFullYear() };
}

/**
 * Format a date string to a human-readable format
 * @param {string|Date} date
 * @param {object} [options]
 * @param {boolean} [options.short=false] - Use short month format
 * @returns {string}
 */
export function formatDate(date, options = {}) {
  if (!date) return "—";
  try {
    const d = new Date(date);
    return d.toLocaleDateString("en", {
      month: options.short ? "short" : "long",
      day: "numeric",
      year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return String(date);
  }
}

/**
 * Format a date with time
 */
export function formatDateTime(date) {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(date);
  }
}

// ─── STRING UTILITIES ──────────────────────────────────────────────────

/**
 * Convert snake_case or kebab-case to Title Case
 */
export function formatLabel(val) {
  if (!val || val === "—") return "—";
  if (typeof val !== "string") return String(val);
  return val
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── NUMBER UTILITIES ──────────────────────────────────────────────────

/**
 * Format a number with comma separators
 */
export function formatNumber(num) {
  if (num == null) return "—";
  return Number(num).toLocaleString();
}

/**
 * Calculate percentage
 */
export function calcPercentage(part, total) {
  if (!total || !part) return 0;
  return Math.round((part / total) * 100);
}

// ─── COLOR CONSTANTS ───────────────────────────────────────────────────

export const CHART_COLORS = [
  "var(--chart-primary)",
  "var(--chart-success)",
  "var(--chart-danger)",
  "var(--chart-warning)",
  "var(--chart-info)",
];

export const CHART_COLORS_CSS = [
  "#FF6600", "#10B981", "#EF4444", "#F59E0B", "#6366F1",
];
