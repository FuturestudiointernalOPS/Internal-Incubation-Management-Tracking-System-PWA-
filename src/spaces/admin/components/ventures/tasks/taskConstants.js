export const STATUS_ORDER = ["backlog", "todo", "in_progress", "review", "done", "blocked", "cancelled"];

export const STATUS_CFG = {
  backlog: { label: "Backlog", color: "bg-slate-500/10 text-slate-400", dot: "bg-slate-400" },
  todo: { label: "To Do", color: "bg-blue-500/10 text-blue-400", dot: "bg-blue-400" },
  in_progress: { label: "In Progress", color: "bg-amber-500/10 text-amber-400", dot: "bg-amber-400" },
  review: { label: "Review", color: "bg-purple-500/10 text-purple-400", dot: "bg-purple-400" },
  done: { label: "Done", color: "bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-400" },
  blocked: { label: "Blocked", color: "bg-rose-500/10 text-rose-400", dot: "bg-rose-400" },
  cancelled: { label: "Cancelled", color: "bg-slate-500/5 text-slate-500", dot: "bg-slate-500" },
};

export const PRIORITY_CFG = { low: "text-slate-500", medium: "text-blue-400", high: "text-amber-400", critical: "text-rose-400" };
