"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Play, Plus, Search, Loader2, X, Send, Clock, Users, CheckCircle2,
  XCircle, FileText, RotateCcw, Eye, MessageSquare, User, Filter,
  ArrowLeft, Settings, Link2, Trash2, AlertTriangle, BarChart3,
  History, Calendar, Hash, Globe, EyeOff, ShieldAlert, PauseCircle,
  StopCircle, Archive, RefreshCw, ChevronDown, ChevronRight, Info,
} from "lucide-react";

/**
 * PLATFORM FORM RUNS — Launch, assign, collect, review
 * Module 4 — Full implementation with assignments, settings, timeline, and enhanced review.
 */

const STATUS_CONFIG = {
  draft: { color: "text-slate-500", bg: "bg-slate-500/10", label: "Draft" },
  scheduled: { color: "text-blue-500", bg: "bg-blue-500/10", label: "Scheduled" },
  active: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Active" },
  closed: { color: "text-amber-500", bg: "bg-amber-500/10", label: "Closed" },
  archived: { color: "text-rose-500", bg: "bg-rose-500/10", label: "Archived" },
  cancelled: { color: "text-rose-500", bg: "bg-rose-500/10", label: "Cancelled" },
};

const SUB_STATUS = {
  draft: { color: "text-slate-500", bg: "bg-slate-500/10", label: "Draft" },
  submitted: { color: "text-blue-500", bg: "bg-blue-500/10", label: "Submitted" },
  approved: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Approved" },
  rejected: { color: "text-rose-500", bg: "bg-rose-500/10", label: "Rejected" },
  revision_requested: { color: "text-amber-500", bg: "bg-amber-500/10", label: "Revision" },
};

const TARGET_LABELS = {
  user: "User", group: "Group", program: "Program", cohort: "Cohort",
  team: "Team", organization: "Organization", all: "Everyone",
};

function cn(...classes) { return classes.filter(Boolean).join(" "); }


// ─── Mini Calendar Picker ───
function MiniCalendar({ value, onChange, onClose }) {
  const [viewDate, setViewDate] = React.useState(() => value ? new Date(value) : new Date());
  const [timeStr, setTimeStr] = React.useState(() => {
    if (!value) return "09:00";
    const d = new Date(value);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const selectDay = (day) => {
    const d = new Date(year, month, day);
    const [h, m] = timeStr.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    onChange(d.toISOString().slice(0, 16));
    // Do NOT auto-close — let user confirm via the Done button
  };

  const handleTimeChange = (e) => {
    setTimeStr(e.target.value);
    if (value) {
      const d = new Date(value);
      const [h, m] = e.target.value.split(":").map(Number);
      d.setHours(h, m, 0, 0);
      onChange(d.toISOString().slice(0, 16));
    }
  };

  const isSelected = (day) => {
    if (!value || !day) return false;
    const d = new Date(value);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  };

  return (
    <div
      className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] shadow-2xl w-96 z-[500]"
      onClick={(e) => e.stopPropagation()}
      style={{ background: "var(--bg-secondary, #1a1a2e)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
    >
      {/* Month Nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all"
        >
          <ChevronDown className="w-4 h-4 rotate-90 text-[var(--text-secondary)]" />
        </button>
        <span className="text-[14px] font-black text-[var(--text-primary)]">{MONTHS[month]} {year}</span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all"
        >
          <ChevronDown className="w-4 h-4 -rotate-90 text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[9px] font-black text-[var(--text-secondary)] py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const past = day && new Date(year, month, day, 23, 59, 59) < today;
          const sel = isSelected(day);
          return (
            <button
              key={i}
              type="button"
              disabled={!day || past}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (day && !past) selectDay(day); }}
              className={
                "h-12 w-full rounded-xl text-[12px] font-bold transition-all " +
                (!day
                  ? "invisible"
                  : sel
                  ? "bg-[var(--brand-orange)] text-black shadow-md"
                  : past
                  ? "text-[var(--text-secondary)] opacity-25 cursor-not-allowed"
                  : "text-[var(--text-primary)] hover:bg-white/10 cursor-pointer")
              }
            >
              {day || ""}
            </button>
          );
        })}
      </div>

      {/* Time picker */}
      <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
        <label className="text-[9px] font-black uppercase text-[var(--text-secondary)] block mb-2">Time</label>
        <input
          type="time"
          value={timeStr}
          onChange={handleTimeChange}
          className="w-full px-3 py-2.5 rounded-xl bg-primary border border-[var(--border-primary)] text-[12px] font-bold text-[var(--text-primary)] outline-none [color-scheme:dark]"
        />
      </div>

      {/* Selected date summary + Done */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] font-bold text-[var(--text-secondary)]">
          {value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "No date selected"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase hover:brightness-110 transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
}


export default function FormRunsPage() {
  const [runs, setRuns] = useState([]);
  const [forms, setForms] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Detail view
  const [selectedRun, setSelectedRun] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createData, setCreateData] = useState({ form_id: "", name: "", description: "", opens_at: "", closes_at: "" });
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false); // 'opens' | 'closes' | null
  const [showOpensCal, setShowOpensCal] = useState(false);
  const [showClosesCal, setShowClosesCal] = useState(false);

  // Review modal
  const [showReview, setShowReview] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [reviewData, setReviewData] = useState({ decision: "approved", comment: "", internal_note: "" });
  const [reviewTimeline, setReviewTimeline] = useState([]);
  const [evaluation, setEvaluation] = useState(null);  // AI evaluation loaded separately

  // Assignment modal
  const [showAssign, setShowAssign] = useState(false);
  const [assignTarget, setAssignTarget] = useState("user");
  const [assignUserId, setAssignUserId] = useState("");

  // Settings
  const [runSettings, setRunSettings] = useState({});
  const [editingSettings, setEditingSettings] = useState(false);

  // Timeline for selected submission
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  // Operational dashboard
  const [dashboardStats, setDashboardStats] = useState(null);

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/platform/form-runs?${params}`);
      const data = await res.json();
      if (data.success) setRuns(data.runs || []);
    } catch (_) {}
    setLoading(false);
  }, [statusFilter]);

  const fetchForms = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/forms?status=published");
      const data = await res.json();
      if (data.success) setForms(data.forms || []);
    } catch (_) {}
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/form-runs?contacts=true");
      const data = await res.json();
      if (data.success) setContacts(data.contacts || []);
    } catch (_) {}
  }, []);

  const fetchDashboardStats = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/form-runs?dashboard=true");
      const data = await res.json();
      if (data.success) setDashboardStats(data.stats);
    } catch (_) {}
  }, []);

  useEffect(() => { fetchRuns(); fetchForms(); fetchContacts(); fetchDashboardStats(); }, [fetchRuns]);

  const openRun = async (run) => {
    setSelectedRun(run);
    setDetailTab("overview");
    setSubLoading(true);
    try {
      const res = await fetch(`/api/platform/form-runs?id=${run.id}`);
      const data = await res.json();
      if (data.success) {
        setSubmissions(data.submissions || []);
        setReviews(data.reviews || []);
        setAssignments(data.assignments || []);
        setRunSettings(data.run.settings || {});
      }
    } catch (_) {}
    setSubLoading(false);
  };

  const handleCreate = async () => {
    if (!createData.form_id || !createData.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/platform/form-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createData),
      });
      const data = await res.json();
      if (data.success) {
        notify("Form Run created");
        setShowCreate(false);
        fetchRuns();
        openRun(data.run);
      }
    } catch (_) {}
    setSaving(false);
  };

  const handleLaunch = async (id) => {
    try {
      const res = await fetch("/api/platform/form-runs?action=launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Run launched");
        fetchRuns();
        setSelectedRun(data.run);
      }
    } catch (_) {}
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await fetch("/api/platform/form-runs?action=status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        notify(`Run ${newStatus}`);
        setSelectedRun(data.run);
        fetchRuns();
      }
    } catch (_) {}
  };

  const handleReview = async () => {
    if (!reviewing) return;
    setSaving(true);
    try {
      const res = await fetch("/api/platform/form-runs?action=review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: reviewing.id, ...reviewData }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Review submitted");
        setShowReview(false);
        setReviewTimeline([]);
        if (selectedRun) openRun(selectedRun);
      }
    } catch (_) {}
    setSaving(false);
  };

  const openReview = async (submission) => {
    setReviewing(submission);
    setReviewData({ decision: "approved", comment: "", internal_note: "" });
    setShowReview(true);
    setReviewTimeline([]);
    setEvaluation(null);
    // Load timeline
    try {
      const res = await fetch(`/api/platform/form-runs?timeline=${submission.id}`);
      const data = await res.json();
      if (data.success) setReviewTimeline(data.timeline || []);
    } catch (_) {}
    // Load AI evaluation from separate table
    try {
      const evalRes = await fetch(`/api/platform/ai/evaluate-submission?submission_id=${submission.id}`);
      const evalData = await evalRes.json();
      if (evalData.success && evalData.evaluation) setEvaluation(evalData.evaluation);
    } catch (_) {}
  };

  const handleAssign = async () => {
    if (!assignUserId || !selectedRun) return;
    setSaving(true);
    try {
      const res = await fetch("/api/platform/form-runs?action=assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: selectedRun.id, target_type: assignTarget, target_id: assignUserId }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignments(data.assignments || []);
        notify("Assignment added");
        setShowAssign(false);
      }
    } catch (_) {}
    setSaving(false);
  };

  const handleUnassign = async (assignmentId) => {
    try {
      const res = await fetch("/api/platform/form-runs?action=unassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignmentId }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignments(data.assignments || []);
        notify("Assignment removed");
      }
    } catch (_) {}
  };

  const handleSaveSettings = async () => {
    if (!selectedRun) return;
    setSaving(true);
    try {
      const res = await fetch("/api/platform/form-runs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedRun.id, settings: runSettings }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedRun(data.run);
        setRunSettings(data.run.settings || {});
        notify("Settings saved");
        setEditingSettings(false);
      }
    } catch (_) {}
    setSaving(false);
  };

  // ─── RUN DETAIL VIEW ───
  if (selectedRun) {
    const cfg = STATUS_CONFIG[selectedRun.status] || STATUS_CONFIG.draft;
    const subtotal = submissions.length;
    const submitted = submissions.filter((s) => s.status === "submitted").length;
    const approved = submissions.filter((s) => s.status === "approved").length;
    const rejected = submissions.filter((s) => s.status === "rejected").length;
    const revision = submissions.filter((s) => s.status === "revision_requested").length;
    const drafts = submissions.filter((s) => s.status === "draft").length;
    const overdue = submissions.filter((s) => s.status === "submitted" && selectedRun.closes_at && new Date(s.submitted_at) > new Date(selectedRun.closes_at)).length;

    const tabs = [
      { id: "overview", label: "Overview", icon: BarChart3 },
      { id: "share", label: "Share", icon: Link2 },
      { id: "assignments", label: `Assignments (${assignments.length})`, icon: Users },
      { id: "settings", label: "Settings", icon: Settings },
    ];

    return (
      <div className="flex flex-col h-screen overflow-hidden">
        {notification && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase animate-in">{notification}</div>}
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-[var(--border-primary)] bg-secondary shrink-0">
          <button onClick={() => setSelectedRun(null)} className="text-[10px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft className="w-3 h-3 inline mr-1" /> Back</button>
          <span className="text-[var(--text-secondary)] opacity-30">|</span>
          <Play className="w-4 h-4 text-[var(--brand-orange)]" />
          <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{selectedRun.name}</h2>
          <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", cfg.color, cfg.bg)}>{cfg.label}</span>
          {/* Status action buttons */}
          {selectedRun.status === "draft" && (
            <button onClick={() => handleLaunch(selectedRun.id)} className="px-3 py-1.5 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase hover:brightness-110">Launch</button>
          )}
          {selectedRun.status === "active" && (
            <button onClick={() => handleStatusChange(selectedRun.id, "closed")} className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[9px] font-black uppercase hover:bg-amber-500/20 flex items-center gap-1"><StopCircle className="w-3 h-3" /> Close</button>
          )}
          {(selectedRun.status === "active" || selectedRun.status === "closed") && (
            <button onClick={() => handleStatusChange(selectedRun.id, "cancelled")} className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/30 text-[9px] font-black uppercase hover:bg-rose-500/20 flex items-center gap-1"><XCircle className="w-3 h-3" /> Cancel</button>
          )}
          {selectedRun.status === "closed" && (
            <button onClick={() => handleStatusChange(selectedRun.id, "archived")} className="px-3 py-1.5 rounded-xl bg-slate-500/10 text-slate-500 border border-slate-500/30 text-[9px] font-black uppercase hover:bg-slate-500/20 flex items-center gap-1"><Archive className="w-3 h-3" /> Archive</button>
          )}
          {(selectedRun.status === "closed" || selectedRun.status === "cancelled") && (
            <button onClick={() => handleStatusChange(selectedRun.id, "active")} className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[9px] font-black uppercase hover:bg-emerald-500/20 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Reactivate</button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 px-6 border-b border-[var(--border-primary)] shrink-0 bg-secondary">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setDetailTab(t.id)} className={cn("flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase border-b-2 transition-colors", detailTab === t.id ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>
              <t.icon className="w-3 h-3" /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ─── OVERVIEW TAB ─── */}
          {detailTab === "overview" && (
            <>
              {/* Stats cards */}
              <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                {[
                  { label: "Total", value: subtotal, icon: Hash, color: "text-[var(--text-primary)]" },
                  { label: "Submitted", value: submitted, icon: Send, color: "text-blue-500" },
                  { label: "Approved", value: approved, icon: CheckCircle2, color: "text-emerald-500" },
                  { label: "Rejected", value: rejected, icon: XCircle, color: "text-rose-500" },
                  { label: "Revision", value: revision, icon: RotateCcw, color: "text-amber-500" },
                  { label: "Drafts", value: drafts, icon: FileText, color: "text-slate-500" },
                  ...(overdue > 0 ? [{ label: "Overdue", value: overdue, icon: AlertTriangle, color: "text-rose-500" }] : []),
                ].map((s) => (
                  <div key={s.label} className="p-4 rounded-2xl bg-secondary border border-[var(--border-primary)] text-center">
                    <p className={cn("text-2xl font-black", s.color)}>{s.value}</p>
                    <div className="flex items-center justify-center gap-1 mt-0.5"><s.icon className={cn("w-2.5 h-2.5", s.color)} /><p className="text-[9px] font-bold uppercase text-[var(--text-secondary)]">{s.label}</p></div>
                  </div>
                ))}
              </div>

              {/* Submissions table */}
              {subLoading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" /></div> : (
                <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                  <table className="w-full text-left">
                    <thead className="bg-tertiary">
                      <tr className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                        <th className="px-4 py-3">Submitter</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Score</th>
                        <th className="px-4 py-3">Submitted</th>
                        <th className="px-4 py-3">Last Review</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-primary)]">
                      {submissions.map((s) => {
                        const sc = SUB_STATUS[s.status] || SUB_STATUS.draft;
                        const subReviews = reviews.filter((r) => r.submission_id === s.id);
                        const lastReview = subReviews[subReviews.length - 1];
                        const subData = s.data || {};
                        const scores = subData._scores;
                        const overall = scores?.overall;
                        const ranking = scores?.ranking;
                        const scoreColor = overall != null
                          ? overall >= 80 ? "text-emerald-500"
                          : overall >= 60 ? "text-amber-500"
                          : "text-rose-500"
                          : "";
                        const scoreBg = overall != null
                          ? overall >= 80 ? "bg-emerald-500/10"
                          : overall >= 60 ? "bg-amber-500/10"
                          : "bg-rose-500/10"
                          : "";
                        return (
                          <tr key={s.id} className="text-[11px] font-bold text-[var(--text-primary)] hover:bg-tertiary/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-[var(--text-secondary)]" />{s.submitter_name || s.submitter_id}</div>
                            </td>
                            <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", sc.color, sc.bg)}>{sc.label}</span></td>
                            <td className="px-4 py-3">
                              {overall != null ? (
                                <div className="flex flex-col">
                                  <span className={cn("text-[11px] font-black", scoreColor)}>{overall}%</span>
                                  {ranking && <span className={cn("text-[8px] font-bold uppercase mt-0.5 px-1.5 py-0.5 rounded", scoreColor, scoreBg)}>{ranking}</span>}
                                </div>
                              ) : (
                                <span className="text-[10px] text-[var(--text-secondary)]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[10px] text-[var(--text-secondary)]">{s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : "—"}</td>
                            <td className="px-4 py-3 text-[9px] text-[var(--text-secondary)]">
                              {lastReview ? <span>{lastReview.decision} by {lastReview.reviewer_name || lastReview.reviewer_id}</span> : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => setSelectedSubmission(selectedSubmission?.id === s.id ? null : s)} className="px-2 py-1 rounded-lg bg-tertiary text-[var(--text-secondary)] text-[8px] font-black uppercase hover:bg-[var(--brand-orange)]/10 hover:text-[var(--brand-orange)] flex items-center gap-1">
                                  <History className="w-3 h-3" /> History
                                </button>
                                {s.status === "submitted" && (
                                  <button onClick={() => openReview(s)} className="px-2 py-1 rounded-lg bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] text-[8px] font-black uppercase hover:bg-[var(--brand-orange)]/20">Review</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Submission Timeline (expandable per submission) */}
              {selectedSubmission && (
                <SubmissionTimeline submission={selectedSubmission} onClose={() => setSelectedSubmission(null)} />
              )}
            </>
          )}

          {/* ─── SHARE TAB ─── */}
          {detailTab === "share" && (() => {
            const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
            const submitUrl = `${baseUrl}/platform/runs/submit/${selectedRun.id}`;
            const embedCode = `<iframe src="${submitUrl}?embed=1" width="100%" height="600" frameborder="0" style="border-radius:12px;border:1px solid #334155;"></iframe>`;
            return (
              <div className="space-y-6 max-w-2xl">
                {/* Direct Link */}
                <div>
                  <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">Direct Link</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1 mb-3">Share this URL with participants to access the form directly.</p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={submitUrl}
                      className="flex-1 rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]"
                    />
                    <button
                      onClick={() => { navigator.clipboard.writeText(submitUrl); notify("Link copied!"); }}
                      className="px-4 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase hover:brightness-110"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Embed Code */}
                <div>
                  <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">Embed Code</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1 mb-3">Embed this form on any website. Participants can submit directly from your page.</p>
                  <div className="flex gap-2">
                    <textarea
                      readOnly
                      rows={3}
                      value={embedCode}
                      className="flex-1 rounded-xl px-4 py-3 text-[10px] font-mono outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none"
                    />
                    <button
                      onClick={() => { navigator.clipboard.writeText(embedCode); notify("Embed code copied!"); }}
                      className="px-4 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase hover:brightness-110 self-start"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Preview */}
                {selectedRun.status === "active" && (
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-[9px] font-bold text-emerald-400">✓ This run is active — links are live and accepting submissions.</p>
                  </div>
                )}
                {selectedRun.status === "draft" && (
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <p className="text-[9px] font-bold text-amber-400">⚠️ Launch this run first before sharing links.</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ─── ASSIGNMENTS TAB ─── */}
          {detailTab === "assignments" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">Assigned Audiences</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">Control who can access and submit to this Form Run.</p>
                </div>
                <button onClick={() => { setShowAssign(true); setAssignTarget("user"); setAssignUserId(""); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase hover:brightness-110"><Plus className="w-3 h-3" /> Add</button>
              </div>

              {assignments.length === 0 ? (
                <div className="py-16 text-center bg-secondary rounded-2xl border border-[var(--border-primary)] border-dashed">
                  <Users className="w-8 h-8 mx-auto text-[var(--text-secondary)] opacity-30" />
                  <p className="text-[12px] font-bold text-[var(--text-secondary)] mt-3">No assignments yet</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">Assign this run to users, groups, or programs.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                  <table className="w-full text-left">
                    <thead className="bg-tertiary">
                      <tr className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Target ID</th>
                        <th className="px-4 py-3">Assigned</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-primary)]">
                      {assignments.map((a) => (
                        <tr key={a.id} className="text-[11px] font-bold text-[var(--text-primary)] hover:bg-tertiary/50">
                          <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] text-[8px] font-black uppercase">{TARGET_LABELS[a.target_type] || a.target_type}</span></td>
                          <td className="px-4 py-3 text-[10px] text-[var(--text-secondary)]">{a.target_id}</td>
                          <td className="px-4 py-3 text-[10px] text-[var(--text-secondary)]">{new Date(a.assigned_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3"><button onClick={() => handleUnassign(a.id)} className="text-rose-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add assignment modal */}
              {showAssign && (
                <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowAssign(false)}>
                  <div className="card w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center"><h3 className="text-sm font-black uppercase text-[var(--text-primary)]">Add Assignment</h3><button onClick={() => setShowAssign(false)}><X className="w-5 h-5" /></button></div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Target Type</label>
                        <select value={assignTarget} onChange={(e) => { setAssignTarget(e.target.value); setAssignUserId(""); }} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
                          {Object.entries(TARGET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      {assignTarget === "user" ? (
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">User</label>
                          <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] max-h-40">
                            <option value="">Select user...</option>
                            {contacts.map((c) => <option key={c.cid} value={c.cid}>{c.name || c.email || c.cid}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Target ID</label><input value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]" placeholder="e.g. program_id or group_id" /></div>
                      )}
                    </div>
                    <div className="flex gap-2"><button onClick={() => setShowAssign(false)} className="flex-1 btn btn-secondary">Cancel</button><button onClick={handleAssign} disabled={saving || !assignUserId} className="flex-1 btn btn-primary">{saving ? "Adding..." : "Add"}</button></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── SETTINGS TAB ─── */}
          {detailTab === "settings" && (
            <div className="space-y-6 max-w-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">Run Configuration</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">Configure how this Form Run behaves independently of the original Form.</p>
                </div>
                {!editingSettings ? (
                  <button onClick={() => setEditingSettings(true)} className="px-3 py-2 rounded-xl bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] text-[9px] font-black uppercase hover:bg-[var(--brand-orange)]/20">Edit</button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingSettings(false); setRunSettings(selectedRun.settings || {}); }} className="px-3 py-2 rounded-xl bg-tertiary text-[var(--text-secondary)] text-[9px] font-black uppercase">Cancel</button>
                    <button onClick={handleSaveSettings} disabled={saving} className="px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase">{saving ? "Saving..." : "Save"}</button>
                  </div>
                )}
              </div>

              <div className="space-y-4 bg-secondary border border-[var(--border-primary)] rounded-2xl p-5">
                {/* Submission Limits */}
                <SettingRow label="Submission Limit" icon={Hash} desc="Max submissions allowed (0 = unlimited)">
                  {editingSettings ? (
                    <input type="number" min="0" value={runSettings.submission_limit ?? 0} onChange={(e) => setRunSettings({ ...runSettings, submission_limit: parseInt(e.target.value) || 0 })} className="w-24 rounded-xl px-3 py-2 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]" />
                  ) : (
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">{(runSettings.submission_limit || 0) === 0 ? "Unlimited" : runSettings.submission_limit}</span>
                  )}
                </SettingRow>

                {/* Multiple Submissions */}
                <SettingRow label="Multiple Submissions" icon={Send} desc="Allow users to submit more than once">
                  {editingSettings ? (
                    <Toggle checked={!!runSettings.allow_multiple} onChange={(v) => setRunSettings({ ...runSettings, allow_multiple: v })} />
                  ) : (
                    <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded", runSettings.allow_multiple ? "text-emerald-500 bg-emerald-500/10" : "text-slate-500 bg-slate-500/10")}>{runSettings.allow_multiple ? "Yes" : "No"}</span>
                  )}
                </SettingRow>

                {/* Anonymous Submissions */}
                <SettingRow label="Anonymous Submissions" icon={EyeOff} desc="Hide submitter identity from reviewers">
                  {editingSettings ? (
                    <Toggle checked={!!runSettings.anonymous} onChange={(v) => setRunSettings({ ...runSettings, anonymous: v })} />
                  ) : (
                    <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded", runSettings.anonymous ? "text-emerald-500 bg-emerald-500/10" : "text-slate-500 bg-slate-500/10")}>{runSettings.anonymous ? "Yes" : "No"}</span>
                  )}
                </SettingRow>

                {/* Auto-close */}
                <SettingRow label="Auto-Close" icon={StopCircle} desc="Automatically close run after submission deadline">
                  {editingSettings ? (
                    <Toggle checked={!!runSettings.auto_close} onChange={(v) => setRunSettings({ ...runSettings, auto_close: v })} />
                  ) : (
                    <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded", runSettings.auto_close ? "text-emerald-500 bg-emerald-500/10" : "text-slate-500 bg-slate-500/10")}>{runSettings.auto_close ? "Yes" : "No"}</span>
                  )}
                </SettingRow>

                {/* Confirmation Message */}
                <SettingRow label="Confirmation Message" icon={MessageSquare} desc="Shown to users after successful submission">
                  {editingSettings ? (
                    <textarea value={runSettings.confirmation_message || ""} onChange={(e) => setRunSettings({ ...runSettings, confirmation_message: e.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none" placeholder="Thank you for your submission!" />
                  ) : (
                    <span className="text-[10px] text-[var(--text-secondary)]">{runSettings.confirmation_message || "—"}</span>
                  )}
                </SettingRow>

                {/* Instructions */}
                <SettingRow label="Submission Instructions" icon={Info} desc="Displayed to users before they start filling the form">
                  {editingSettings ? (
                    <textarea value={runSettings.instructions || ""} onChange={(e) => setRunSettings({ ...runSettings, instructions: e.target.value })} rows={3} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none" placeholder="Please fill out all required fields before the deadline." />
                  ) : (
                    <span className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap">{runSettings.instructions || "—"}</span>
                  )}
                </SettingRow>
              </div>
            </div>
          )}
        </div>

        {/* Review Modal */}
        {showReview && reviewing && (
          <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowReview(false)}>
            <div className="card w-full max-w-xl space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center"><h3 className="text-sm font-black uppercase text-[var(--text-primary)]">Review Submission</h3><button onClick={() => setShowReview(false)}><X className="w-5 h-5" /></button></div>

              {/* Submitted data preview */}
              {reviewing.data && Object.keys(reviewing.data).length > 0 && (
                <div className="space-y-2 bg-tertiary rounded-xl p-4 border border-[var(--border-primary)]">
                  <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] mb-2">Submitted Data</p>
                  {/* Scoring Breakdown */}
                  {reviewing.data._scores && (
                    <div className="mb-3 p-2.5 rounded-lg bg-[var(--border-primary)]/30">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[8px] font-black uppercase text-[var(--text-primary)]">Score</span>
                        <span className={cn("text-[12px] font-black", reviewing.data._scores.overall >= 80 ? "text-emerald-500" : reviewing.data._scores.overall >= 60 ? "text-amber-500" : "text-rose-500")}>
                          {reviewing.data._scores.overall}%
                          {reviewing.data._scores.ranking && <span className="ml-1.5 text-[8px]">({reviewing.data._scores.ranking})</span>}
                        </span>
                      </div>
                      {reviewing.data._scores.sections && Object.entries(reviewing.data._scores.sections).map(([name, sec]) => (
                        <div key={name} className="flex items-center justify-between text-[9px] py-0.5">
                          <span className="text-[var(--text-secondary)]">{name} <span className="text-[7px]">(wt:{sec.weight})</span></span>
                          <span className={cn("font-bold", sec.score >= 80 ? "text-emerald-500" : sec.score >= 60 ? "text-amber-500" : "text-rose-500")}>{sec.score}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI Evaluation Table */}
                  {evaluation?.dimensions && (
                    <div className="mb-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black uppercase text-purple-400">AI Evaluation</span>
                        <span className="text-[8px] font-bold text-[var(--text-secondary)]">
                          Overall: {evaluation.overall_score}% · {evaluation.ranking}
                        </span>
                      </div>
                      <div className="rounded-lg border border-purple-500/20 overflow-hidden">
                        <table className="w-full text-left">
                          <thead className="bg-purple-500/5">
                            <tr className="text-[7px] font-black uppercase text-[var(--text-secondary)]">
                              <th className="px-2 py-1.5">Dimension</th>
                              <th className="px-2 py-1.5">AI</th>
                              <th className="px-2 py-1.5">You</th>
                              <th className="px-2 py-1.5">Final</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-primary)]">
                            {evaluation.dimensions.map((dim, di) => (
                              <tr key={di} className="text-[9px]">
                                <td className="px-2 py-1.5">
                                  <span className="font-bold text-[var(--text-primary)]">{dim.name}</span>
                                  {dim.ai_reasoning && (
                                    <p className="text-[7px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">{dim.ai_reasoning.substring(0, 100)}{dim.ai_reasoning.length > 100 ? "..." : ""}</p>
                                  )}
                                </td>
                                <td className="px-2 py-1.5">
                                  <span className="font-black text-purple-400">{dim.ai_score}</span>
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    step={0.5}
                                    value={dim.human_score ?? ""}
                                    placeholder={String(dim.ai_score)}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? null : parseFloat(e.target.value);
                                      const updated = { ...evaluation };
                                      updated.dimensions[di].human_score = val;
                                      updated.dimensions[di].final_score = val ?? dim.ai_score;
                                      setEvaluation(updated);
                                    }}
                                    className="w-12 px-1 py-0.5 rounded bg-primary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <span className={cn("font-black", (dim.final_score ?? dim.ai_score) >= 7 ? "text-emerald-400" : (dim.final_score ?? dim.ai_score) >= 5 ? "text-amber-400" : "text-rose-400")}>
                                    {dim.final_score ?? dim.ai_score}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {Object.entries(reviewing.data).filter(([k]) => k !== "_scores" && k !== "_evaluation").map(([key, value]) => {
                    // Format phone numbers stored as JSON
                    let display = String(value);
                    if (typeof value === "string" && value.startsWith("{") && value.includes('"code"')) {
                      try {
                        const p = JSON.parse(value);
                        if (p.code && p.number) {
                          const cnt = [{ code: "+234", flag: "🇳🇬" }, { code: "+229", flag: "🇧🇯" }, { code: "+233", flag: "🇬🇭" }, { code: "+254", flag: "🇰🇪" }, { code: "+27", flag: "🇿🇦" }, { code: "+20", flag: "🇪🇬" }, { code: "+225", flag: "🇨🇮" }, { code: "+221", flag: "🇸🇳" }, { code: "+228", flag: "🇹🇬" }, { code: "+237", flag: "🇨🇲" }, { code: "+250", flag: "🇷🇼" }, { code: "+256", flag: "🇺🇬" }, { code: "+255", flag: "🇹🇿" }, { code: "+251", flag: "🇪🇹" }, { code: "+33", flag: "🇫🇷" }, { code: "+44", flag: "🇬🇧" }, { code: "+1", flag: "🇺🇸" }, { code: "+49", flag: "🇩🇪" }, { code: "+91", flag: "🇮🇳" }, { code: "+86", flag: "🇨🇳" }, { code: "+971", flag: "🇦🇪" }, { code: "+55", flag: "🇧🇷" }].find(c => c.code === p.code);
                          display = `${cnt?.flag || ""} ${p.code} ${p.number}`;
                        }
                      } catch (_) {}
                    }
                    return (
                      <div key={key} className="flex items-start gap-2 text-[11px]">
                        <span className="font-black text-[var(--text-secondary)] uppercase shrink-0">{key}:</span>
                        <span className="text-[var(--text-primary)] font-bold break-all">{display}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Submission Timeline */}
              {reviewTimeline.length > 0 && (
                <div className="space-y-2 bg-tertiary rounded-xl p-4 border border-[var(--border-primary)]">
                  <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] mb-2">Activity Timeline</p>
                  <div className="space-y-2">
                    {reviewTimeline.map((entry, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[10px]">
                        <div className={cn("w-1.5 h-1.5 mt-1 rounded-full shrink-0",
                          entry.action === "submitted" ? "bg-blue-500" :
                          entry.action === "approved" ? "bg-emerald-500" :
                          entry.action === "rejected" ? "bg-rose-500" :
                          entry.action === "revision_requested" ? "bg-amber-500" :
                          entry.action === "draft_saved" || entry.action === "started" ? "bg-slate-500" :
                          "bg-[var(--brand-orange)]"
                        )} />
                        <div>
                          <span className="font-black uppercase">{entry.action}</span>
                          {entry.actor_name && <span className="text-[var(--text-secondary)]"> by {entry.actor_name}</span>}
                          <span className="text-[var(--text-secondary)] ml-1">{new Date(entry.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Decision</label>
                  <select value={reviewData.decision} onChange={(e) => setReviewData({ ...reviewData, decision: e.target.value })} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
                    <option value="approved">✓ Approve</option>
                    <option value="rejected">✗ Reject</option>
                    <option value="revision_requested">↻ Request Revision</option>
                    <option value="escalated">↑ Escalate</option>
                    <option value="reassigned">→ Reassign</option>
                  </select>
                </div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Public Comment</label><textarea value={reviewData.comment} onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none" placeholder="Visible to the submitter" /></div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Internal Note <span className="text-amber-500">(private)</span></label><textarea value={reviewData.internal_note} onChange={(e) => setReviewData({ ...reviewData, internal_note: e.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-amber-500/5 border border-amber-500/20 text-[var(--text-primary)] resize-none" placeholder="Only visible to other reviewers" /></div>
              </div>
              <div className="flex gap-2"><button onClick={() => setShowReview(false)} className="flex-1 btn btn-secondary">Cancel</button><button onClick={handleReview} disabled={saving} className="flex-1 btn btn-primary">{saving ? "Saving..." : "Submit Review"}</button></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div className="p-6 space-y-6 animate-in">
      {notification && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase">{notification}</div>}

      {/* Operational Dashboard */}
      {dashboardStats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "Active Runs", value: dashboardStats.active_runs ?? 0, icon: Play, color: "text-emerald-500" },
            { label: "Total Assigned", value: dashboardStats.total_assignments ?? 0, icon: Users, color: "text-blue-500" },
            { label: "Submissions", value: dashboardStats.total_submissions ?? 0, icon: Send, color: "text-indigo-500" },
            { label: "Pending Review", value: dashboardStats.pending_reviews ?? 0, icon: Eye, color: "text-amber-500" },
            { label: "Approval Rate", value: (dashboardStats.approval_rate != null ? Math.round(dashboardStats.approval_rate) + "%" : "—"), icon: CheckCircle2, color: dashboardStats.approval_rate > 50 ? "text-emerald-500" : "text-rose-500" },
            { label: "Overdue", value: dashboardStats.overdue ?? 0, icon: AlertTriangle, color: (dashboardStats.overdue ?? 0) > 0 ? "text-rose-500" : "text-slate-500" },
          ].map((s) => (
            <div key={s.label} className="p-3.5 rounded-2xl bg-secondary border border-[var(--border-primary)] text-center">
              <p className={cn("text-xl font-black", s.color)}>{s.value}</p>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <s.icon className={cn("w-2.5 h-2.5", s.color)} />
                <p className="text-[8px] font-bold uppercase text-[var(--text-secondary)]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">Form Runs</h1>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">Launch forms, assign audiences, collect and review submissions.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase hover:brightness-110"><Plus className="w-3.5 h-3.5" /> New Run</button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" /><input type="text" placeholder="Search runs..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]">
          <option value="all">All Status</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option><option value="archived">Archived</option>
        </select>
      </div>
      {loading ? <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {runs.filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase())).map((r) => {
            const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.draft;
            return (
              <div key={r.id} onClick={() => openRun(r)} className="p-5 rounded-2xl bg-secondary border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/50 transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center"><Play className="w-5 h-5 text-[var(--brand-orange)]" /></div>
                  <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", cfg.color, cfg.bg)}>{cfg.label}</span>
                </div>
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{r.name}</h3>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">Form: {r.form_name}</p>
                <div className="flex items-center gap-3 mt-3 text-[9px] text-[var(--text-secondary)]">
                  {r.opens_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(r.opens_at).toLocaleDateString()}</span>}
                  {r.closes_at && <span className="flex items-center gap-1">→ {new Date(r.closes_at).toLocaleDateString()}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {/* ─── Date Picker Modal (completely outside create modal, no clipping) ─── */}
      {showDatePicker && (
        <div className="fixed inset-0 z-[600] bg-black/70 flex items-center justify-center p-6" onClick={() => setShowDatePicker(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-white/60">Selecting: {showDatePicker === 'opens' ? 'Opens date' : 'Closes date'}</span>
              <button onClick={() => setShowDatePicker(null)} className="text-white/60 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <MiniCalendar
              value={showDatePicker === 'opens' ? createData.opens_at : createData.closes_at}
              onChange={(d) => setCreateData({ ...createData, [showDatePicker === 'opens' ? 'opens_at' : 'closes_at']: d })}
              onClose={() => setShowDatePicker(null)}
            />
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-6" onClick={() => { setShowCreate(false); setShowDatePicker(null); }}>
          <div className="card w-full max-w-md space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center"><h3 className="text-sm font-black uppercase text-[var(--text-primary)]">New Form Run</h3><button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Form</label>
                <select value={createData.form_id} onChange={(e) => setCreateData({ ...createData, form_id: e.target.value })} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
                  <option value="">Select a published form...</option>
                  {forms.map((f) => <option key={f.id} value={f.id}>{f.name} (v{f.version})</option>)}
                </select>
              </div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Run Name</label><input value={createData.name} onChange={(e) => setCreateData({ ...createData, name: e.target.value })} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]" placeholder="e.g. Bootcamp Sept 2027 Applications" /></div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Description</label><textarea value={createData.description} onChange={(e) => setCreateData({ ...createData, description: e.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Opens</label>
                  <button onClick={() => setShowDatePicker('opens')} className={`w-full rounded-xl px-3 py-3 text-[10px] font-bold outline-none bg-primary border text-left flex items-center gap-2 transition-all ${createData.opens_at ? 'border-[var(--brand-orange)] text-[var(--text-primary)]' : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]'}`}>
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{createData.opens_at ? new Date(createData.opens_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Set open date...'}</span>
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Closes</label>
                  <button onClick={() => setShowDatePicker('closes')} className={`w-full rounded-xl px-3 py-3 text-[10px] font-bold outline-none bg-primary border text-left flex items-center gap-2 transition-all ${createData.closes_at ? 'border-[var(--brand-orange)] text-[var(--text-primary)]' : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]'}`}>
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{createData.closes_at ? new Date(createData.closes_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Set close date...'}</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3"><button onClick={() => setShowCreate(false)} className="flex-1 btn btn-secondary">Cancel</button><button onClick={handleCreate} disabled={saving || !createData.form_id || !createData.name.trim()} className="flex-1 btn btn-primary">{saving ? "Creating..." : "Create Run"}</button></div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── REUSABLE COMPONENTS ───

function SettingRow({ label, icon: Icon, desc, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[var(--border-primary)] last:border-0">
      <div className="flex items-start gap-2.5 min-w-0">
        <Icon className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] font-black uppercase text-[var(--text-primary)]">{label}</p>
          <p className="text-[9px] text-[var(--text-secondary)]">{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} className={cn("w-10 h-6 rounded-full transition-colors relative", checked ? "bg-[var(--brand-orange)]" : "bg-slate-600")}>
      <div className={cn("w-4 h-4 rounded-full bg-white absolute top-1 transition-all", checked ? "left-5" : "left-1")} />
    </button>
  );
}

function SubmissionTimeline({ submission, onClose }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoringData, setScoringData] = useState(null);

  const subData = submission.data || {};
  const scores = subData._scores;

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/platform/form-runs?timeline=${submission.id}`);
        const data = await res.json();
        if (data.success) setTimeline(data.timeline || []);
      } catch (_) {}

      // Fetch scoring breakdown if not already in submission data
      if (scores) {
        try {
          const scoringRes = await fetch(`/api/platform/form-runs?scoring=${submission.id}`);
          const scoringJson = await scoringRes.json();
          if (scoringJson.success) setScoringData(scoringJson);
        } catch (_) {}
      }
      setLoading(false);
    }
    load();
  }, [submission.id]);

  const getScoreColor = (val) =>
    val >= 80 ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" :
    val >= 60 ? "text-amber-500 bg-amber-500/10 border-amber-500/30" :
    "text-rose-500 bg-rose-500/10 border-rose-500/30";

  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-secondary overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-tertiary">
        <h4 className="text-[10px] font-black uppercase text-[var(--text-primary)] flex items-center gap-1.5"><History className="w-3 h-3 text-[var(--brand-orange)]" /> Submission History — {submission.submitter_name || submission.submitter_id}</h4>
        <button onClick={onClose}><X className="w-3.5 h-3.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" /></button>
      </div>
      <div className="p-4 max-h-64 overflow-y-auto">
        {/* Scoring Breakdown */}
        {scores && (
          <div className="mb-4 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Assessment Score</p>
              <div className="flex items-center gap-2">
                <span className={cn("text-[14px] font-black", scores.overall >= 80 ? "text-emerald-500" : scores.overall >= 60 ? "text-amber-500" : "text-rose-500")}>{scores.overall}%</span>
                {scores.ranking && (
                  <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", getScoreColor(scores.overall))}>{scores.ranking}</span>
                )}
              </div>
            </div>

            {/* Section breakdown */}
            {scores.sections && Object.keys(scores.sections).length > 0 && (
              <div className="space-y-1.5">
                {Object.entries(scores.sections).map(([name, sec]) => (
                  <div key={name} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[var(--text-primary)] font-bold truncate">{name}</span>
                      <span className="text-[var(--text-secondary)] text-[8px]">({sec.count} rated, wt: {sec.weight}%)</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Score bar */}
                      <div className="w-16 h-1.5 rounded-full bg-[var(--border-primary)] overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", sec.score >= 80 ? "bg-emerald-500" : sec.score >= 60 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${Math.min(sec.score, 100)}%` }} />
                      </div>
                      <span className={cn("text-[10px] font-black w-10 text-right", sec.score >= 80 ? "text-emerald-500" : sec.score >= 60 ? "text-amber-500" : "text-rose-500")}>{sec.score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto text-[var(--brand-orange)]" /> : timeline.length === 0 ? (
          <p className="text-[10px] text-[var(--text-secondary)] text-center py-4">No timeline entries yet.</p>
        ) : (
          <div className="space-y-2">
            {timeline.map((entry, idx) => {
              const dotColor =
                entry.action === "submitted" ? "bg-blue-500" :
                entry.action === "approved" ? "bg-emerald-500" :
                entry.action === "rejected" ? "bg-rose-500" :
                entry.action === "revision_requested" ? "bg-amber-500" :
                entry.action === "escalated" ? "bg-purple-500" :
                entry.action === "reassigned" ? "bg-indigo-500" :
                entry.action === "draft_saved" || entry.action === "started" ? "bg-slate-500" :
                "bg-[var(--brand-orange)]";
              return (
                <div key={idx} className="flex items-start gap-2 text-[10px]">
                  <div className={cn("w-1.5 h-1.5 mt-1 rounded-full shrink-0", dotColor)} />
                  <div className="flex-1">
                    <span className="font-black uppercase">{entry.action}</span>
                    {entry.actor_name && <span className="text-[var(--text-secondary)]"> by {entry.actor_name}</span>}
                    <span className="text-[var(--text-secondary)] ml-1">{new Date(entry.created_at).toLocaleString()}</span>
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="mt-0.5 text-[var(--text-secondary)]">
                        {typeof entry.metadata === "string" ? entry.metadata : Object.entries(entry.metadata).filter(([,v]) => v).map(([k, v]) => <span key={k} className="mr-2">{k}: {String(v).substring(0, 50)}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
