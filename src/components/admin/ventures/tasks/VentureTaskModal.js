"use client";

import { Loader2, Plus, X } from "lucide-react";
import VenturePersonField from "@/components/ventures/VenturePersonField";
import { STATUS_ORDER, STATUS_CFG } from "./taskConstants";

export default function VentureTaskModal({
  t,
  showTaskModal,
  setShowTaskModal,
  editTask,
  tForm,
  setTForm,
  createOrUpdateTask,
  saving,
  activeTasks,
  toggleBlockedBy,
}) {
  return (
    showTaskModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[var(--text-primary)]">{editTask ? "Edit Task" : "New Task"}</h2>
            <button onClick={() => setShowTaskModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Title *</label>
              <input value={tForm.title} onChange={(event) => setTForm((previous) => ({ ...previous, title: event.target.value }))} placeholder="What needs to be done?"
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Description</label>
              <textarea value={tForm.description} onChange={(event) => setTForm((previous) => ({ ...previous, description: event.target.value }))} rows={2}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Status</label>
                <select value={tForm.status} onChange={(event) => setTForm((previous) => ({ ...previous, status: event.target.value }))}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                  {STATUS_ORDER.map((status) => <option key={status} value={status}>{STATUS_CFG[status]?.label || status}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Priority</label>
                <select value={tForm.priority} onChange={(event) => setTForm((previous) => ({ ...previous, priority: event.target.value }))}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Due Date</label>
                <input type="date" value={tForm.due_date} onChange={(event) => setTForm((previous) => ({ ...previous, due_date: event.target.value }))}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Est. Hours</label>
                <input type="number" value={tForm.estimated_hours} onChange={(event) => setTForm((previous) => ({ ...previous, estimated_hours: event.target.value }))} placeholder="e.g., 4"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Assignee</label>
              {/* ONE field for a platform member OR an external name. The box that
                  was here wrote whatever you typed — a NAME — straight into
                  `assigned_cid`, the slot reserved for a person's platform
                  identity, so nothing downstream could ever match it. */}
              <VenturePersonField
                value={{ cid: tForm.assigned_cid, name: tForm.assigned_name }}
                onChange={({ cid, name }) =>
                  setTForm((previous) => ({ ...previous, assigned_cid: cid || "", assigned_name: name || "" }))
                }
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.tasks.blockedBy")}</label>
              <p className="text-[10px] text-slate-500 mb-2">{t("vadmin.tasks.blockedByHint")}</p>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-[var(--border-primary)] bg-primary p-2">
                {activeTasks.filter((candidate) => String(candidate.id) !== String(editTask?.id)).length === 0 ? (
                  <p className="text-[10px] text-slate-500 px-1 py-1">{t("vadmin.tasks.blockedByNone")}</p>
                ) : (
                  activeTasks
                    .filter((candidate) => String(candidate.id) !== String(editTask?.id))
                    .map((candidate) => (
                      <label key={candidate.id} className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-tertiary cursor-pointer">
                        <input type="checkbox" checked={tForm.blocked_by.includes(String(candidate.id))} onChange={() => toggleBlockedBy(candidate.id)}
                          className="rounded border-slate-600 text-[var(--brand-orange)]" />
                        <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">{candidate.title}</span>
                      </label>
                    ))
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowTaskModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary">Cancel</button>
            <button onClick={createOrUpdateTask} disabled={saving}
              className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {editTask ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </div>
    )
  );
}
