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
  approved: {
    label: "Approved",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  rejected: {
    label: "Rejected",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    dot: "bg-rose-400",
  },
  revision_requested: {
    label: "Revision",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    dot: "bg-amber-400",
  },
  draft: {
    label: "Draft",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    dot: "bg-indigo-400",
  },
  carried_over: {
    label: "Carryover",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    dot: "bg-indigo-400",
  },
  archived: {
    label: "Archived",
    color: "text-slate-500",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    dot: "bg-slate-500",
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

export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ─── WEEK DAYS ─────────────────────────────────────────────────────────

export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── DATE UTILITIES ────────────────────────────────────────────────────

/**
 * Get ISO week number for a given date
 */
export function getWeekNumber(date) {
  const utcDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);
}

/**
 * Get current week number and year
 */
export function getCurrentWeek() {
  const now = new Date();
  return { week: getWeekNumber(now), year: now.getFullYear() };
}

/**
 * Returns today's date in the local timezone as "YYYY-MM-DD".
 * Prefer this over `new Date().toISOString().slice(0, 10)`, which returns UTC
 * and can shift the date by one day for non-UTC timezones.
 */
export function getLocalToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── FACILITATOR WEEKLY REVIEW OPTIONS ────────────────────────────────
// Stable codes stored in the DB. The UI maps each code to a localized label
// via the `pmMisc.facilitators.weeklyReview.*` i18n keys (rating_*, engagement_*,
// attention_*).
export const FACILITATOR_REVIEW_OPTIONS = {
  ratings: ["excellent", "good", "okay", "difficult"],
  engagement: ["high", "moderate", "low", "concerning"],
  attention: [
    "nothing",
    "participant",
    "group",
    "attendance",
    "session",
    "assignment",
    "other",
  ],
};

/**
 * Format a date string to a human-readable format
 * @param {string|Date} date
 * @param {object} [options]
 * @param {boolean} [options.short=false] - Use short month format
 * @returns {string}
 */
export function formatDate(date, options = {}, lang = "en") {
  if (!date) return "—";
  try {
    const parsedDate = new Date(date);
    return parsedDate.toLocaleDateString(lang, {
      month: options.short ? "short" : "long",
      day: "numeric",
      year:
        parsedDate.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return String(date);
  }
}

/**
 * Format a date with time
 */
export function formatDateTime(date, lang = "en") {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString(lang, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(date);
  }
}

/**
 * Locale-aware date formatter for arbitrary Intl options.
 * e.g. formatLocaleDate(d, { weekday: "long", month: "long", day: "numeric" }, "fr")
 */
export function formatLocaleDate(date, options = {}, lang = "en") {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString(lang, options);
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
  return val.replace(/[-_]/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

// ─── EMAIL TEMPLATE VARIABLES ──────────────────────────────────

/**
 * A message placeholder: `{{name}}`. Spaces inside the braces are tolerated
 * (`{{ name }}`), because a hand-typed template should not fail on a space.
 *
 * One definition, shared by the sender (which substitutes the names it was
 * given) and the editors (which warn about the names it will NOT provide).
 */
export const TEMPLATE_VARIABLE_PATTERN = /\{\{([^{}]*)\}\}/g;

/** The variable names a template text uses, in first-seen order and de-duplicated. */
export function templateVariableNames(text) {
  const names = [];
  const seen = new Set();
  for (const match of String(text || "").matchAll(/\{\{([^{}]*)\}\}/g)) {
    const name = match[1].trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

/**
 * The names a template uses that the sender will NOT substitute — and
 * therefore removes before the message goes out. `accepted` is the variable
 * list an editor offers for that message; anything outside it is a name the
 * author invented and no value will ever be filled in for.
 */
export function findUnknownTemplateVariables(text, accepted = []) {
  const known = new Set((accepted || []).map((name) => String(name).trim()));
  return templateVariableNames(text).filter((name) => !known.has(name));
}

/**
 * The names each message template can use — exactly the names its sender fills
 * in. ONE definition, so the editor's hint, its unknown-name warning and the
 * sender cannot drift apart. Anything outside this list is deleted before the
 * message goes out (see applyTemplate), never shipped as raw `{{text}}`.
 */
export const TEMPLATE_VARIABLES = {
  acknowledgement: ["name", "form_name", "organization"],
  approval: ["name", "form_name", "score", "group_name", "organization", "decision", "comment"],
  rejection: ["name", "form_name", "score", "group_name", "organization", "decision", "comment"],
  activation: ["name", "role", "organization", "activation_link", "programName", "form_name", "group_name"],
  existing_user: ["name", "role", "organization", "login_url", "programName", "form_name", "group_name"],
  result: ["name", "organization", "score", "project_name"],
};

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

/**
 * Weighted KPI progress — one 0–100 number for a set of KPIs.
 *
 * Each KPI contributes its own achievement rate (`progress`, itself a 0–100
 * figure) in proportion to its `weight`. When no KPI carries a weight, all are
 * treated as equally important. This is the single definition of "KPI progress"
 * so every screen (PM dashboard, program detail) shows the same number.
 *
 * @param {Array<{ weight?: number|string, progress?: number|string }>} kpis
 * @returns {number|null} 0–100, or null when there is no KPI to average
 */
export function weightedKpiProgress(kpis) {
  const list = (kpis || []).filter(Boolean);
  if (list.length === 0) return null;

  const rawWeights = list.map((kpi) => parseFloat(kpi.weight) || 0);
  const totalWeight = rawWeights.reduce((sum, weight) => sum + weight, 0);
  const weights = totalWeight > 0 ? rawWeights : list.map(() => 1);
  const weightSum = totalWeight > 0 ? totalWeight : list.length;

  const score = list.reduce(
    (sum, kpi, index) => sum + (parseFloat(kpi.progress) || 0) * weights[index],
    0,
  );

  return Math.max(0, Math.min(100, Math.round(score / weightSum)));
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
  "#FF6600",
  "#10B981",
  "#EF4444",
  "#F59E0B",
  "#6366F1",
];

// ─── SERVER ERROR → i18n KEY MAPPING ──────────────────────────────────
// Some API routes return hardcoded English literals (see src/lib/auth.js).
// Map the known literals to translation keys so the client can localize them.
export function getServerErrorKey(message) {
  const map = {
    "Authentication required.": "errors.authRequired",
    "Insufficient permissions.": "errors.insufficientPermissions",
    "Authentication system failure.": "errors.authSystemFailure",
    "Authorization system failure.": "errors.authzSystemFailure",
    "Network error. Please try again.": "errors.networkError",
    "Something went wrong. Please try again.": "errors.somethingWrong",
    "Not found.": "errors.notFound",
  };
  return map[message] || null;
}
