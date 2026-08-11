"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar, Trophy, Send, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, AlertTriangle, User, Paperclip,
} from "lucide-react";

function getCurrentWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const week = Math.ceil((diff / 604800000 + start.getDay() + 1) / 7);
  return { week: Math.min(week, 52), year: now.getFullYear() };
}

const STATUS_CFG = {
  pending:      { label: "Pending",   dot: "bg-slate-500",   text: "text-slate-400" },
  in_progress:  { label: "Active",    dot: "bg-blue-500",    text: "text-blue-400" },
  blocked:      { label: "Blocked",   dot: "bg-red-500",     text: "text-red-400" },
  completed:    { label: "Done",      dot: "bg-emerald-500", text: "text-emerald-400" },
  carried_over: { label: "Carried",   dot: "bg-purple-500",  text: "text-purple-400" },
};

function TaskDot({ status, onClick }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <button
      onClick={onClick}
      title={`Click to change status (${cfg.label})`}
      className={`w-3 h-3 rounded-full shrink-0 transition-transform hover:scale-125 ${cfg.dot}`}
    />
  );
}

function TaskRow({ task, expanded, onToggle, onStatusChange, onArchive, onDelete }) {
  const cfg = STATUS_CFG[task.status] || STATUS_CFG.pending;
  const isDone = task.status === "completed";

  const cycleStatus = () => {
    const next = task.status === "completed" ? "in_progress" : task.status === "blocked" ? "in_progress" : "completed";
    onStatusChange(task.id, next);
  };

  return (
    <div>
      <div
        onClick={onToggle}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors group"
        style={{ borderBottom: "1px solid rgb(255 255 255 / 0.04)" }}
      >
        <TaskDot status={task.status} onClick={(e) => { e.stopPropagation(); cycleStatus(); }} />
        <span className="text-[12px] font-bold text-[var(--text-primary)] truncate flex-1"
          style={{ textDecoration: isDone ? "line-through" : "none", opacity: isDone ? 0.45 : 1 }}>
          {task.title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {task.blockers?.length > 0 && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-red-400">
              <AlertTriangle className="w-3 h-3" /> {task.blockers.length}
            </span>
          )}
          {(task.link || task.attachments?.length > 0) && (
            <Paperclip className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          )}
          {task.assigned_to && (
            <User className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          )}
          {task.is_carryover && (
            <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 uppercase">
              W{task.created_week}
            </span>
          )}
          <span className={`text-[8px] font-bold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-6 py-4 space-y-3 border-b border-white/[0.04]" style={{ backgroundColor: "rgb(255 255 255 / 0.01)" }}>
          {task.description && (
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{task.description}</p>
          )}
          {task.blockers?.length > 0 && (
            <div>
              <p className="text-[8px] font-black text-red-400 uppercase tracking-wider mb-1.5">Blockers ({task.blockers.length})</p>
              {task.blockers.map((b) => (
                <div key={b.id} className="flex items-center gap-2 text-[10px]">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span className="text-[var(--text-primary)]">{b.title}</span>
                  <span className="text-[var(--text-tertiary)]">· {b.severity}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-[9px] text-[var(--text-tertiary)]">
            {task.start_date && <span>Start: {task.start_date}</span>}
            {task.end_date && <span>Due: {task.end_date}</span>}
            {task.assigned_to && <span>Assigned to: {task.assigned_to}</span>}
          </div>
          <div className="flex items-center gap-2 pt-2">
            {!isDone && (
              <button onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, "completed"); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors">
                <CheckCircle2 className="w-3 h-3" /> Complete
              </button>
            )}
            {task.status === "blocked" && (
              <button onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, "in_progress"); }}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 transition-colors">
                Unblock
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onArchive(task.id); }}
              className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
              Archive
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-red-400/60 hover:text-red-400 transition-colors">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StandupRetroView({ user, context, contextLabel }) {
  const [tab, setTab] = useState("standup");
  const [week, setWeek] = useState(getCurrentWeek());
  const [report, setReport] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [standupForm, setStandupForm] = useState({ priorities: "", deliverables: "", notes: "" });
  const [retroForm, setRetroForm] = useState({ wentWell: "", wentWrong: "", improve: "" });
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  const ctx = context || { context_type: "staff", context_id: null };

  const fetchData = useCallback(async () => {
    if (!user?.cid) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ user_id: user.cid, week: week.week, year: week.year, context_type: ctx.context_type });
      if (ctx.context_id) params.set("context_id", ctx.context_id);
      const res = await fetch(`/api/standups/current?${params}`);
      const data = await res.json();
      if (data.success) {
        setReport(data.report);
        setTasks(data.tasks || []);
        if (data.report?.report_type === "standup") {
          try { const p = JSON.parse(data.report.top_priorities || "[]"); setStandupForm({ priorities: Array.isArray(p) ? p.join("\n") : (data.report.top_priorities || ""), deliverables: data.report.expected_deliverables || "", notes: data.report.additional_notes || "" }); } catch { setStandupForm({ priorities: data.report.top_priorities || "", deliverables: data.report.expected_deliverables || "", notes: data.report.additional_notes || "" }); }
        }
        if (data.report?.report_type === "retro") {
          try { const w = JSON.parse(data.report.wins || "[]"); setRetroForm({ wentWell: Array.isArray(w) ? w.join("\n") : (data.report.wins || ""), wentWrong: data.report.challenges || "", improve: data.report.carryover_items || "" }); } catch { setRetroForm({ wentWell: data.report.wins || "", wentWrong: data.report.challenges || "", improve: data.report.carryover_items || "" }); }
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [user?.cid, week.week, week.year, ctx.context_type, ctx.context_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await fetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, status: newStatus, user_id: user.cid }) });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (e) { setToast({ type: "error", msg: "Failed to update task" }); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setCreatingTask(true);
    try {
      const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.cid, user_name: user.name, title: newTaskTitle.trim(), created_week: week.week, created_year: week.year, context_type: ctx.context_type, context_id: ctx.context_id || null }) });
      const data = await res.json();
      if (data.success) { setNewTaskTitle(""); setShowNewTask(false); fetchData(); }
      else setToast({ type: "error", msg: data.error || "Failed" });
    } catch (e) { setToast({ type: "error", msg: "Network error" }); } finally { setCreatingTask(false); }
  };

  const handleArchive = (taskId) => handleStatusChange(taskId, "archived");
  const handleDelete = async (taskId) => {
    try {
      await fetch(`/api/tasks?id=${taskId}&user_id=${user.cid}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (e) { setToast({ type: "error", msg: "Failed to delete" }); }
  };

  const submitStandup = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/standups/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.cid, user_name: user.name, user_role: user.role || "staff", week_number: week.week, year: week.year, top_priorities: standupForm.priorities, expected_deliverables: standupForm.deliverables, additional_notes: standupForm.notes, context_type: ctx.context_type, context_id: ctx.context_id || null }) });
      const data = await res.json();
      setToast({ type: data.success ? "success" : "error", msg: data.success ? "Stand-Up submitted" : data.error });
      if (data.success) fetchData();
    } catch { setToast({ type: "error", msg: "Network error" }); } finally { setSaving(false); }
  };

  const submitRetro = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/retros/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.cid, user_name: user.name, user_role: user.role || "staff", week_number: week.week, year: week.year, wins: retroForm.wentWell, challenges: retroForm.wentWrong, unfinished_tasks: retroForm.improve, context_type: ctx.context_type, context_id: ctx.context_id || null }) });
      const data = await res.json();
      setToast({ type: data.success ? "success" : "error", msg: data.success ? "Retro submitted" : data.error });
      if (data.success) fetchData();
    } catch { setToast({ type: "error", msg: "Network error" }); } finally { setSaving(false); }
  };

  const changeWeek = (dir) => setWeek((prev) => { let w = prev.week + dir, y = prev.year; if (w < 1) { w = 52; y--; } if (w > 52) { w = 1; y++; } return { week: w, year: y }; });

  const isSubmitted = report?.status === "submitted";
  const active = tasks.filter((t) => !["completed", "archived"].includes(t.status));
  const done = tasks.filter((t) => t.status === "completed");
  const blocked = tasks.filter((t) => t.status === "blocked");

  if (loading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }} className="space-y-6 pb-16">
      {toast && (
        <div onClick={() => setToast(null)} className={`cursor-pointer text-[10px] font-bold px-4 py-2 rounded-lg text-center ${toast.type === "error" ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>
          {toast.msg}
        </div>
      )}

      <div className="text-center space-y-1">
        <p className="text-[9px] font-black text-[var(--brand-orange)] uppercase tracking-[0.3em]">{tab === "standup" ? "Monday Stand-Up" : "Friday Retro"}</p>
        <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Week {week.week}, {week.year}</h2>
        {contextLabel && <p className="text-[10px] text-[var(--text-secondary)]">{contextLabel}</p>}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button onClick={() => changeWeek(-1)} className="p-2 rounded-lg hover:bg-white/5"><ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" /></button>
        <div className="flex bg-white/5 rounded-lg p-0.5">
          <button onClick={() => { setTab("standup"); setExpandedTask(null); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-wider ${tab === "standup" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)]"}`}><Calendar className="w-3.5 h-3.5" />Stand-Up</button>
          <button onClick={() => { setTab("retro"); setExpandedTask(null); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-wider ${tab === "retro" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)]"}`}><Trophy className="w-3.5 h-3.5" />Retro</button>
        </div>
        <button onClick={() => changeWeek(1)} className="p-2 rounded-lg hover:bg-white/5"><ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" /></button>
      </div>

      {isSubmitted && (
        <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{tab === "standup" ? "Stand-Up" : "Retro"} submitted for this week</span>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider">{tasks.length} tasks this week</span>
          <span className="text-[9px] font-black text-[var(--text-secondary)]">{tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--brand-orange)] transition-all duration-700 ease-out" style={{ width: `${tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0}%` }} />
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <span className="text-[10px] font-bold text-blue-400">🔵 {active.length} active</span>
        <span className="text-[10px] font-bold text-emerald-400">🟢 {done.length} done</span>
        <span className="text-[10px] font-bold text-red-400">🔴 {blocked.length} blocked</span>
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ backgroundColor: "rgb(255 255 255 / 0.01)" }}>
        {tasks.length === 0 ? (
          <div className="text-center py-10"><p className="text-[11px] text-[var(--text-tertiary)] italic">No tasks yet</p></div>
        ) : (
          tasks.map((task) => (
            <TaskRow key={task.id} task={task} expanded={expandedTask === task.id}
              onToggle={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
              onStatusChange={handleStatusChange} onArchive={handleArchive} onDelete={handleDelete} />
          ))
        )}
        {!showNewTask ? (
          <button onClick={() => setShowNewTask(true)} className="w-full px-4 py-3 text-left text-[11px] text-[var(--text-tertiary)] italic hover:text-[var(--text-secondary)] hover:bg-white/[0.02] transition-colors">
            + Write next task...
          </button>
        ) : (
          <form onSubmit={handleCreateTask} className="px-4 py-3 border-t border-white/[0.06]">
            <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Task title..." autoFocus
              className="w-full bg-transparent text-[12px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              onKeyDown={(e) => { if (e.key === "Escape") { setShowNewTask(false); setNewTaskTitle(""); } }}
              onBlur={() => { if (!newTaskTitle.trim()) { setShowNewTask(false); } }} />
          </form>
        )}
      </div>

      <form onSubmit={tab === "standup" ? submitStandup : submitRetro} className="space-y-4">
        {tab === "standup" ? (
          <>
            <div>
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">This week's priorities</label>
              <textarea value={standupForm.priorities} onChange={(e) => setStandupForm((f) => ({ ...f, priorities: e.target.value }))} rows={3} placeholder="What are your main priorities this week?"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)]/40 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">Expected deliverables by Friday</label>
              <textarea value={standupForm.deliverables} onChange={(e) => setStandupForm((f) => ({ ...f, deliverables: e.target.value }))} rows={2} placeholder="What will you ship this week?"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)]/40 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">Blockers / Support needed</label>
              <textarea value={standupForm.notes} onChange={(e) => setStandupForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Anything blocking you or support you need?"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)]/40 transition-colors" />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">What went well?</label>
              <textarea value={retroForm.wentWell} onChange={(e) => setRetroForm((f) => ({ ...f, wentWell: e.target.value }))} rows={3} placeholder="Wins, completed work, positive outcomes..."
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)]/40 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">What didn't go well?</label>
              <textarea value={retroForm.wentWrong} onChange={(e) => setRetroForm((f) => ({ ...f, wentWrong: e.target.value }))} rows={2} placeholder="Challenges, blockers, delays..."
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)]/40 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">What will improve next week?</label>
              <textarea value={retroForm.improve} onChange={(e) => setRetroForm((f) => ({ ...f, improve: e.target.value }))} rows={2} placeholder="Action items, carry-forward, improvements..."
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)]/40 transition-colors" />
            </div>
          </>
        )}

        <button type="submit" disabled={saving}
          className="w-full py-3.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ backgroundColor: "var(--brand-orange)", color: "#000" }}>
          {saving ? "Saving..." : <><Send className="w-4 h-4" /> {tab === "standup" ? "Submit Stand-Up" : "Submit Retro"}</>}
        </button>
      </form>
    </div>
  );
}
