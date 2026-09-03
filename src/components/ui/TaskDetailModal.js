"use client";

import React from "react";
import { X, CheckCircle2, Link as LinkIcon, Shield, ListTodo } from "lucide-react";

export default function TaskDetailModal({ task, onClose }) {
  if (!task) return null;

  const statusLabel = (task.status || "pending").replace(/_/g, " ");
  const priorityColor = task.priority === "critical" ? "text-red-400" :
    task.priority === "high" ? "text-amber-400" :
    task.priority === "low" ? "text-slate-400" : "text-blue-400";

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">{statusLabel}</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${task.priority === "critical" ? "bg-red-500/10" : task.priority === "high" ? "bg-amber-500/10" : "bg-slate-500/10"} ${priorityColor}`}>{task.priority || "medium"}</span>
            </div>
            <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">{task.title}</h3>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="space-y-3 text-[10px]">
          {/* Description */}
          <div className="p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">Description</p>
            <p className="text-[var(--text-secondary)]">{task.description || "No description"}</p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Start</p>
              <p className="font-bold text-[var(--text-primary)]">{task.start_date ? new Date(task.start_date).toLocaleDateString() : "—"}</p>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">End / Due</p>
              <p className="font-bold text-[var(--text-primary)]">{task.end_date ? new Date(task.end_date).toLocaleDateString() : "—"}</p>
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Category</p>
              <p className="font-bold text-[var(--text-primary)]">{task.category || "None"}</p>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Assigned To</p>
              <p className="font-bold text-[var(--text-primary)]">{task.assignee_name || task.assigned_to || task.user_name || "Unassigned"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Created By</p>
              <p className="font-bold text-[var(--text-primary)]">{task.user_name || "—"}</p>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Created</p>
              <p className="font-bold text-[var(--text-primary)]">{task.created_at ? new Date(task.created_at).toLocaleDateString() : "—"}</p>
            </div>
          </div>

          {/* Link */}
          <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">Reference Link</p>
            {task.link ? (
              <a href={task.link} target="_blank" className="text-[var(--brand-orange)] font-bold underline flex items-center gap-1"><LinkIcon className="w-3 h-3" />{task.link}</a>
            ) : <p className="text-[var(--text-secondary)]">No link</p>}
          </div>

          {/* Subtasks */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 flex items-center gap-1"><ListTodo className="w-3 h-3" />Subtasks</p>
            {(task.subtasks || []).length > 0 ? (
              <div className="space-y-1">
                {task.subtasks.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded bg-indigo-500/5 text-[10px]">
                    <span className={s.status === "completed" ? "text-emerald-400 line-through" : "text-indigo-400"}>{s.title}</span>
                    {s.status === "completed" && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                  </div>
                ))}
              </div>
            ) : <p className="text-[var(--text-secondary)]">No subtasks</p>}
          </div>

          {/* Blockers */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500 mb-1 flex items-center gap-1"><Shield className="w-3 h-3" />Blockers</p>
            {(task.blockers || []).filter(b => b.status === "active").length > 0 ? (
              <div className="space-y-1">
                {task.blockers.filter(b => b.status === "active").map((b) => (
                  <div key={b.id} className="p-2 rounded bg-rose-500/10 text-[10px] text-rose-400 font-bold">{b.title}</div>
                ))}
              </div>
            ) : <p className="text-[var(--text-secondary)]">No blockers</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
