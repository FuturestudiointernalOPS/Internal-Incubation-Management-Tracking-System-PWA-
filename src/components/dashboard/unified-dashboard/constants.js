/**
 * Shared vocabulary and pure helpers of the unified dashboard.
 *
 * Extracted from UnifiedDashboard.js without change: the status/priority/event
 * colour tables, the calendar and role helpers, and the module-scope reader the
 * data hook keys its work on. Pure module — no React, no fetch.
 */

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

export const EVENT_BASE = {
  task: "bg-blue-500/10 text-blue-400",
  program: "bg-emerald-500/10 text-emerald-400",
  session: "bg-amber-500/10 text-amber-400",
  deliverable: "bg-purple-500/10 text-purple-400",
  event: "bg-sky-500/10 text-sky-400",
};

export const PRIORITY_COLORS = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  medium: "bg-blue-500/10 text-blue-400",
  low: "bg-secondary text-[var(--text-secondary)]",
};

export const getEventStyle = (event) => {
  // Completed: muted and struck through, so open work stands out
  if (event.status === "completed")
    return "bg-[var(--surface-2)] text-[var(--text-tertiary)] line-through";
  if (event.status === "blocked") return "bg-rose-500/15 text-rose-400";
  // Tasks: color by priority
  if (event.source === "task" && event.priority && event.priority !== "medium") {
    return PRIORITY_COLORS[event.priority] || EVENT_BASE.task;
  }
  return EVENT_BASE[event.source] || "bg-secondary text-[var(--text-secondary)]";
};

// Display rules for one calendar day:
//  1. Order = creation order. Task ids are serial, so a lower id was created
//     first; tasks come first, then the other entries in the order received.
//  2. The same task is shown ONCE. Two tasks with the same title on the same
//     day (a carried-over copy next to the original…) are the same work, shown
//     with the look of the most pressing copy (open work before finished).
//     Only a different time of day keeps them apart; tasks have no time today
//     (DATE columns), so the time only matters if one is ever provided.
//     Sessions, deliverables and events are never merged.
export const STATUS_RANK = {
  blocked: 0,
  in_progress: 1,
  pending: 2,
  carried_over: 3,
  completed: 4,
};

export function creationOrder(first, second) {
  const firstIsTask = first.source === "task";
  const secondIsTask = second.source === "task";
  if (firstIsTask !== secondIsTask) return firstIsTask ? -1 : 1;
  if (!firstIsTask) return 0;
  return (Number(first.related_id) || 0) - (Number(second.related_id) || 0);
}

export function groupSameTitle(items) {
  const groups = new Map();
  for (const item of [...items].sort(creationOrder)) {
    const key =
      item.source === "task"
        ? `task:${String(item.title || "").trim().toLowerCase()}:${item.time || ""}`
        : `id:${item.id}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { primary: item, items: [item] });
      continue;
    }
    group.items.push(item);
    const rank = STATUS_RANK[item.status] ?? 2;
    if (rank < (STATUS_RANK[group.primary.status] ?? 2)) group.primary = item;
  }
  return [...groups.values()];
}

// Bar colour for the in-between days of a multi-day task (see the month grid).
export const getEventBar = (event) => {
  if (event.status === "completed") return "bg-emerald-400 opacity-30";
  if (event.status === "blocked") return "bg-rose-400 opacity-60";
  if (event.priority === "critical") return "bg-red-400 opacity-60";
  if (event.priority === "high") return "bg-amber-400 opacity-60";
  return "bg-blue-400 opacity-60";
};

export const EVENT_DOTS = {
  task: "bg-blue-400",
  program: "bg-emerald-400",
  session: "bg-amber-400",
  deliverable: "bg-purple-400",
  event: "bg-sky-400",
};

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

// Recent-activity feed: audit_log actions are open-ended, so map the known
// actions to keys and fall back to the raw (humanized) action for anything else.
export const ACTIVITY_LABELS = {
  task_created: "activity.task created",
  task_completed: "activity.task completed",
  blocker_resolved: "activity.blocker resolved",
  task_assigned: "activity.task assigned",
  assigned: "activity.assigned",
};

export function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  for (let index = 0; index < firstDay.getDay(); index++) days.push(null);
  for (let day = 1; day <= lastDay.getDate(); day++) days.push(day);
  return days;
}

export function isToday(date) {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export const ROLE_HIERARCHY = {
  super_admin: 5,
  program_manager: 3,
  team_lead: 2,
  staff: 1,
};

export function hasMinRole(userRole, minRole) {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[minRole] || 0);
}

// ─── MODULE-SCOPE READER ───────────────────────────────────────────────────
// The reading hook keys its internal work on this, so it is built once here
// rather than on every render.

/** The dashboard payload, or nothing when the server refused the read. */
export const pickDashboard = (payload) => (payload?.success ? payload : null);

// ─── OPERATIONS SECTION ────────────────────────────────────────────────────
// Week number for the weekly ops panel. Restored weekly operations panel for
// staff/super_admin dashboards; all values are fetched live from the API.

export function getWeekNumber(sourceDate) {
  const date = new Date(Date.UTC(sourceDate.getFullYear(), sourceDate.getMonth(), sourceDate.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}
