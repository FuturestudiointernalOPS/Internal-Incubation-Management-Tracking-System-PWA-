/**
 * Task manager — shared vocabularies (VIEW layer).
 *
 * The status/priority colour pairs and the category list the manager offers.
 * They live here because the row renderer, the new-task form and the edit modal
 * all render the same vocabulary — one source, so a status cannot be coloured
 * two different ways.
 */

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export const STATUS_CONFIG = {
  pending: { color: "text-slate-400", bg: "bg-slate-500/10" },
  in_progress: { color: "text-blue-400", bg: "bg-blue-500/10" },
  blocked: { color: "text-rose-400", bg: "bg-rose-500/10" },
  completed: { color: "text-emerald-400", bg: "bg-emerald-500/10" },
  carried_over: { color: "text-amber-400", bg: "bg-amber-500/10" },
};

export const STATUS_OPTIONS = [
  { value: "pending", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "carried_over", label: "Carried Over" },
  { value: "completed", label: "Completed" },
];

export const PRIORITY_CONFIG = {
  critical: { label: "Critical", color: "text-red-400", bg: "bg-red-500/10" },
  high: { label: "High", color: "text-amber-400", bg: "bg-amber-500/10" },
  medium: { label: "Medium", color: "text-blue-400", bg: "bg-blue-500/10" },
  low: { label: "Low", color: "text-slate-400", bg: "bg-slate-500/10" },
};

export const PRIORITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const CATEGORIES = [
  "Operations",
  "Administration",
  "Marketing",
  "Finance",
  "Logistics",
  "HR",
  "Technology",
  "Research",
  "Other",
];