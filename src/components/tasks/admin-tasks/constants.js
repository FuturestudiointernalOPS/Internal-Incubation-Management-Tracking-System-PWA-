"use client";

/**
 * How a task's status reads on this dashboard.
 *
 * The palette is the page's own, kept as it was: these labels and classes are
 * what the table and the detail modal have always rendered, and a status badge
 * that changed colour or wording here would be a change nobody asked for.
 */
export const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
  },
  in_progress: {
    label: "In Progress",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  blocked: {
    label: "Blocked",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  carried_over: {
    label: "Carried Over",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
};

export function formatStatusLabel(status, t) {
  const config = STATUS_CONFIG[status];
  if (config) {
    const statusKey =
      "status." + status.replace(/_([a-z])/g, (_, character) => character.toUpperCase());
    return t ? t(statusKey) : config.label;
  }
  return status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getStatusColor(status) {
  const config = STATUS_CONFIG[status];
  return config ? config.color : "text-slate-400";
}

export function getStatusBg(status) {
  const config = STATUS_CONFIG[status];
  return config ? config.bg : "bg-slate-500/10";
}

/** A carried-over task is linked to the task it came from, so the count is one. */
export function getCarryOverCount(task) {
  if (!task.carried_over_from_task_id) return 0;
  return 1;
}