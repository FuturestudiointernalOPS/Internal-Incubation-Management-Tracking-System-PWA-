// ─── Shared presentation helpers ─────────────────────────────────────────
// The status vocabulary, its label keys and the date format are used by the
// report views as well as by the page that reads the report.

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const parsedDate = new Date(dateStr);
    if (isNaN(parsedDate.getTime())) return dateStr;
    const day = String(parsedDate.getDate()).padStart(2, "0");
    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const year = parsedDate.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

export const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "text-slate-400",
    bg: "bg-slate-500/10",
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

export const statusLabelKey = (status) => {
  const labelKeys = {
    pending: "status.pending",
    in_progress: "status.inProgress",
    blocked: "status.blocked",
    completed: "status.completed",
    carried_over: "status.carriedOver",
  };
  return labelKeys[status] || "status.pending";
};
