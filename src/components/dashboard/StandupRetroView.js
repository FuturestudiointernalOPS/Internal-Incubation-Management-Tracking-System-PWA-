"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar, Trophy, Send, ChevronLeft, ChevronRight, ChevronDown,
  CheckCircle2, Clock, AlertTriangle, User, Paperclip,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

function getCurrentWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const week = Math.ceil((diff / 604800000 + start.getDay() + 1) / 7);
  return { week: Math.min(week, 52), year: now.getFullYear() };
}

const STATUS_CFG = {
  pending:      { dot: "bg-slate-500",   text: "text-slate-400" },
  in_progress:  { dot: "bg-blue-500",    text: "text-blue-400" },
  blocked:      { dot: "bg-red-500",     text: "text-red-400" },
  completed:    { dot: "bg-emerald-500", text: "text-emerald-400" },
  carried_over: { dot: "bg-purple-500",  text: "text-purple-400" },
};

function TaskDot({ status, onClick }) {
  const { t } = useI18n();
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  const statusLabels = {
    pending: t("staffMisc.standupRetro.statusPending"),
    in_progress: t("staffMisc.standupRetro.statusActive"),
    blocked: t("staffMisc.standupRetro.statusBlocked"),
    completed: t("staffMisc.standupRetro.statusDone"),
    carried_over: t("staffMisc.standupRetro.statusCarried"),
  };
  return (
    <button
      onClick={onClick}
      title={t("staffMisc.standupRetro.changeStatusTitle", { label: statusLabels[status] || statusLabels.pending })}
      className={`w-3 h-3 rounded-full shrink-0 transition-transform hover:scale-125 ${cfg.dot}`}
    />
  );
}

function TaskRow({ task, expanded, onToggle, onStatusChange, onArchive, onDelete, onAssign, onAddBlocker, onSetDueDate, allStaff }) {
  const { t } = useI18n();
  const cfg = STATUS_CFG[task.status] || STATUS_CFG.pending;
  const statusLabels = {
    pending: t("staffMisc.standupRetro.statusPending"),
    in_progress: t("staffMisc.standupRetro.statusActive"),
    blocked: t("staffMisc.standupRetro.statusBlocked"),
    completed: t("staffMisc.standupRetro.statusDone"),
    carried_over: t("staffMisc.standupRetro.statusCarried"),
  };
  const isDone = task.status === "completed";
  const [showAssign, setShowAssign] = useState(false);
  const [showBlocker, setShowBlocker] = useState(false);
  const [showDueDate, setShowDueDate] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [blockerTitle, setBlockerTitle] = useState("");
  const [dueDate, setDueDate] = useState(task.end_date || "");

  const cycleStatus = () => {
    const next = task.status === "completed" ? "in_progress" : task.status === "blocked" ? "in_progress" : "completed";
    onStatusChange(task.id, next);
  };

  const filteredStaff = (allStaff || []).filter((s) =>
    !assignSearch || (s.name || "").toLowerCase().includes(assignSearch.toLowerCase())
  ).slice(0, 5);

  const handleBlockerSubmit = (e) => {
    e.preventDefault();
    if (!blockerTitle.trim()) return;
    onAddBlocker(task.id, blockerTitle.trim());
    setBlockerTitle("");
    setShowBlocker(false);
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
              {t("staffMisc.standupRetro.carryoverWeek", { week: task.created_week })}
            </span>
          )}
          <span className={`text-[8px] font-bold uppercase tracking-wider ${cfg.text}`}>{statusLabels[task.status] || statusLabels.pending}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-tertiary)] ml-1 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="px-6 py-4 space-y-3 border-b border-white/[0.04]" style={{ backgroundColor: "rgb(255 255 255 / 0.01)" }}>
          {task.description && (
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{task.description}</p>
          )}
          {task.blockers?.length > 0 && (
            <div>
              <p className="text-[8px] font-black text-red-400 uppercase tracking-wider mb-1.5">{t("staffMisc.standupRetro.blockers", { count: task.blockers.length })}</p>
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
            {task.start_date && <span>{t("staffMisc.standupRetro.startDate", { date: task.start_date })}</span>}
            {task.end_date && <span>{t("staffMisc.standupRetro.dueDate", { date: task.end_date })}</span>}
            {task.assigned_to && <span>{t("staffMisc.standupRetro.assignedTo", { name: task.assigned_to })}</span>}
          </div>

          {/* ── Assign / Blocker / Due Date (Phase 8) ── */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Assign */}
            <div className="relative">
              {!showAssign ? (
                <button onClick={(e) => { e.stopPropagation(); setShowAssign(true); }} className="text-[9px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  + {task.assigned_to ? t("staffMisc.standupRetro.reassign") : t("staffMisc.standupRetro.assign")}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text" value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)}
                    placeholder={t("staffMisc.standupRetro.searchTeammate")} autoFocus
                    className="w-40 px-2 py-1 rounded bg-white/[0.05] border border-white/10 text-[10px] text-[var(--text-primary)] outline-none"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => { if (e.key === "Escape") { setShowAssign(false); setAssignSearch(""); } }} />
                  <button onClick={(e) => { e.stopPropagation(); setShowAssign(false); setAssignSearch(""); }} className="text-[9px] text-[var(--text-tertiary)]">✕</button>
                  {assignSearch && filteredStaff.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-48 rounded-lg border border-white/10 bg-[#0f172a] shadow-xl z-10" onClick={(e) => e.stopPropagation()}>
                      {filteredStaff.map((s) => (
                        <button key={s.id} onClick={() => { onAssign(task.id, s.id); setShowAssign(false); setAssignSearch(""); }}
                          className="w-full text-left px-3 py-1.5 text-[10px] text-[var(--text-primary)] hover:bg-white/10">
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Due date */}
            {!showDueDate ? (
              <button onClick={(e) => { e.stopPropagation(); setShowDueDate(true); }} className="text-[9px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                + {task.end_date ? t("staffMisc.standupRetro.changeDue") : t("staffMisc.standupRetro.dueDateButton")}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); onSetDueDate(task.id, e.target.value); setShowDueDate(false); }}
                  className="w-32 px-2 py-1 rounded bg-white/[0.05] border border-white/10 text-[10px] text-[var(--text-primary)] outline-none"
                  onClick={(e) => e.stopPropagation()} />
                <button onClick={(e) => { e.stopPropagation(); setShowDueDate(false); }} className="text-[9px] text-[var(--text-tertiary)]">✕</button>
              </div>
            )}

            {/* Add blocker */}
            {!showBlocker ? (
              <button onClick={(e) => { e.stopPropagation(); setShowBlocker(true); }} className="text-[9px] font-bold text-red-400/70 hover:text-red-400 transition-colors">
                + {t("staffMisc.standupRetro.blocker")}
              </button>
            ) : (
              <form onSubmit={handleBlockerSubmit} className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input type="text" value={blockerTitle} onChange={(e) => setBlockerTitle(e.target.value)}
                  placeholder={t("staffMisc.standupRetro.whatsBlocking")} autoFocus
                  className="w-40 px-2 py-1 rounded bg-white/[0.05] border border-white/10 text-[10px] text-[var(--text-primary)] outline-none" />
                <button type="submit" className="text-[9px] font-bold text-red-400">{t("staffMisc.standupRetro.add")}</button>
                <button type="button" onClick={() => { setShowBlocker(false); setBlockerTitle(""); }} className="text-[9px] text-[var(--text-tertiary)]">✕</button>
              </form>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            {!isDone && (
              <button onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, "completed"); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors">
                <CheckCircle2 className="w-3 h-3" /> {t("staffMisc.standupRetro.complete")}
              </button>
            )}
            {task.status === "blocked" && (
              <button onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, "in_progress"); }}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 transition-colors">
                {t("staffMisc.standupRetro.unblock")}
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onArchive(task.id); }}
              className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
              {t("staffMisc.standupRetro.archive")}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-red-400/60 hover:text-red-400 transition-colors">
              {t("staffMisc.standupRetro.delete")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StandupRetroView({ user, context, contextLabel }) {
  const { t } = useI18n();
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
  const [allStaff, setAllStaff] = useState([]);

  const ctx = context || { context_type: "staff", context_id: null };

  const fetchData = useCallback(async () => {
    if (!user?.cid) { setLoading(false); return; }
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

  /* ─── Fetch staff for assignment ─── */
  useEffect(() => {
    if (!user?.cid) return;
    fetch("/api/contacts?role=staff")
      .then((r) => r.json())
      .then((d) => { if (d.success) setAllStaff(d.contacts || []); })
      .catch(() => {});
  }, [user?.cid]);

  /* ─── Assignment / Blocker / Due Date handlers ─── */
  const handleAssign = async (taskId, assigneeId) => {
    try {
      const res = await fetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, assigned_to: assigneeId, user_id: user.cid }) });
      const data = await res.json();
      if (!data.success) setToast({ type: "error", msg: data.error || t("staffMisc.standupRetro.assignmentFailed") });
      else { setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, assigned_to: assigneeId } : t)); setToast({ type: "success", msg: t("staffMisc.standupRetro.assigned") }); }
    } catch (e) { setToast({ type: "error", msg: t("staffMisc.standupRetro.networkError") }); }
  };

  const handleAddBlocker = async (taskId, blockerTitle) => {
    try {
      const res = await fetch("/api/blockers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task_id: taskId, user_id: user.cid, user_name: user.name, title: blockerTitle }) });
      const data = await res.json();
      if (!data.success) setToast({ type: "error", msg: data.error || t("staffMisc.standupRetro.blockerFailed") });
      else { setToast({ type: "success", msg: t("staffMisc.standupRetro.blockerAdded") }); fetchData(); }
    } catch (e) { setToast({ type: "error", msg: t("staffMisc.standupRetro.networkError") }); }
  };

  const handleSetDueDate = async (taskId, date) => {
    try {
      await fetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, end_date: date, user_id: user.cid }) });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, end_date: date } : t));
    } catch (e) { /* silent */ }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await fetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, status: newStatus, user_id: user.cid }) });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (e) { setToast({ type: "error", msg: t("staffMisc.standupRetro.failedToUpdateTask") }); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setCreatingTask(true);
    try {
      const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.cid, user_name: user.name, title: newTaskTitle.trim(), created_week: week.week, created_year: week.year, context_type: ctx.context_type, context_id: ctx.context_id || null }) });
      const data = await res.json();
      if (data.success) { setNewTaskTitle(""); setShowNewTask(false); fetchData(); }
      else setToast({ type: "error", msg: data.error || t("staffMisc.standupRetro.failed") });
    } catch (e) { setToast({ type: "error", msg: t("staffMisc.standupRetro.networkError") }); } finally { setCreatingTask(false); }
  };

  const handleArchive = (taskId) => handleStatusChange(taskId, "archived");
  const handleDelete = async (taskId) => {
    try {
      await fetch(`/api/tasks?id=${taskId}&user_id=${user.cid}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (e) { setToast({ type: "error", msg: t("staffMisc.standupRetro.failedToDelete") }); }
  };

  const submitStandup = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/standups/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.cid, user_name: user.name, user_role: user.role || "staff", week_number: week.week, year: week.year, top_priorities: standupForm.priorities, expected_deliverables: standupForm.deliverables, additional_notes: standupForm.notes, context_type: ctx.context_type, context_id: ctx.context_id || null }) });
      const data = await res.json();
      setToast({ type: data.success ? "success" : "error", msg: data.success ? t("staffMisc.standupRetro.standupSubmitted") : data.error });
      if (data.success) fetchData();
    } catch { setToast({ type: "error", msg: t("staffMisc.standupRetro.networkError") }); } finally { setSaving(false); }
  };

  const submitRetro = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/retros/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.cid, user_name: user.name, user_role: user.role || "staff", week_number: week.week, year: week.year, wins: retroForm.wentWell, challenges: retroForm.wentWrong, unfinished_tasks: retroForm.improve, context_type: ctx.context_type, context_id: ctx.context_id || null }) });
      const data = await res.json();
      setToast({ type: data.success ? "success" : "error", msg: data.success ? t("staffMisc.standupRetro.retroSubmitted") : data.error });
      if (data.success) fetchData();
    } catch { setToast({ type: "error", msg: t("staffMisc.standupRetro.networkError") }); } finally { setSaving(false); }
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
        <p className="text-[9px] font-black text-[var(--brand-orange)] uppercase tracking-[0.3em]">{tab === "standup" ? t("staffMisc.standupRetro.mondayStandup") : t("staffMisc.standupRetro.fridayRetro")}</p>
        <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">{t("staffMisc.standupRetro.weekLabel", { week: week.week, year: week.year })}</h2>
        {contextLabel && <p className="text-[10px] text-[var(--text-secondary)]">{contextLabel}</p>}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button onClick={() => changeWeek(-1)} className="p-2 rounded-lg hover:bg-white/5"><ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" /></button>
        <div className="flex bg-white/5 rounded-lg p-0.5">
          <button onClick={() => { setTab("standup"); setExpandedTask(null); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-wider ${tab === "standup" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)]"}`}><Calendar className="w-3.5 h-3.5" />{t("staffMisc.standupRetro.standupTab")}</button>
          <button onClick={() => { setTab("retro"); setExpandedTask(null); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-wider ${tab === "retro" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)]"}`}><Trophy className="w-3.5 h-3.5" />{t("staffMisc.standupRetro.retroTab")}</button>
        </div>
        <button onClick={() => changeWeek(1)} className="p-2 rounded-lg hover:bg-white/5"><ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" /></button>
      </div>

      {isSubmitted && (
        <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{tab === "standup" ? t("staffMisc.standupRetro.standupTab") : t("staffMisc.standupRetro.retroTab")} {t("staffMisc.standupRetro.submittedForWeek")}</span>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider">{t("staffMisc.standupRetro.tasksThisWeek", { count: tasks.length })}</span>
          <span className="text-[9px] font-black text-[var(--text-secondary)]">{tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--brand-orange)] transition-all duration-700 ease-out" style={{ width: `${tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0}%` }} />
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <span className="text-[10px] font-bold text-blue-400">🔵 {active.length} {t("staffMisc.standupRetro.activeCount")}</span>
        <span className="text-[10px] font-bold text-emerald-400">🟢 {done.length} {t("staffMisc.standupRetro.doneCount")}</span>
        <span className="text-[10px] font-bold text-red-400">🔴 {blocked.length} {t("staffMisc.standupRetro.blockedCount")}</span>
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ backgroundColor: "rgb(255 255 255 / 0.01)" }}>
        {tasks.length === 0 ? (
          <div className="text-center py-10"><p className="text-[11px] text-[var(--text-tertiary)] italic">{t("staffMisc.standupRetro.noTasksYet")}</p></div>
        ) : (
          tasks.map((task) => (
            <TaskRow key={task.id} task={task} expanded={expandedTask === task.id}
              onToggle={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
              onStatusChange={handleStatusChange} onArchive={handleArchive} onDelete={handleDelete}
              onAssign={handleAssign} onAddBlocker={handleAddBlocker} onSetDueDate={handleSetDueDate}
              allStaff={allStaff} />
          ))
        )}
        {!showNewTask ? (
          <button onClick={() => setShowNewTask(true)} className="w-full px-4 py-3 text-left text-[11px] text-[var(--text-tertiary)] italic hover:text-[var(--text-secondary)] hover:bg-white/[0.02] transition-colors">
            + {t("staffMisc.standupRetro.writeNextTask")}
          </button>
        ) : (
          <form onSubmit={handleCreateTask} className="px-4 py-3 border-t border-white/[0.06]">
            <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder={t("staffMisc.standupRetro.taskTitlePlaceholder")} autoFocus
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
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">{t("staffMisc.standupRetro.thisWeeksPriorities")}</label>
              <textarea value={standupForm.priorities} onChange={(e) => setStandupForm((f) => ({ ...f, priorities: e.target.value }))} rows={3} placeholder={t("staffMisc.standupRetro.prioritiesPlaceholder")}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)]/40 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">{t("staffMisc.standupRetro.expectedDeliverables")}</label>
              <textarea value={standupForm.deliverables} onChange={(e) => setStandupForm((f) => ({ ...f, deliverables: e.target.value }))} rows={2} placeholder={t("staffMisc.standupRetro.deliverablesPlaceholder")}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)]/40 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">{t("staffMisc.standupRetro.blockersSupportNeeded")}</label>
              <textarea value={standupForm.notes} onChange={(e) => setStandupForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder={t("staffMisc.standupRetro.supportPlaceholder")}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)]/40 transition-colors" />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">{t("staffMisc.standupRetro.whatWentWell")}</label>
              <textarea value={retroForm.wentWell} onChange={(e) => setRetroForm((f) => ({ ...f, wentWell: e.target.value }))} rows={3} placeholder={t("staffMisc.standupRetro.wentWellPlaceholder")}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)]/40 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">{t("staffMisc.standupRetro.whatDidntGoWell")}</label>
              <textarea value={retroForm.wentWrong} onChange={(e) => setRetroForm((f) => ({ ...f, wentWrong: e.target.value }))} rows={2} placeholder={t("staffMisc.standupRetro.wentWrongPlaceholder")}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)]/40 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">{t("staffMisc.standupRetro.whatWillImprove")}</label>
              <textarea value={retroForm.improve} onChange={(e) => setRetroForm((f) => ({ ...f, improve: e.target.value }))} rows={2} placeholder={t("staffMisc.standupRetro.improvePlaceholder")}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)]/40 transition-colors" />
            </div>
          </>
        )}

        <button type="submit" disabled={saving}
          className="w-full py-3.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ backgroundColor: "var(--brand-orange)", color: "#000" }}>
          {saving ? t("staffMisc.standupRetro.saving") : <><Send className="w-4 h-4" /> {tab === "standup" ? t("staffMisc.standupRetro.submitStandup") : t("staffMisc.standupRetro.submitRetro")}</>}
        </button>
      </form>
    </div>
  );
}
