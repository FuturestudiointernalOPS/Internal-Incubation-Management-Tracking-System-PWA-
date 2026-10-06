"use client";

import { Archive, RotateCcw } from "lucide-react";

export default function VentureTasksArchived({
  t,
  archivedTasks,
  filteredTasks,
  archBusy,
  restoreOne,
}) {
  return archivedTasks.length === 0 ? (
    <div className="text-center py-16">
      <Archive className="w-12 h-12 text-slate-600 mx-auto mb-3" />
      <p className="text-sm text-slate-500">{t("vadmin.tasks.emptyArchived")}</p>
    </div>
  ) : (
    <div className="space-y-1">
      {filteredTasks.map((task) => (
        <div key={task.id} className="flex items-center gap-4 p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
          <Archive className="w-4 h-4 text-slate-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[var(--text-primary)] truncate line-through decoration-slate-600">{task.title}</p>
            <p className="text-[8px] text-slate-500 mt-0.5">{task.status} · {task.archived_at ? new Date(task.archived_at).toLocaleDateString() : ""}</p>
          </div>
          <button onClick={() => restoreOne(task)} disabled={archBusy}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[8px] font-black uppercase tracking-widest hover:bg-emerald-500/20 disabled:opacity-40 flex items-center gap-1.5">
            <RotateCcw className="w-3 h-3" /> {t("vadmin.tasks.restore")}
          </button>
        </div>
      ))}
    </div>
  );
}
