"use client";

import React, { useState } from "react";
import {
  Calendar, Trophy, Send, ChevronLeft, ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { collapseChains } from "@/utils/taskChains";
import TaskRow from "./standup-retro-view/TaskRow";

function getCurrentWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const week = Math.ceil((diff / 604800000 + start.getDay() + 1) / 7);
  return { week: Math.min(week, 52), year: now.getFullYear() };
}

// ─── Read shapers (module scope: built once, never per render) ──────────────
const EMPTY_STANDUP = { report: null, tasks: [] };

// The week's report and its tasks arrive together, so the read's value is both.
// Carry-over chains are displayed as ONE row (the newest copy); older weekly
// copies stay in the database for history/reports.
const pickStandup = (payload) =>
  payload?.success
    ? { report: payload.report ?? null, tasks: collapseChains(payload.tasks || []) }
    : EMPTY_STANDUP;

const pickStaffContacts = (payload) => (payload?.success ? payload.contacts || [] : []);

const EMPTY_STANDUP_FORM = { priorities: "", deliverables: "", notes: "" };
const EMPTY_RETRO_FORM = { wentWell: "", wentWrong: "", improve: "" };
const EMPTY_EDITS = { url: null, values: {} };

// A list stored as JSON is shown one item per line; anything that is not JSON is
// shown as the text it is.
const storedList = (value) => {
  let parsed = null;
  try { parsed = JSON.parse(value || "[]"); } catch { parsed = null; }
  return Array.isArray(parsed) ? parsed.join("\n") : (value || "");
};

// The stored report is the base each form is built from.
const standupFormBase = (report) =>
  report?.report_type === "standup"
    ? {
        priorities: storedList(report.top_priorities),
        deliverables: report.expected_deliverables || "",
        notes: report.additional_notes || "",
      }
    : EMPTY_STANDUP_FORM;

const retroFormBase = (report) =>
  report?.report_type === "retro"
    ? {
        wentWell: storedList(report.wins),
        wentWrong: report.challenges || "",
        improve: report.carryover_items || "",
      }
    : EMPTY_RETRO_FORM;

export default function StandupRetroView({ user, context, contextLabel }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("standup");
  const [week, setWeek] = useState(getCurrentWeek());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [standupEdits, setStandupEdits] = useState(EMPTY_EDITS);
  const [retroEdits, setRetroEdits] = useState(EMPTY_EDITS);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [, setCreatingTask] = useState(false);

  const activeContext = context || { context_type: "staff", context_id: null };
  const userCid = user?.cid;

  // The week's report and its tasks read through the shared hook, which owns the
  // cache, the cache-first paint and the discarding of a stale answer, so the
  // screen keeps no copy of its own and reads during render.
  let standupUrl = null;
  if (userCid) {
    const params = new URLSearchParams({ user_id: userCid, week: week.week, year: week.year, context_type: activeContext.context_type });
    if (activeContext.context_id) params.set("context_id", activeContext.context_id);
    standupUrl = `/api/standups/current?${params}`;
  }

  const {
    data: standup,
    loading,
    refresh,
    setData: setStandup,
  } = useApi(standupUrl, { defaultValue: EMPTY_STANDUP, transform: pickStandup });
  const report = standup.report;
  const tasks = standup.tasks;

  // Staff for the assignment picker. The identity is absent for the first moment
  // of a cold load, so there is nothing to read yet.
  const { data: allStaff } = useApi(userCid ? "/api/contacts?role=staff" : null, {
    defaultValue: [],
    transform: pickStaffContacts,
  });

  // The stored report is the base; what the person types is recorded against the
  // address it was typed for, so one week's edits cannot show on another week's.
  const standupForm = { ...standupFormBase(report), ...(standupEdits.url === standupUrl ? standupEdits.values : null) };
  const retroForm = { ...retroFormBase(report), ...(retroEdits.url === standupUrl ? retroEdits.values : null) };
  const editStandup = (field, value) =>
    setStandupEdits((prev) => ({ url: standupUrl, values: { ...(prev.url === standupUrl ? prev.values : null), [field]: value } }));
  const editRetro = (field, value) =>
    setRetroEdits((prev) => ({ url: standupUrl, values: { ...(prev.url === standupUrl ? prev.values : null), [field]: value } }));

  /* ─── Assignment / Blocker / Due Date handlers ─── */
  const handleAssign = async (taskId, assigneeId) => {
    try {
      const res = await fetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, assigned_to: assigneeId, user_id: user.cid }) });
      const data = await res.json();
      if (!data.success) setToast({ type: "error", msg: t((data.error || t("staffMisc.standupRetro.assignmentFailed")) || "") || (data.error || t("staffMisc.standupRetro.assignmentFailed")) });
      else { setStandup((prev) => ({ ...prev, tasks: prev.tasks.map((task) => task.id === taskId ? { ...task, assigned_to: assigneeId } : task) })); setToast({ type: "success", msg: t("staffMisc.standupRetro.assigned") }); }
    } catch { setToast({ type: "error", msg: t("staffMisc.standupRetro.networkError") }); }
  };

  const handleAddBlocker = async (taskId, blockerTitle) => {
    try {
      const res = await fetch("/api/blockers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task_id: taskId, user_id: user.cid, user_name: user.name, title: blockerTitle }) });
      const data = await res.json();
      if (!data.success) setToast({ type: "error", msg: t((data.error || t("staffMisc.standupRetro.blockerFailed")) || "") || (data.error || t("staffMisc.standupRetro.blockerFailed")) });
      else { setToast({ type: "success", msg: t("staffMisc.standupRetro.blockerAdded") }); refresh(); }
    } catch { setToast({ type: "error", msg: t("staffMisc.standupRetro.networkError") }); }
  };

  const handleSetDueDate = async (taskId, date) => {
    try {
      await fetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, end_date: date, user_id: user.cid }) });
      setStandup((prev) => ({ ...prev, tasks: prev.tasks.map((task) => task.id === taskId ? { ...task, end_date: date } : task) }));
    } catch { /* silent */ }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await fetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, status: newStatus, user_id: user.cid }) });
      setStandup((prev) => ({ ...prev, tasks: prev.tasks.map((task) => task.id === taskId ? { ...task, status: newStatus } : task) }));
    } catch { setToast({ type: "error", msg: t("staffMisc.standupRetro.failedToUpdateTask") }); }
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();
    if (!newTaskTitle.trim()) return;
    setCreatingTask(true);
    try {
      const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.cid, user_name: user.name, title: newTaskTitle.trim(), created_week: week.week, created_year: week.year, context_type: activeContext.context_type, context_id: activeContext.context_id || null }) });
      const data = await res.json();
      if (data.success) { setNewTaskTitle(""); setShowNewTask(false); refresh(); }
      else setToast({ type: "error", msg: t((data.error || t("staffMisc.standupRetro.failed")) || "") || (data.error || t("staffMisc.standupRetro.failed")) });
    } catch { setToast({ type: "error", msg: t("staffMisc.standupRetro.networkError") }); } finally { setCreatingTask(false); }
  };

  const handleArchive = (taskId) => handleStatusChange(taskId, "archived");
  const handleDelete = async (taskId) => {
    try {
      await fetch(`/api/tasks?id=${taskId}&user_id=${user.cid}`, { method: "DELETE" });
      setStandup((prev) => ({ ...prev, tasks: prev.tasks.filter((task) => task.id !== taskId) }));
    } catch { setToast({ type: "error", msg: t("staffMisc.standupRetro.failedToDelete") }); }
  };

  const submitStandup = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/standups/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.cid, user_name: user.name, user_role: user.role || "staff", week_number: week.week, year: week.year, top_priorities: standupForm.priorities, expected_deliverables: standupForm.deliverables, additional_notes: standupForm.notes, context_type: activeContext.context_type, context_id: activeContext.context_id || null }) });
      const data = await res.json();
      setToast({ type: data.success ? "success" : "error", msg: data.success ? t("staffMisc.standupRetro.standupSubmitted") : (t(data.error || "") || data.error) });
      if (data.success) refresh();
    } catch { setToast({ type: "error", msg: t("staffMisc.standupRetro.networkError") }); } finally { setSaving(false); }
  };

  const submitRetro = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/retros/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.cid, user_name: user.name, user_role: user.role || "staff", week_number: week.week, year: week.year, wins: retroForm.wentWell, challenges: retroForm.wentWrong, unfinished_tasks: retroForm.improve, context_type: activeContext.context_type, context_id: activeContext.context_id || null }) });
      const data = await res.json();
      setToast({ type: data.success ? "success" : "error", msg: data.success ? t("staffMisc.standupRetro.retroSubmitted") : (t(data.error || "") || data.error) });
      if (data.success) refresh();
    } catch { setToast({ type: "error", msg: t("staffMisc.standupRetro.networkError") }); } finally { setSaving(false); }
  };

  const changeWeek = (direction) => setWeek((prev) => { let nextWeek = prev.week + direction, nextYear = prev.year; if (nextWeek < 1) { nextWeek = 52; nextYear--; } if (nextWeek > 52) { nextWeek = 1; nextYear++; } return { week: nextWeek, year: nextYear }; });

  const isSubmitted = report?.status === "submitted";
  const active = tasks.filter((task) => !["completed", "archived"].includes(task.status));
  const done = tasks.filter((task) => task.status === "completed");
  const blocked = tasks.filter((task) => task.status === "blocked");

  if (loading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }} className="space-y-6 pb-16">
      {toast && (
        <div onClick={() => setToast(null)} className={`cursor-pointer text-[10px] font-bold px-4 py-2 rounded-lg text-center ${toast.type === "error" ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>
          {toast.msg}
        </div>
      )}

      <div className="text-center space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">{t("staffMisc.standupRetro.weeklyOps")}</p>
        <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">{t("staffMisc.standupRetro.weekLabel", { week: week.week, year: week.year })}</h2>
        {contextLabel && <p className="text-[10px] text-[var(--text-secondary)]">{contextLabel}</p>}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button onClick={() => changeWeek(-1)} className="p-2 rounded-lg hover:bg-white/5"><ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" /></button>
        <div className="flex bg-white/5 rounded-lg p-0.5">
          <button onClick={() => { setTab("standup"); setExpandedTask(null); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider ${tab === "standup" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)]"}`}><Calendar className="w-3.5 h-3.5" />{t("staffMisc.standupRetro.standupTab")}</button>
          <button onClick={() => { setTab("retro"); setExpandedTask(null); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider ${tab === "retro" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)]"}`}><Trophy className="w-3.5 h-3.5" />{t("staffMisc.standupRetro.retroTab")}</button>
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
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("staffMisc.standupRetro.tasksThisWeek", { count: tasks.length })}</span>
          <span className="text-[10px] font-bold text-[var(--text-secondary)]">{tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0}%</span>
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
          <div className="text-center py-10"><p className="text-[11px] text-[var(--text-tertiary)]">{t("staffMisc.standupRetro.noTasksYet")}</p></div>
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
          <button onClick={() => setShowNewTask(true)} className="w-full px-4 py-3 text-left text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-white/[0.02] transition-colors">
            + {t("staffMisc.standupRetro.writeNextTask")}
          </button>
        ) : (
          <form onSubmit={handleCreateTask} className="px-4 py-3 border-t border-white/[0.06]">
            <input type="text" value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder={t("staffMisc.standupRetro.taskTitlePlaceholder")} autoFocus
              className="w-full bg-transparent text-[12px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              onKeyDown={(event) => { if (event.key === "Escape") { setShowNewTask(false); setNewTaskTitle(""); } }}
              onBlur={() => { if (!newTaskTitle.trim()) { setShowNewTask(false); } }} />
          </form>
        )}
      </div>

      <form onSubmit={tab === "standup" ? submitStandup : submitRetro} className="space-y-4">
        {tab === "standup" ? (
          <>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1.5">{t("staffMisc.standupRetro.thisWeeksPriorities")}</label>
              <textarea value={standupForm.priorities} onChange={(event) => editStandup("priorities", event.target.value)} rows={3} placeholder={t("staffMisc.standupRetro.prioritiesPlaceholder")}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-brand-orange/40 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1.5">{t("staffMisc.standupRetro.expectedDeliverables")}</label>
              <textarea value={standupForm.deliverables} onChange={(event) => editStandup("deliverables", event.target.value)} rows={2} placeholder={t("staffMisc.standupRetro.deliverablesPlaceholder")}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-brand-orange/40 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1.5">{t("staffMisc.standupRetro.blockersSupportNeeded")}</label>
              <textarea value={standupForm.notes} onChange={(event) => editStandup("notes", event.target.value)} rows={2} placeholder={t("staffMisc.standupRetro.supportPlaceholder")}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-brand-orange/40 transition-colors" />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1.5">{t("staffMisc.standupRetro.whatWentWell")}</label>
              <textarea value={retroForm.wentWell} onChange={(event) => editRetro("wentWell", event.target.value)} rows={3} placeholder={t("staffMisc.standupRetro.wentWellPlaceholder")}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-brand-orange/40 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1.5">{t("staffMisc.standupRetro.whatDidntGoWell")}</label>
              <textarea value={retroForm.wentWrong} onChange={(event) => editRetro("wentWrong", event.target.value)} rows={2} placeholder={t("staffMisc.standupRetro.wentWrongPlaceholder")}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-brand-orange/40 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1.5">{t("staffMisc.standupRetro.whatWillImprove")}</label>
              <textarea value={retroForm.improve} onChange={(event) => editRetro("improve", event.target.value)} rows={2} placeholder={t("staffMisc.standupRetro.improvePlaceholder")}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-[var(--text-primary)] text-[12px] font-medium outline-none resize-none placeholder:text-[var(--text-tertiary)] focus:border-brand-orange/40 transition-colors" />
            </div>
          </>
        )}

        <button type="submit" disabled={saving}
          className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ backgroundColor: "var(--brand-orange)", color: "#000" }}>
          {saving ? t("staffMisc.standupRetro.saving") : <><Send className="w-4 h-4" /> {tab === "standup" ? t("staffMisc.standupRetro.submitStandup") : t("staffMisc.standupRetro.submitRetro")}</>}
        </button>
      </form>
    </div>
  );
}
