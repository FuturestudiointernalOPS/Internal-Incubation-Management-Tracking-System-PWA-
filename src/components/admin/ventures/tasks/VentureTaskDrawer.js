"use client";

import { Lock, Pencil, X } from "lucide-react";
import { STATUS_ORDER, STATUS_CFG } from "./taskConstants";

export default function VentureTaskDrawer({
  t,
  id,
  showDrawer,
  selectedTask,
  setShowDrawer,
  openEditTask,
  updateTaskStatus,
  setSelectedTask,
  comments,
  showComments,
  setShowComments,
  commentText,
  setCommentText,
  addComment,
}) {
  return (
    showDrawer && selectedTask && (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/60" onClick={() => setShowDrawer(false)} />
        <div className="relative w-full max-w-lg bg-[var(--bg-tertiary)] border-l border-[var(--border-primary)] overflow-y-auto">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 min-w-0">
                <h2 className="text-sm font-black text-[var(--text-primary)] truncate">{selectedTask.title}</h2>
                <button onClick={() => openEditTask(selectedTask)} title={t("vadmin.tasks.edit")} className="p-2 hover:bg-white/5 rounded-lg shrink-0"><Pencil className="w-3.5 h-3.5 text-slate-500" /></button>
              </div>
              <button onClick={() => setShowDrawer(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>

            {selectedTask.dependency_blocked && (
              <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="text-[11px] font-bold">{t("vadmin.tasks.dependencyBlocked", { names: (selectedTask.blocked_by_titles || []).join(", ") })}</span>
              </div>
            )}

            {/* Status + Priority */}
            <div className="flex gap-3">
              <select value={selectedTask.status} onChange={(event) => { updateTaskStatus(selectedTask.id, event.target.value); setSelectedTask((previous) => ({ ...previous, status: event.target.value })); }}
                className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[9px] font-bold text-[var(--text-primary)] outline-none flex-1">
                {STATUS_ORDER.map((status) => <option key={status} value={status}>{(STATUS_CFG[status]?.label || status)}</option>)}
              </select>
              <select value={selectedTask.priority} onChange={(event) => { setSelectedTask((previous) => ({ ...previous, priority: event.target.value })); fetch(`/api/ventures/${id}/tasks?id=${selectedTask.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priority: event.target.value }) }); }}
                className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[9px] font-bold text-[var(--text-primary)] outline-none">
                {["low", "medium", "high", "critical"].map((priority) => <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>)}
              </select>
            </div>

            {/* Description */}
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Description</p>
              <p className="text-xs text-[var(--text-secondary)]">{selectedTask.description || "No description"}</p>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-primary rounded-xl">
                <p className="text-[7px] font-black text-slate-500 uppercase tracking-wider">Assignee</p>
                <p className="text-[10px] font-bold text-[var(--text-primary)] mt-0.5">{selectedTask.assigned_name || "Unassigned"}</p>
              </div>
              <div className="p-3 bg-primary rounded-xl">
                <p className="text-[7px] font-black text-slate-500 uppercase tracking-wider">Due Date</p>
                <p className="text-[10px] font-bold text-[var(--text-primary)] mt-0.5">{selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : "No date"}</p>
              </div>
              {selectedTask.estimated_hours && (
                <div className="p-3 bg-primary rounded-xl">
                  <p className="text-[7px] font-black text-slate-500 uppercase tracking-wider">Est. Hours</p>
                  <p className="text-[10px] font-bold text-[var(--text-primary)] mt-0.5">{selectedTask.estimated_hours}h</p>
                </div>
              )}
              <div className="p-3 bg-primary rounded-xl">
                <p className="text-[7px] font-black text-slate-500 uppercase tracking-wider">Labels</p>
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  {(selectedTask.labels || []).length === 0 ? <span className="text-[9px] text-slate-500">—</span> :
                    selectedTask.labels.map((label, index) => <span key={index} className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-brand-orange/10 text-[var(--brand-orange)]">{label}</span>)
                  }
                </div>
              </div>
            </div>

            {/* Checklist */}
            {(selectedTask.checklist || []).length > 0 && (
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Checklist ({selectedTask.checklist.filter((checklistItem) => checklistItem.done).length}/{selectedTask.checklist.length})
                </p>
                <div className="space-y-1">
                  {selectedTask.checklist.map((checklistItem, index) => (
                    <label key={index} className="flex items-center gap-2 p-2 rounded-lg hover:bg-primary cursor-pointer">
                      <input type="checkbox" checked={checklistItem.done} onChange={async () => {
                        const updated = [...selectedTask.checklist];
                        updated[index] = { ...updated[index], done: !updated[index].done };
                        setSelectedTask((previous) => ({ ...previous, checklist: updated }));
                        await fetch(`/api/ventures/${id}/tasks?id=${selectedTask.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checklist: updated }) });
                      }} className="rounded border-slate-600 text-[var(--brand-orange)]" />
                      <span className={`text-[10px] font-bold ${checklistItem.done ? "text-slate-500 line-through" : "text-[var(--text-primary)]"}`}>{checklistItem.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Comments ({comments.length})</p>
                <button onClick={() => setShowComments(!showComments)} className="text-[8px] font-bold text-[var(--brand-orange)] hover:underline">
                  {showComments ? "Hide" : "Show"}
                </button>
              </div>
              {showComments && (
                <div className="space-y-3">
                  {comments.length === 0 && <p className="text-sm text-[var(--text-secondary)]">No comments</p>}
                  {comments.map((comment) => (
                    <div key={comment.id} className="p-3 bg-primary rounded-xl border border-[var(--border-primary)]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-bold text-[var(--text-primary)]">{comment.author_name || comment.author_cid}</span>
                        <span className="text-[10px] text-[var(--text-secondary)]">{new Date(comment.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)]">{comment.body}</p>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add a comment..."
                      className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
                    <button onClick={addComment} disabled={!commentText.trim()}
                      className="px-3 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[8px] font-black uppercase tracking-wider hover:brightness-110 disabled:opacity-30">Send</button>
                  </div>
                </div>
              )}
            </div>

            {/* Activity log link */}
            <div className="text-center pt-4 border-t border-[var(--border-primary)]">
              <button onClick={() => setShowDrawer(false)} className="text-[8px] font-bold text-slate-500 hover:text-[var(--text-primary)]">Close</button>
            </div>
          </div>
        </div>
      </div>
    )
  );
}
