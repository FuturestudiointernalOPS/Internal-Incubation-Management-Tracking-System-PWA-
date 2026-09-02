"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Loader2, CheckCircle2, AlertCircle, AlertTriangle, X, Trash2, Edit3,
  Calendar, Clock, User, Paperclip, MessageCircle, Flag, ChevronDown, ChevronRight,
  List, Columns, LayoutGrid, Circle, Square,
} from "lucide-react";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

const STATUS_ORDER = ["backlog", "todo", "in_progress", "review", "done", "blocked", "cancelled"];

const STATUS_CFG = {
  backlog: { label: "Backlog", color: "bg-slate-500/10 text-slate-400", dot: "bg-slate-400" },
  todo: { label: "To Do", color: "bg-blue-500/10 text-blue-400", dot: "bg-blue-400" },
  in_progress: { label: "In Progress", color: "bg-amber-500/10 text-amber-400", dot: "bg-amber-400" },
  review: { label: "Review", color: "bg-purple-500/10 text-purple-400", dot: "bg-purple-400" },
  done: { label: "Done", color: "bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-400" },
  blocked: { label: "Blocked", color: "bg-rose-500/10 text-rose-400", dot: "bg-rose-400" },
  cancelled: { label: "Cancelled", color: "bg-slate-500/5 text-slate-500", dot: "bg-slate-500" },
};

const PRIORITY_CFG = { low: "text-slate-500", medium: "text-blue-400", high: "text-amber-400", critical: "text-rose-400" };

export default function VentureTasksPage() {
  const { id } = useParams();
  const router = useRouter();
  const [venture, setVenture] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [byStatus, setByStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("kanban"); // kanban | list
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  // Task detail drawer
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);

  // Create/edit modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [tForm, setTForm] = useState({ title: "", description: "", priority: "medium", status: "todo", due_date: "", estimated_hours: "", assigned_cid: "", assigned_name: "", labels: [], milestone_id: "" });
  const [saving, setSaving] = useState(false);

  // Comment input
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);

  // Search
  const [search, setSearch] = useState("");

  useEffect(() => { fetchData(); }, []);

  const notify = (msg, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async (bypassCache = false) => {
    const urls = [`/api/ventures/${id}`, `/api/ventures/${id}/tasks`];
    const apply = (vData, tData) => {
      if (vData.success) setVenture(vData.venture);
      if (tData.success) {
        setTasks(tData.tasks || []);
        setByStatus(tData.by_status || {});
      }
    };
    let painted = false;
    setLoading(true);
    try {
      // Cache-first paint: returning to this page renders instantly from
      // fresh snapshots; mutation flows pass bypassCache=true so the board
      // always reflects the last action.
      if (!bypassCache) {
        const cached = urls.map((u) => cacheGet(u));
        if (cached.every((c) => c !== null && c.success)) {
          apply(cached[0], cached[1]);
          setLoading(false);
          painted = true;
        }
      }
      const [vRes, tRes] = await Promise.all([fetch(urls[0]), fetch(urls[1])]);
      const vData = await vRes.json();
      const tData = await tRes.json();
      if (vData.success) cacheSet(urls[0], vData);
      if (tData.success) cacheSet(urls[1], tData);
      apply(vData, tData);
    } catch (e) {
      if (!painted) console.error("Failed to fetch tasks data:", e);
    } finally {
      setLoading(false);
    }
  };

  const openTask = async (task) => {
    setSelectedTask(task);
    setShowDrawer(true);
    setShowComments(false);
    try {
      const res = await fetch(`/api/ventures/${id}/tasks?id=${task.id}&action=get_comments`, { method: "PATCH" });
      const d = await res.json();
      if (d.success) setComments(d.comments || []);
    } catch {}
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await fetch(`/api/ventures/${id}/tasks?id=${taskId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }),
      });
      fetchData(true);
    } catch {}
  };

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData("taskId", taskId);
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    setDragOver(null);
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) updateTaskStatus(parseInt(taskId), status);
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    setDragOver(status);
  };

  const handleDragLeave = () => setDragOver(null);

  const createOrUpdateTask = async () => {
    if (!tForm.title.trim()) { notify("Title required", "error"); return; }
    setSaving(true);
    try {
      if (editTask) {
        await fetch(`/api/ventures/${id}/tasks?id=${editTask.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tForm),
        });
        notify("Task updated");
      } else {
        await fetch(`/api/ventures/${id}/tasks`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...tForm, milestone_id: tForm.milestone_id || null }),
        });
        notify("Task created");
      }
      setShowTaskModal(false);
      setEditTask(null);
      setTForm({ title: "", description: "", priority: "medium", status: "todo", due_date: "", estimated_hours: "", assigned_cid: "", assigned_name: "", labels: [], milestone_id: "" });
      fetchData(true);
    } catch { notify("Error saving task", "error"); }
    setSaving(false);
  };

  const addComment = async () => {
    if (!commentText.trim() || !selectedTask) return;
    try {
      await fetch(`/api/ventures/${id}/tasks?id=${selectedTask.id}&action=add_comment`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: commentText.trim() }),
      });
      setCommentText("");
      const res = await fetch(`/api/ventures/${id}/tasks?id=${selectedTask.id}&action=get_comments`, { method: "PATCH" });
      const d = await res.json();
      if (d.success) setComments(d.comments || []);
    } catch { notify("Failed to add comment", "error"); }
  };

  const filteredTasks = tasks.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.assigned_name?.toLowerCase().includes(q);
  });

  const filteredByStatus = {};
  if (search) {
    for (const s of STATUS_ORDER) filteredByStatus[s] = filteredTasks.filter((t) => t.status === s);
  }

  const displayByStatus = search ? filteredByStatus : byStatus;

  if (loading) return (
    <>
      <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div>
    </>
  );

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;

  return (
    <>
      <div className="space-y-8 pb-20">
        {toast && (
          <div className={`fixed top-6 right-6 z-[60] px-5 py-3 rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 ${toast.type === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"}`}>
            {toast.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}{toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}/dashboard`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-[var(--brand-orange)]" /> Tasks
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name || ""} · {totalTasks} tasks · {doneTasks} done</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex bg-tertiary rounded-xl border border-[var(--border-primary)] p-0.5">
              <button onClick={() => setView("kanban")} className={`p-2 rounded-lg transition-all ${view === "kanban" ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]" : "text-slate-500 hover:text-[var(--text-primary)]"}`}>
                <Columns className="w-4 h-4" />
              </button>
              <button onClick={() => setView("list")} className={`p-2 rounded-lg transition-all ${view === "list" ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]" : "text-slate-500 hover:text-[var(--text-primary)]"}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks..." className="w-40 bg-tertiary border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] placeholder:text-slate-600" />
            </div>
            <button onClick={() => { setEditTask(null); setTForm({ title: "", description: "", priority: "medium", status: "todo", due_date: "", estimated_hours: "", assigned_cid: "", assigned_name: "", labels: [], milestone_id: "" }); setShowTaskModal(true); }}
              className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
              <Plus className="w-3.5 h-3.5" /> Add Task
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        {view === "kanban" && (
          <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
            {STATUS_ORDER.map((status) => {
              const cfg = STATUS_CFG[status];
              const items = displayByStatus[status] || [];
              return (
                <div key={status} className="flex-shrink-0 w-64"
                  onDragOver={(e) => handleDragOver(e, status)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, status)}>
                  <div className={`rounded-2xl border ${dragOver === status ? "border-[var(--brand-orange)] bg-[var(--brand-orange)]/5" : "border-[var(--border-primary)] bg-tertiary"}`}>
                    <div className="flex items-center justify-between p-3 border-b border-[var(--border-primary)]">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{cfg.label}</span>
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
                        <div key={task.id} draggable onDragStart={(e) => handleDragStart(e, task.id)}
                          onClick={() => openTask(task)}
                          className="p-3 rounded-xl bg-primary border border-[var(--border-primary)] cursor-pointer hover:border-[var(--brand-orange)]/30 transition-all group">
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
                          </div>
                          {(task.checklist || []).length > 0 && (
                            <div className="mt-2">
                              <div className="w-full bg-tertiary rounded-full h-1 overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((task.checklist.filter((c) => c.done).length / task.checklist.length) * 100)}%` }} />
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
        )}

        {/* List View */}
        {view === "list" && (
          <div className="space-y-1">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-16"><CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">No tasks found</p></div>
            ) : (
              filteredTasks.map((task) => {
                const sc = STATUS_CFG[task.status];
                return (
                  <div key={task.id} onClick={() => openTask(task)}
                    className="flex items-center gap-4 p-4 rounded-xl bg-tertiary border border-[var(--border-primary)] cursor-pointer hover:border-[var(--brand-orange)]/30 transition-all">
                    <span className={`w-2 h-2 rounded-full ${sc.dot} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">{task.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-[8px] text-slate-500">
                        <span className={`${PRIORITY_CFG[task.priority]} font-bold uppercase`}>{task.priority}</span>
                        {task.assigned_name && <span>{task.assigned_name}</span>}
                        {task.milestone_id && <span>Milestone #{task.milestone_id}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${sc.color}`}>{sc.label}</span>
                      {task.due_date && <span className="text-[8px] text-slate-500">{new Date(task.due_date).toLocaleDateString()}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Task Detail Drawer ── */}
      {showDrawer && selectedTask && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDrawer(false)} />
          <div className="relative w-full max-w-lg bg-[var(--bg-tertiary)] border-l border-[var(--border-primary)] overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-[var(--text-primary)]">{selectedTask.title}</h2>
                <button onClick={() => setShowDrawer(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
              </div>

              {/* Status + Priority */}
              <div className="flex gap-3">
                <select value={selectedTask.status} onChange={(e) => { updateTaskStatus(selectedTask.id, e.target.value); setSelectedTask((p) => ({ ...p, status: e.target.value })); }}
                  className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[9px] font-bold text-[var(--text-primary)] outline-none flex-1">
                  {STATUS_ORDER.map((s) => <option key={s} value={s}>{(STATUS_CFG[s]?.label || s)}</option>)}
                </select>
                <select value={selectedTask.priority} onChange={(e) => { setSelectedTask((p) => ({ ...p, priority: e.target.value })); fetch(`/api/ventures/${id}/tasks?id=${selectedTask.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priority: e.target.value }) }); }}
                  className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[9px] font-bold text-[var(--text-primary)] outline-none">
                  {["low", "medium", "high", "critical"].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
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
                      selectedTask.labels.map((l, i) => <span key={i} className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">{l}</span>)
                    }
                  </div>
                </div>
              </div>

              {/* Checklist */}
              {(selectedTask.checklist || []).length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    Checklist ({selectedTask.checklist.filter((c) => c.done).length}/{selectedTask.checklist.length})
                  </p>
                  <div className="space-y-1">
                    {selectedTask.checklist.map((item, i) => (
                      <label key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-primary cursor-pointer">
                        <input type="checkbox" checked={item.done} onChange={async () => {
                          const updated = [...selectedTask.checklist];
                          updated[i] = { ...updated[i], done: !updated[i].done };
                          setSelectedTask((p) => ({ ...p, checklist: updated }));
                          await fetch(`/api/ventures/${id}/tasks?id=${selectedTask.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checklist: updated }) });
                        }} className="rounded border-slate-600 text-[var(--brand-orange)]" />
                        <span className={`text-[10px] font-bold ${item.done ? "text-slate-500 line-through" : "text-[var(--text-primary)]"}`}>{item.text}</span>
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
                    {comments.length === 0 && <p className="text-[10px] text-slate-500 italic">No comments</p>}
                    {comments.map((c) => (
                      <div key={c.id} className="p-3 bg-primary rounded-xl border border-[var(--border-primary)]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-bold text-[var(--text-primary)]">{c.author_name || c.author_cid}</span>
                          <span className="text-[7px] text-slate-500">{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)]">{c.body}</p>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..."
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
      )}

      {/* ── Create/Edit Task Modal ── */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)]">{editTask ? "Edit Task" : "New Task"}</h2>
              <button onClick={() => setShowTaskModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Title *</label>
                <input value={tForm.title} onChange={(e) => setTForm((p) => ({ ...p, title: e.target.value }))} placeholder="What needs to be done?"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Description</label>
                <textarea value={tForm.description} onChange={(e) => setTForm((p) => ({ ...p, description: e.target.value }))} rows={2}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Status</label>
                  <select value={tForm.status} onChange={(e) => setTForm((p) => ({ ...p, status: e.target.value }))}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_CFG[s]?.label || s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Priority</label>
                  <select value={tForm.priority} onChange={(e) => setTForm((p) => ({ ...p, priority: e.target.value }))}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Due Date</label>
                  <input type="date" value={tForm.due_date} onChange={(e) => setTForm((p) => ({ ...p, due_date: e.target.value }))}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Est. Hours</label>
                  <input type="number" value={tForm.estimated_hours} onChange={(e) => setTForm((p) => ({ ...p, estimated_hours: e.target.value }))} placeholder="e.g., 4"
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Assignee</label>
                <input value={tForm.assigned_name} onChange={(e) => setTForm((p) => ({ ...p, assigned_name: e.target.value, assigned_cid: e.target.value }))} placeholder="Team member name"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
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
      )}
    </>
  );
}
