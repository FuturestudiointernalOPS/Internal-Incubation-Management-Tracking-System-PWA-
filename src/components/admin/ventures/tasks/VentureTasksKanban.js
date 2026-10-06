"use client";

import { Archive, Calendar, CopyPlus, Loader2, User } from "lucide-react";
import { STATUS_ORDER, STATUS_CFG, PRIORITY_CFG } from "./taskConstants";

export default function VentureTasksKanban({
  t,
  displayByStatus,
  dragOver,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleDragStart,
  openTask,
  archiveOne,
  duplicateTask,
  archBusy,
  dupBusy,
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
      {STATUS_ORDER.map((status) => {
        const statusConfig = STATUS_CFG[status];
        const items = displayByStatus[status] || [];
        return (
          <div key={status} className="flex-shrink-0 w-64"
            onDragOver={(event) => handleDragOver(event, status)}
            onDragLeave={handleDragLeave}
            onDrop={(event) => handleDrop(event, status)}>
            <div className={`rounded-2xl border ${dragOver === status ? "border-[var(--brand-orange)] bg-brand-orange/5" : "border-[var(--border-primary)] bg-tertiary"}`}>
              <div className="flex items-center justify-between p-3 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{statusConfig.label}</span>
                </div>
                <span className="text-[8px] font-bold text-slate-500 bg-primary px-1.5 py-0.5 rounded">{items.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[200px]">
                {items.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-600">
                    <p className="text-[8px] font-bold">No tasks</p>
                  </div>
                )}
                {items.map((task) => (
                  <div key={task.id} draggable onDragStart={(event) => handleDragStart(event, task.id)}
                    onClick={() => openTask(task)}
                    className="p-3 rounded-xl bg-primary border border-[var(--border-primary)] cursor-pointer hover:border-brand-orange/30 transition-all group">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-bold text-[var(--text-primary)] leading-tight">{task.title}</p>
                      <span className={`text-[7px] font-black shrink-0 ${PRIORITY_CFG[task.priority] || "text-slate-500"}`}>
                        {task.priority === "critical" ? "!!!" : task.priority === "high" ? "!!" : task.priority === "medium" ? "!" : ""}
                      </span>
                    </div>
                    {task.description && <p className="text-[8px] text-slate-500 mt-1 line-clamp-2">{task.description}</p>}
                    <div className="flex items-center gap-2 mt-2 text-[7px] text-slate-600">
                      {task.assigned_name && <span className="flex items-center gap-1"><User className="w-2.5 h-2.5" />{task.assigned_name}</span>}
                      {task.due_date && <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{new Date(task.due_date).toLocaleDateString()}</span>}
                      <button onClick={(event) => { event.stopPropagation(); archiveOne(task); }} disabled={archBusy}
                        title={t("vadmin.tasks.archive")}
                        className="p-1 text-slate-500 hover:text-amber-400 rounded disabled:opacity-40">
                        {archBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
                      </button>
                      <button onClick={(event) => { event.stopPropagation(); duplicateTask(task); }} disabled={dupBusy === task.id}
                        title={t("vadmin.tasks.duplicate")}
                        className="ml-auto p-1 text-slate-500 hover:text-sky-300 rounded disabled:opacity-40">
                        {dupBusy === task.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CopyPlus className="w-3 h-3" />}
                      </button>
                    </div>
                    {(task.checklist || []).length > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-tertiary rounded-full h-1 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((task.checklist.filter((checklistItem) => checklistItem.done).length / task.checklist.length) * 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
