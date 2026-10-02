/**
 * Pure helpers and shared vocabulary of the super-admin dashboard.
 *
 * Extracted from app/admin/page.js without change: the class joiner, the date
 * helpers, the calendar key tables, the status colour and rank tables, the
 * same-title grouping used by the calendar, the calendar tone rules and the
 * label formatter. Pure module — no React, no fetch.
 */

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const days = [];
  for (let index = 0; index < startPad; index++) days.push(null);
  for (let dayOfMonth = 1; dayOfMonth <= lastDay.getDate(); dayOfMonth++) days.push(dayOfMonth);
  return days;
}

export const MONTH_KEYS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function isToday(date) {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "text-[var(--text-secondary)]",
    bg: "bg-secondary",
    dot: "bg-slate-400",
  },
  in_progress: {
    label: "Active",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    dot: "bg-blue-400",
  },
  blocked: {
    label: "Blocked",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    dot: "bg-rose-400",
  },
  completed: {
    label: "Done",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    dot: "bg-emerald-400",
  },
  carried_over: {
    label: "Carryover",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    dot: "bg-indigo-400",
  },
};

// Display rules for one calendar day:
//  1. Order = creation order. Task ids are serial, so a lower id was created
//     first.
//  2. The same task is shown ONCE. Two tasks with the same title on the same
//     day (a carried-over copy next to the original…) are the same work, shown
//     with the look of the most pressing copy (open work before finished).
//     Only a different time of day keeps them apart; tasks have no time today
//     (DATE columns), so the time only matters if one is ever provided.
export const STATUS_RANK = {
  blocked: 0,
  in_progress: 1,
  pending: 2,
  carried_over: 3,
  completed: 4,
};

export function groupSameTitle(tasks) {
  const groups = new Map();
  const ordered = [...tasks].sort(
    (first, second) => (Number(first.id) || 0) - (Number(second.id) || 0),
  );
  for (const task of ordered) {
    const key = `${String(task.title || "").trim().toLowerCase()}:${task.time || ""}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { primary: task, items: [task] });
      continue;
    }
    group.items.push(task);
    const rank = STATUS_RANK[task.status] ?? 2;
    if (rank < (STATUS_RANK[group.primary.status] ?? 2)) group.primary = task;
  }
  return [...groups.values()];
}

/**
 * Calendar colours for a task: `chip` for a labelled entry, `bar` for the
 * quiet in-between days of a multi-day task. The status decides first (a
 * finished task reads as finished whatever its priority), then the priority.
 */
export function calendarTaskTone(task) {
  if (task.status === "completed")
    return {
      chip: "bg-[var(--surface-2)] text-[var(--text-tertiary)] line-through",
      bar: "bg-emerald-400",
    };
  if (task.status === "blocked")
    return { chip: "bg-rose-500/15 text-rose-400", bar: "bg-rose-400" };
  if (task.priority === "critical")
    return { chip: "bg-red-500/20 text-red-400", bar: "bg-red-400" };
  if (task.priority === "high")
    return { chip: "bg-amber-500/20 text-amber-400", bar: "bg-amber-400" };
  const config = STATUS_CONFIG[task.status];
  if (config) return { chip: `${config.bg} ${config.color}`, bar: config.dot };
  return {
    chip: "bg-secondary text-[var(--text-secondary)]",
    bar: "bg-slate-400",
  };
}

export function formatLabel(value) {
  if (!value || value === "—") return "—";
  if (typeof value !== "string") return String(value);
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

/** The status a task report is filed under, labelled. */
export function statusLabel(t, key) {
  const map = {
    pending: "pending",
    in_progress: "active",
    blocked: "blocked",
    completed: "done",
    carried_over: "carryover",
  };
  return t(`status.${map[key] || "pending"}`);
}

/** The severity or priority a blocker/task carries, labelled. */
export function levelLabel(t, key) {
  const map = {
    critical: t("adminMisc.dashboard.critical"),
    high: t("adminMisc.dashboard.high"),
    medium: t("adminMisc.dashboard.medium"),
    low: t("adminMisc.dashboard.low"),
  };
  return map[key] || key || map.medium || "medium";
}

/** The status a programme carries, labelled. */
export function programStatusLabel(t, key) {
  const map = {
    active: t("adminMisc.dashboard.statusActive"),
    planned: t("adminMisc.dashboard.statusPlanned"),
    completed: t("adminMisc.dashboard.statusCompleted"),
    pending: t("adminMisc.dashboard.statusPending"),
    archived: t("adminMisc.dashboard.statusArchived"),
    cancelled: t("adminMisc.dashboard.statusCancelled"),
    template: t("adminMisc.dashboard.statusTemplate"),
  };
  const normalized = typeof key === "string" ? key.toLowerCase() : "";
  return map[normalized] || key || "";
}