"use client";

import { Archive, CheckCircle2, CopyPlus, Loader2 } from "lucide-react";
import { STATUS_CFG, PRIORITY_CFG } from "./taskConstants";

export default function VentureTasksListView({
  t,
  filteredTasks,
  openTask,
  archiveOne,
  duplicateTask,
  archBusy,
  dupBusy,
}) {
  return (
    <div className="space-y-1">
      {filteredTasks.length === 0 ? (
        <div className="text-center py-16"><CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">No tasks found</p></div>
      ) : (
        filteredTasks.map((task) => {
          const statusConfig = STATUS_CFG[task.status];
          return (
            <div key={task.id} onClick={() => openTask(task)}
              className="flex items-center gap-4 p-4 rounded-xl bg-tertiary border border-[var(--border-primary)] cursor-pointer hover:border-brand-orange/30 transition-all">
              <span className={`w-2 h-2 rounded-full ${statusConfig.dot} shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{task.title}</p>
                <div className="flex items-center gap-3 mt-1 text-[8px] text-slate-500">
                  <span className={`${PRIORITY_CFG[task.priority]} font-bold uppercase`}>{task.priority}</span>
                  {task.assigned_name && <span>{task.assigned_name}</span>}
                  {task.milestone_id && <span>Milestone #{task.milestone_id}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={(event) => { event.stopPropagation(); archiveOne(task); }} disabled={archBusy}
                  title={t("vadmin.tasks.archive")}
                  className="p-1.5 text-slate-500 hover:text-amber-400 rounded-lg disabled:opacity-40">
                  {archBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                </button>
                <button onClick={(event) => { event.stopPropagation(); duplicateTask(task); }} disabled={dupBusy === task.id}
                  title={t("vadmin.tasks.duplicate")}
                  className="p-1.5 text-slate-500 hover:text-sky-300 rounded-lg disabled:opacity-40">
                  {dupBusy === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CopyPlus className="w-3.5 h-3.5" />}
                </button>
                <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${statusConfig.color}`}>{statusConfig.label}</span>
                {task.due_date && <span className="text-[8px] text-slate-500">{new Date(task.due_date).toLocaleDateString()}</span>}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
