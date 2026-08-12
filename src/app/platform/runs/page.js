"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Play, Plus, Search, Loader2, X, Send, Clock, Users, CheckCircle2,
  XCircle, FileText, RotateCcw, Eye, MessageSquare, User, Filter,
  ArrowLeft, Settings, Link2, Trash2, AlertTriangle, BarChart3,
  History, Calendar, Hash, Globe, EyeOff, ShieldAlert, PauseCircle,
  StopCircle, Archive, RefreshCw, ChevronDown, ChevronUp, ChevronRight, Info, Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * PLATFORM FORM RUNS — Launch, assign, collect, review
 * Module 4 — Full implementation with assignments, settings, timeline, and enhanced review.
 */

const STATUS_CONFIG = {
  draft: { color: "text-slate-500", bg: "bg-slate-500/10", label: "platformMisc.runs.statusDraft" },
  scheduled: { color: "text-blue-500", bg: "bg-blue-500/10", label: "platformMisc.runs.statusScheduled" },
  active: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "platformMisc.runs.statusActive" },
  closed: { color: "text-amber-500", bg: "bg-amber-500/10", label: "platformMisc.runs.statusClosed" },
  archived: { color: "text-rose-500", bg: "bg-rose-500/10", label: "platformMisc.runs.statusArchived" },
  cancelled: { color: "text-rose-500", bg: "bg-rose-500/10", label: "platformMisc.runs.statusCancelled" },
};

const SUB_STATUS = {
  draft: { color: "text-slate-500", bg: "bg-slate-500/10", label: "platformMisc.runs.statusDraft" },
  submitted: { color: "text-blue-500", bg: "bg-blue-500/10", label: "platformMisc.runs.statusSubmitted" },
  approved: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "platformMisc.runs.statusApproved" },
  rejected: { color: "text-rose-500", bg: "bg-rose-500/10", label: "platformMisc.runs.statusRejected" },
  revision_requested: { color: "text-amber-500", bg: "bg-amber-500/10", label: "platformMisc.runs.statusRevision" },
};

const TARGET_LABELS = {
  user: "platformMisc.runs.targetUser", group: "platformMisc.runs.targetGroup", program: "platformMisc.runs.targetProgram", cohort: "platformMisc.runs.targetCohort",
  team: "platformMisc.runs.targetTeam", organization: "platformMisc.runs.targetOrganization", all: "platformMisc.runs.targetAll",
};

function cn(...classes) { return classes.filter(Boolean).join(" "); }

// ─── Optimized Runs Table (memoized for performance) ───
const RunsTable = React.memo(function RunsTable({ runs, search, statusFilter, sortField, sortDir, page, perPage, onSort, onPage, openRun, groups }) {
  const { t } = useI18n();
  const filtered = useMemo(() => {
    return runs.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      // When "all" is selected, exclude archived
      if (statusFilter === "all" && r.status === "archived") return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [runs, search, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      if (sortField === "created_at" || sortField === "opens_at" || sortField === "closes_at") {
        return sortDir === "asc" ? new Date(aVal) - new Date(bVal) : new Date(bVal) - new Date(aVal);
      }
      return sortDir === "asc" ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / perPage);
  const paginated = useMemo(() => sorted.slice((page - 1) * perPage, page * perPage), [sorted, page, perPage]);

  if (sorted.length === 0) return <div className="text-center py-16 text-[var(--text-secondary)] text-[11px] font-bold">{t("platformMisc.runs.noRunsFound")}</div>;

  return <>
    <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
      <table className="w-full text-left">
        <thead className="bg-tertiary">
          <tr className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
            <th className="px-3 py-3 w-10">{t("platformMisc.runs.colSn")}</th>
            {[
              { key: "name", label: t("platformMisc.runs.colName"), w: "" },
              { key: "form_name", label: t("platformMisc.runs.form"), w: "w-40" },
              { key: "group_target_id", label: t("platformMisc.runs.targetGroup"), w: "w-32" },
              { key: "status", label: t("platformMisc.runs.colStatus"), w: "w-28" },
              { key: "opens_at", label: t("platformMisc.runs.opens"), w: "w-28" },
              { key: "closes_at", label: t("platformMisc.runs.closes"), w: "w-28" },
              { key: "created_at", label: t("platformMisc.runs.created"), w: "w-28" },
            ].map((col) => (
              <th key={col.key} className={`px-3 py-3 cursor-pointer hover:text-[var(--brand-orange)] transition-colors ${col.w}`} onClick={() => {
                if (sortField === col.key) onSort(col.key, sortDir === "asc" ? "desc" : "asc");
                else onSort(col.key, "asc");
              }}>
                <span className="flex items-center gap-1">
                  {col.label}
                  {sortField === col.key && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-primary)]">
          {paginated.map((r, i) => {
            const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.draft;
            const sn = (page - 1) * perPage + i + 1;
            return (
              <tr key={r.id} onClick={() => openRun(r)} className="text-[11px] font-bold text-[var(--text-primary)] hover:bg-tertiary/50 cursor-pointer">
                <td className="px-3 py-3 text-[var(--text-secondary)] text-center">{sn}</td>
                <td className="px-3 py-3 font-black uppercase truncate max-w-[250px]">
                  <div className="flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 text-[var(--brand-orange)] shrink-0" />
                    <span className="truncate">{r.name}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] truncate max-w-[160px]">{r.form_name || "—"}</td>
                <td className="px-3 py-3 text-[10px] font-bold truncate max-w-[120px]">
                  {(() => {
                    const g = groups.find((x) => (x.registration_id || x.id) === r.group_target_id);
                    return g ? (
                      <span className="text-[var(--brand-orange)]">{g.name}</span>
                    ) : (
                      <span className="text-[var(--text-secondary)]">—</span>
                    );
                  })()}
                </td>
                <td className="px-3 py-3"><span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase whitespace-nowrap", cfg.color, cfg.bg)}>{t(cfg.label)}</span></td>
                <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] whitespace-nowrap">{r.opens_at ? new Date(r.opens_at).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] whitespace-nowrap">{r.closes_at ? new Date(r.closes_at).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {totalPages > 1 && (
      <div className="flex items-center justify-between pt-2">
        <p className="text-[10px] text-[var(--text-secondary)]">{t("platformMisc.runs.showingRange", { start: ((page - 1) * perPage) + 1, end: Math.min(page * perPage, sorted.length), total: sorted.length })}</p>
        <div className="flex items-center gap-1">
          <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className="px-2 py-1 rounded-lg bg-tertiary text-[10px] font-bold text-[var(--text-secondary)] disabled:opacity-30 hover:text-[var(--text-primary)]">{t("platformMisc.runs.prev")}</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pn;
            if (totalPages <= 7) pn = i + 1;
            else if (page <= 4) pn = i + 1;
            else if (page >= totalPages - 3) pn = totalPages - 6 + i;
            else pn = page - 3 + i;
            return <button key={pn} onClick={() => onPage(pn)} className={cn("w-7 h-7 rounded-lg text-[10px] font-bold", page === pn ? "bg-[var(--brand-orange)] text-black" : "bg-tertiary text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>{pn}</button>;
          })}
          <button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-2 py-1 rounded-lg bg-tertiary text-[10px] font-bold text-[var(--text-secondary)] disabled:opacity-30 hover:text-[var(--text-primary)]">{t("platformMisc.runs.next")}</button>
        </div>
      </div>
    )}
  </>;
});


// ─── Mini Calendar Picker ───
function MiniCalendar({ value, onChange, onClose }) {
  const { t } = useI18n();
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

  const MONTHS = [t("platformMisc.runs.monthJanuary"),t("platformMisc.runs.monthFebruary"),t("platformMisc.runs.monthMarch"),t("platformMisc.runs.monthApril"),t("platformMisc.runs.monthMay"),t("platformMisc.runs.monthJune"),t("platformMisc.runs.monthJuly"),t("platformMisc.runs.monthAugust"),t("platformMisc.runs.monthSeptember"),t("platformMisc.runs.monthOctober"),t("platformMisc.runs.monthNovember"),t("platformMisc.runs.monthDecember")];
  const DAYS = [t("platformMisc.runs.daySun"),t("platformMisc.runs.dayMon"),t("platformMisc.runs.dayTue"),t("platformMisc.runs.dayWed"),t("platformMisc.runs.dayThu"),t("platformMisc.runs.dayFri"),t("platformMisc.runs.daySat")];
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
        <label className="text-[9px] font-black uppercase text-[var(--text-secondary)] block mb-2">{t("platformMisc.runs.time")}</label>
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
          {value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : t("platformMisc.runs.noDateSelected")}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase hover:brightness-110 transition-all"
        >
          {t("platformMisc.runs.done")}
        </button>
      </div>
    </div>
  );
}


export default function FormRunsPage() {
  const { t } = useI18n();
  const [runs, setRuns] = useState([]);
  const [forms, setForms] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(15);
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  // Detail view
  const [selectedRun, setSelectedRun] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");
  const [subFilter, setSubFilter] = useState("all"); // "all" | "submitted" | "approved" | "rejected" | "revision_requested" | "draft"

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createData, setCreateData] = useState({ form_id: "", name: "", description: "", opens_at: "", closes_at: "", group_id: "" });
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false); // 'opens' | 'closes' | null
  const [showOpensCal, setShowOpensCal] = useState(false);
  const [showClosesCal, setShowClosesCal] = useState(false);

  // Inline group creation (from run create modal + assign modal)
  const [showInlineGroup, setShowInlineGroup] = useState(false);
  const [inlineGroupName, setInlineGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

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

  // Form fields for spreadsheet column view
  const [runFormFields, setRunFormFields] = useState([]);

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

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/groups");
      const data = await res.json();
      if (data.success) setGroups(data.groups || []);
    } catch (_) {}
  }, []);

  const handleCreateGroupInline = async (onDone) => {
    const name = inlineGroupName.trim();
    if (!name) return;
    setCreatingGroup(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success && data.group) {
        notify(t("platformMisc.runs.groupCreated"));
        setShowInlineGroup(false);
        setInlineGroupName("");
        await fetchGroups();
        if (onDone) onDone(data.group);
      } else {
        notify(data.error || t("platformMisc.runs.failedToCreateGroup"));
      }
    } catch (_) {
      notify(t("platformMisc.runs.failedToCreateGroup"));
    } finally {
      setCreatingGroup(false);
    }
  };

  const fetchDashboardStats = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/form-runs?dashboard=true");
      const data = await res.json();
      if (data.success) setDashboardStats(data.stats);
    } catch (_) {}
  }, []);

  useEffect(() => { fetchRuns(); fetchForms(); fetchContacts(); fetchGroups(); fetchDashboardStats(); }, [fetchRuns]);

  const openRun = useCallback(async (run) => {
    setSelectedRun(run);
    setDetailTab("overview");
    setSubFilter("all");
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

      // Fetch form fields for spreadsheet column view
      try {
        const formRes = await fetch(`/api/platform/forms?id=${run.form_id}`);
        const formData = await formRes.json();
        if (formData.success) {
          setRunFormFields((formData.fields || []).filter(f => !["hidden"].includes(f.field_type)).slice(0, 5));
        }
      } catch (_) {}
    } catch (_) {}
    setSubLoading(false);
  }, []);

  const handleCreate = async () => {
    if (!createData.form_id || !createData.name.trim()) return;
    setSaving(true);
    try {
      const body = { ...createData };
      // Attach group assignment if selected
      if (createData.group_id) {
        body.assignments = [{ target_type: "group", target_id: createData.group_id }];
      }
      delete body.group_id; // not a DB column
      const res = await fetch("/api/platform/form-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        notify(t("platformMisc.runs.formRunCreated"));
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
        notify(t("platformMisc.runs.runLaunched"));
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
        notify(t("platformMisc.runs.runStatusChanged", { status: newStatus }));
        setSelectedRun(data.run);
        fetchRuns();
      }
    } catch (_) {}
  };

  const handleDeleteRun = async (id) => {
    if (!confirm(t("platformMisc.runs.deleteRunConfirm"))) return;
    try {
      const res = await fetch(`/api/platform/form-runs?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        notify(t("platformMisc.runs.runDeleted"));
        setSelectedRun(null);
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
        notify(data.already_approved ? t("platformMisc.runs.alreadyApproved") : t("platformMisc.runs.reviewSubmitted"));
        setShowReview(false);
        setReviewTimeline([]);
        if (selectedRun) openRun(selectedRun);
      } else {
        notify(data.error || t("platformMisc.runs.reviewFailed"));
      }
    } catch (_) {}
    setSaving(false);
  };

  // Manual Re-evaluate: the ONE deliberate exception to skip-already-evaluated
  const handleReevaluate = async () => {
    if (!reviewing) return;
    setSaving(true);
    try {
      const res = await fetch("/api/platform/ai/evaluate-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: reviewing.id, force: true }),
      });
      const data = await res.json();
      if (data.success) {
        notify(t("platformMisc.runs.reevaluationComplete"));
        setEvaluation(data.evaluation);
        if (selectedRun) openRun(selectedRun);
      } else {
        notify(data.error || t("platformMisc.runs.reevaluationFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.runs.networkError"));
    }
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
    // Fetch form fields to map IDs to labels
    if (selectedRun?.form_id) {
      try {
        const formRes = await fetch(`/api/platform/forms?id=${selectedRun.form_id}`);
        const formData = await formRes.json();
        if (formData.success) {
          setRunFormFields((formData.fields || []).filter(f => !["hidden"].includes(f.field_type)));
        }
      } catch (_) {}
    }
  };

  const handleAssign = async (targetOverride) => {
    const targetId = targetOverride || assignUserId;
    if (!targetId || !selectedRun) return;
    setSaving(true);
    try {
      const res = await fetch("/api/platform/form-runs?action=assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: selectedRun.id, target_type: assignTarget, target_id: targetId }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignments(data.assignments || []);
        notify(t("platformMisc.runs.assignmentAdded"));
        setShowAssign(false);
        setShowInlineGroup(false);
        setInlineGroupName("");
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
        notify(t("platformMisc.runs.assignmentRemoved"));
      }
    } catch (_) {}
  };

  const handleDeleteSubmission = async (submissionId) => {
    if (!confirm(t("platformMisc.runs.deleteSubmissionConfirm"))) return;
    try {
      const res = await fetch(`/api/platform/form-runs?action=delete_submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId }),
      });
      const data = await res.json();
      if (data.success) {
        notify(t("platformMisc.runs.submissionDeleted"));
        // Reload run data
        if (selectedRun) openRun(selectedRun);
      } else {
        notify(data.error || t("platformMisc.runs.deleteFailed"));
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
        notify(t("platformMisc.runs.settingsSaved"));
        setEditingSettings(false);
      }
    } catch (_) {}
    setSaving(false);
  };

  // AI Evaluation progress state (Phase 4 client-driven batching)
  const [evalProgress, setEvalProgress] = useState(null); // { total, evaluated, failed, remaining, percent, running, batch }
  const [evalStats, setEvalStats] = useState(null); // { approvals, emails }

  const fetchEvalProgress = async (formId) => {
    try {
      const res = await fetch("/api/platform/ai/evaluate-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_id: formId, action: "progress" }),
      });
      const data = await res.json();
      if (data.success) {
        setEvalStats({ approvals: data.approvals || { approved: 0, rejected: 0 }, emails: data.emails || { sent: 0, failed: 0, pending: 0, activation_sent: 0, approval_sent: 0 } });
        return data.progress;
      }
      return null;
    } catch (_) {
      return null;
    }
  };

  const handleBatchEvaluate = async (retryOnly = false) => {
    if (!selectedRun?.form_id) return notify(t("platformMisc.runs.noFormLinked"));
    const formId = selectedRun.form_id;

    // Initial progress snapshot
    const initial = await fetchEvalProgress(formId);
    if (initial) {
      setEvalProgress({ ...initial, running: true, batch: 0, stopped: false });
      if (initial.remaining === 0) {
        notify(initial.failed > 0 ? t("platformMisc.runs.evalCompleteRetry", { failed: initial.failed }) : t("platformMisc.runs.allEvaluated"));
        setEvalProgress((p) => p && { ...p, running: false, stopped: true });
        return;
      }
    } else {
      notify(t("platformMisc.runs.evalProgressUnreadable"));
      return;
    }

    // Client-driven loop: one request per batch of 20
    let batchNo = 0;
    let stopped = false;
    while (true) {
      batchNo++;
      setEvalProgress((p) => p && { ...p, batch: batchNo });
      let data;
      try {
        const res = await fetch("/api/platform/ai/evaluate-submission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            form_id: formId,
            action: retryOnly ? "retry_failed" : "batch",
            batch_size: 20,
          }),
        });
        data = await res.json();
      } catch (_) {
        stopped = true;
        setEvalProgress((p) => p && { ...p, running: false, stopped: true });
        notify(t("platformMisc.runs.networkErrorPaused"));
        break;
      }

      if (!data.success) {
        stopped = true;
        setEvalProgress((p) => p && { ...p, running: false, stopped: true });
        notify(data.error || t("platformMisc.runs.evalStopped"));
        break;
      }

      const prog = data.progress;
      setEvalProgress({ ...prog, running: true, batch: batchNo, stopped: false });

      if (prog.remaining === 0) {
        setEvalProgress({ ...prog, running: false, batch: batchNo, stopped: true });
        notify(
          t("platformMisc.runs.evalCompleteCount", { evaluated: prog.evaluated, total: prog.total }) +
            (prog.failed > 0 ? t("platformMisc.runs.evalFailedCount", { failed: prog.failed }) : "")
        );
        await fetchEvalProgress(formId); // refresh approval + email stats
        break;
      }

      if (data.processed === 0 && data.evaluated === 0) {
        // Nothing processed this round (all claimed/failed) — avoid infinite loop
        setEvalProgress({ ...prog, running: false, batch: batchNo, stopped: true });
        notify(t("platformMisc.runs.noProgressBatch"));
        break;
      }
    }

    if (selectedRun) openRun(selectedRun);
    return { stopped };
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
    const filteredSubmissions = subFilter === "all" ? submissions : submissions.filter((s) => s.status === subFilter);

    const tabs = [
      { id: "overview", label: t("platformMisc.runs.tabOverview"), icon: BarChart3 },
      { id: "share", label: t("platformMisc.runs.tabShare"), icon: Link2 },
      { id: "assignments", label: t("platformMisc.runs.tabAssignments", { count: assignments.length }), icon: Users },
      { id: "responses", label: t("platformMisc.runs.tabAllResponses"), icon: FileText, href: `/platform/responses?form_id=${selectedRun?.form_id || ""}` },
      { id: "settings", label: t("platformMisc.runs.tabSettings"), icon: Settings },
    ];

    return (
      <div className="flex flex-col h-screen overflow-hidden">
        {notification && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase animate-in">{notification}</div>}
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-[var(--border-primary)] bg-secondary shrink-0">
          <button onClick={() => setSelectedRun(null)} className="text-[10px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft className="w-3 h-3 inline mr-1" /> {t("platformMisc.runs.back")}</button>
          <span className="text-[var(--text-secondary)] opacity-30">|</span>
          <Play className="w-4 h-4 text-[var(--brand-orange)]" />
          <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{selectedRun.name}</h2>
          <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", cfg.color, cfg.bg)}>{t(cfg.label)}</span>
          {(() => {
            const g = groups.find((x) => (x.registration_id || x.id) === selectedRun.group_target_id);
            return g ? (
              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase whitespace-nowrap text-[var(--brand-orange)] bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30">{t("platformMisc.runs.assignedGroup", { name: g.name })}</span>
            ) : null;
          })()}
          {/* Status action buttons */}
          {selectedRun.status === "draft" && (
            <button onClick={() => handleLaunch(selectedRun.id)} className="px-3 py-1.5 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase hover:brightness-110">{t("platformMisc.runs.launch")}</button>
          )}
          {selectedRun.status === "active" && (
            <button onClick={() => handleStatusChange(selectedRun.id, "closed")} className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[9px] font-black uppercase hover:bg-amber-500/20 flex items-center gap-1"><StopCircle className="w-3 h-3" /> {t("platformMisc.runs.close")}</button>
          )}
          {(selectedRun.status === "active" || selectedRun.status === "closed") && (
            <button onClick={() => handleStatusChange(selectedRun.id, "cancelled")} className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/30 text-[9px] font-black uppercase hover:bg-rose-500/20 flex items-center gap-1"><XCircle className="w-3 h-3" /> {t("platformMisc.runs.cancel")}</button>
          )}
          {selectedRun.status === "closed" && (
            <button onClick={() => handleStatusChange(selectedRun.id, "archived")} className="px-3 py-1.5 rounded-xl bg-slate-500/10 text-slate-500 border border-slate-500/30 text-[9px] font-black uppercase hover:bg-slate-500/20 flex items-center gap-1"><Archive className="w-3 h-3" /> {t("platformMisc.runs.archive")}</button>
          )}
          {selectedRun.status === "archived" && (
            <button onClick={() => handleDeleteRun(selectedRun.id)} className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/30 text-[9px] font-black uppercase hover:bg-rose-500/20 flex items-center gap-1"><Trash2 className="w-3 h-3" /> {t("platformMisc.runs.delete")}</button>
          )}
          {(selectedRun.status === "closed" || selectedRun.status === "cancelled") && (
            <button onClick={() => handleStatusChange(selectedRun.id, "active")} className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[9px] font-black uppercase hover:bg-emerald-500/20 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {t("platformMisc.runs.reactivate")}</button>
          )}
          {selectedRun.status === "active" && (
            <div className="ml-auto flex items-center gap-2">
              {evalProgress?.running ? (
                <span className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[9px] font-black uppercase flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {evalProgress.evaluated}/{evalProgress.total} — {evalProgress.percent}%
                </span>
              ) : (
                <>
                  {evalProgress && evalProgress.failed > 0 && (
                    <button onClick={() => handleBatchEvaluate(true)} className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/30 text-[9px] font-black uppercase hover:bg-rose-500/20 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> {t("platformMisc.runs.retryFailed", { count: evalProgress.failed })}
                    </button>
                  )}
                  <button
                    onClick={() => handleBatchEvaluate(false)}
                    className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[9px] font-black uppercase hover:bg-purple-500/20 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    {evalProgress && evalProgress.remaining > 0 && !evalProgress.stopped
                      ? t("platformMisc.runs.continueEvaluation")
                      : evalProgress && evalProgress.remaining > 0
                      ? t("platformMisc.runs.continueEvaluation")
                      : t("platformMisc.runs.evaluateAll")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ─── AI EVALUATION PROGRESS PANEL ─── */}
        {evalProgress && (evalProgress.running || evalProgress.stopped) && (
          <div className="px-6 py-3 border-b border-purple-500/20 bg-purple-500/5 shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                {evalProgress.running ? (
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                ) : (
                  <PauseCircle className="w-4 h-4 text-purple-400" />
                )}
                <span className="text-[10px] font-black uppercase text-purple-300">
                  {evalProgress.running ? t("platformMisc.runs.aiEvalInProgress") : t("platformMisc.runs.aiEvalPaused")}
                </span>
              </div>
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                {t("platformMisc.runs.evalProgressCount", { evaluated: evalProgress.evaluated, total: evalProgress.total })}
              </span>
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                {t("platformMisc.runs.evalPercentComplete", { percent: evalProgress.percent })}
              </span>
              {evalProgress.batch > 0 && (
                <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                  {t("platformMisc.runs.batchCount", { batch: evalProgress.batch })}
                </span>
              )}
              {evalProgress.failed > 0 && (
                <span className="text-[10px] font-bold text-rose-500">
                  {t("platformMisc.runs.failedCount", { failed: evalProgress.failed })}
                </span>
              )}
              {evalProgress.remaining > 0 && (
                <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                  {t("platformMisc.runs.remainingCount", { remaining: evalProgress.remaining })}
                </span>
              )}
            </div>
            {/* Progress bar */}
            <div className="mt-2 w-full bg-[var(--border-primary)] rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${evalProgress.percent}%` }}
              />
            </div>
            <p className="mt-2 text-[8px] text-[var(--text-secondary)] uppercase tracking-wider">
              {evalProgress.running
                ? t("platformMisc.runs.evalKeepOpen")
                : t("platformMisc.runs.evalPausedHint")}
            </p>

            {/* Approval + email dashboard */}
            {evalStats && (
              <div className="mt-3 pt-3 border-t border-purple-500/20 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="text-sm font-black text-emerald-500">{evalStats.approvals?.approved ?? 0}</p>
                  <p className="text-[7px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.statusApproved")}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-rose-500">{evalStats.approvals?.rejected ?? 0}</p>
                  <p className="text-[7px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.statusRejected")}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-blue-500">{evalStats.emails?.sent ?? 0}</p>
                  <p className="text-[7px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.emailsSent")}</p>
                </div>
                <div className="text-center">
                  <p className={`text-sm font-black ${(evalStats.emails?.failed ?? 0) > 0 ? "text-rose-500" : "text-[var(--text-secondary)]"}`}>{evalStats.emails?.failed ?? 0}</p>
                  <p className="text-[7px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.emailsFailed")}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-[var(--brand-orange)]">{evalStats.emails?.activation_sent ?? 0}</p>
                  <p className="text-[7px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.activationSent")}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-emerald-500">{evalStats.emails?.approval_sent ?? 0}</p>
                  <p className="text-[7px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.approvalEmails")}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-0 px-6 border-b border-[var(--border-primary)] shrink-0 bg-secondary">
          {tabs.map((t) => (
            t.href ? (
              <a key={t.id} href={t.href} className="flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase border-b-2 transition-colors border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <t.icon className="w-3 h-3" /> {t.label}
              </a>
            ) : (
              <button key={t.id} onClick={() => setDetailTab(t.id)} className={cn("flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase border-b-2 transition-colors", detailTab === t.id ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>
                <t.icon className="w-3 h-3" /> {t.label}
              </button>
            )
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
                  { label: t("platformMisc.runs.total"), value: subtotal, filter: "all", icon: Hash, color: "text-[var(--text-primary)]" },
                  { label: t("platformMisc.runs.statusSubmitted"), value: submitted, filter: "submitted", icon: Send, color: "text-blue-500" },
                  { label: t("platformMisc.runs.statusApproved"), value: approved, filter: "approved", icon: CheckCircle2, color: "text-emerald-500" },
                  { label: t("platformMisc.runs.statusRejected"), value: rejected, filter: "rejected", icon: XCircle, color: "text-rose-500" },
                  { label: t("platformMisc.runs.statusRevision"), value: revision, filter: "revision_requested", icon: RotateCcw, color: "text-amber-500" },
                  { label: t("platformMisc.runs.drafts"), value: drafts, filter: "draft", icon: FileText, color: "text-slate-500" },
                  ...(overdue > 0 ? [{ label: t("platformMisc.runs.overdue"), value: overdue, filter: "submitted", icon: AlertTriangle, color: "text-rose-500" }] : []),
                ].map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setSubFilter(subFilter === s.filter ? "all" : s.filter)}
                    className={cn(
                      "p-4 rounded-2xl border text-center transition-all",
                      subFilter === s.filter
                        ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)]"
                        : "bg-secondary border-[var(--border-primary)] hover:border-[var(--text-secondary)]"
                    )}
                  >
                    <p className={cn("text-2xl font-black", s.color)}>{s.value}</p>
                    <div className="flex items-center justify-center gap-1 mt-0.5"><s.icon className={cn("w-2.5 h-2.5", s.color)} /><p className="text-[9px] font-bold uppercase text-[var(--text-secondary)]">{s.label}</p></div>
                  </button>
                ))}
              </div>

              {/* Submissions table */}
              {subLoading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" /></div> : (
                <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                  <table className="w-full text-left">
                    <thead className="bg-tertiary">
                      <tr className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                        <th className="px-4 py-3">{t("platformMisc.runs.colSubmitter")}</th>
                        {runFormFields.slice(0, 3).map(f => (
                          <th key={f.id} className="px-3 py-3 max-w-[120px]" title={f.label}>
                            <span className="line-clamp-1">{f.label.length > 25 ? f.label.substring(0, 25) + "..." : f.label}</span>
                          </th>
                        ))}
                        <th className="px-4 py-3">{t("platformMisc.runs.colStatus")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colScore")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.statusSubmitted")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colActions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-primary)]">
                      {filteredSubmissions.map((s) => {
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
                        
                        // Helper to get field value from submission data
                        const fv = (field) => {
                          const val = subData[field.label] ?? subData[String(field.id)] ?? subData[field.id];
                          if (val === undefined || val === null || val === "") return "—";
                          const s = String(val);
                          if (s.startsWith("{") && s.includes('"code"')) {
                            try { const p = JSON.parse(s); if (p.code && p.number) return `${p.code} ${p.number}`; } catch (_) {}
                          }
                          return s.length > 30 ? s.substring(0, 30) + "..." : s;
                        };
                        
                        return (
                          <tr key={s.id} className="text-[11px] font-bold text-[var(--text-primary)] hover:bg-tertiary/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-[var(--text-secondary)]" />{s.submitter_name || s.submitter_id}</div>
                            </td>
                            {runFormFields.slice(0, 3).map(f => (
                              <td key={f.id} className="px-3 py-3 text-[10px] text-[var(--text-secondary)] max-w-[150px] truncate" title={fv(f)}>{fv(f)}</td>
                            ))}
                            <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", sc.color, sc.bg)}>{t(sc.label)}</span></td>
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
                              {lastReview ? <span>{lastReview.decision} {t("platformMisc.runs.by")} {lastReview.reviewer_name || lastReview.reviewer_id}</span> : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => setSelectedSubmission(selectedSubmission?.id === s.id ? null : s)} className="px-2 py-1 rounded-lg bg-tertiary text-[var(--text-secondary)] text-[8px] font-black uppercase hover:bg-[var(--brand-orange)]/10 hover:text-[var(--brand-orange)] flex items-center gap-1">
                                  <History className="w-3 h-3" /> {t("platformMisc.runs.history")}
                                </button>
                                <a href={`/platform/runs/review/${s.id}`} className="px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400 text-[8px] font-black uppercase hover:bg-purple-500/20 flex items-center gap-1">
                                  <Eye className="w-3 h-3" /> {t("platformMisc.runs.full")}
                                </a>
                                {s.status === "submitted" && (
                                  <button onClick={() => openReview(s)} className="px-2 py-1 rounded-lg bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] text-[8px] font-black uppercase hover:bg-[var(--brand-orange)]/20">{t("platformMisc.runs.review")}</button>
                                )}
                                <button onClick={() => handleDeleteSubmission(s.id)} className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-500 text-[8px] font-black uppercase hover:bg-rose-500/20">{t("platformMisc.runs.delete")}</button>
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
            const slug = selectedRun.public_slug;
            const submitUrl = slug ? `${baseUrl}/s/${slug}` : null;
            const embedCode = submitUrl ? `<iframe src="${submitUrl}" width="100%" height="600" frameborder="0" style="border-radius:12px;border:1px solid #334155;"></iframe>` : null;
            const isActive = selectedRun.status === "active";
            return (
              <div className="space-y-6 max-w-2xl">
                {!slug && (
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <p className="text-[10px] font-bold text-amber-400">{t("platformMisc.runs.shareLinkWarning")}</p>
                  </div>
                )}
                {slug && (
                  <>
                    {/* Direct Link */}
                    <div>
                      <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.directLink")}</h3>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1 mb-3">{t("platformMisc.runs.directLinkDesc")}</p>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={submitUrl}
                          className="flex-1 rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]"
                        />
                        <button
                          onClick={() => { navigator.clipboard.writeText(submitUrl); notify(t("platformMisc.runs.linkCopied")); }}
                          className="px-4 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase hover:brightness-110"
                        >
                          {t("platformMisc.runs.copy")}
                        </button>
                      </div>
                    </div>

                    {/* Embed Code */}
                    <div>
                      <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.embedCode")}</h3>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1 mb-3">{t("platformMisc.runs.embedCodeDesc")}</p>
                      <div className="flex gap-2">
                        <textarea
                          readOnly
                          rows={3}
                          value={embedCode}
                          className="flex-1 rounded-xl px-4 py-3 text-[10px] font-mono outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none"
                        />
                        <button
                          onClick={() => { navigator.clipboard.writeText(embedCode); notify(t("platformMisc.runs.embedCodeCopied")); }}
                          className="px-4 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase hover:brightness-110 self-start"
                        >
                          {t("platformMisc.runs.copy")}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Preview */}
                {isActive && slug && (
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-[9px] font-bold text-emerald-400">{t("platformMisc.runs.runActiveNotice")}</p>
                  </div>
                )}
                {selectedRun.status === "draft" && (
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <p className="text-[9px] font-bold text-amber-400">{t("platformMisc.runs.launchFirstNotice")}</p>
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
                  <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.assignedAudiences")}</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">{t("platformMisc.runs.assignedAudiencesDesc")}</p>
                </div>
                <button onClick={() => { setShowAssign(true); setAssignTarget("user"); setAssignUserId(""); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase hover:brightness-110"><Plus className="w-3 h-3" /> {t("platformMisc.runs.add")}</button>
              </div>

              {assignments.length === 0 ? (
                <div className="py-16 text-center bg-secondary rounded-2xl border border-[var(--border-primary)] border-dashed">
                  <Users className="w-8 h-8 mx-auto text-[var(--text-secondary)] opacity-30" />
                  <p className="text-[12px] font-bold text-[var(--text-secondary)] mt-3">{t("platformMisc.runs.noAssignments")}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">{t("platformMisc.runs.noAssignmentsHint")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                  <table className="w-full text-left">
                    <thead className="bg-tertiary">
                      <tr className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                        <th className="px-4 py-3">{t("platformMisc.runs.colType")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.targetId")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colAssigned")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colActions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-primary)]">
                      {assignments.map((a) => {
                        const g = a.target_type === "group" ? groups.find((x) => (x.registration_id || x.id) === a.target_id) : null;
                        const c = a.target_type === "user" ? contacts.find((x) => x.cid === a.target_id) : null;
                        const targetName = g ? g.name : c ? (c.name || c.email) : a.target_id;
                        return (
                          <tr key={a.id} className="text-[11px] font-bold text-[var(--text-primary)] hover:bg-tertiary/50">
                            <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] text-[8px] font-black uppercase">{t(TARGET_LABELS[a.target_type]) || a.target_type}</span></td>
                            <td className="px-4 py-3 text-[10px] text-[var(--text-secondary)]">{targetName}</td>
                            <td className="px-4 py-3 text-[10px] text-[var(--text-secondary)]">{new Date(a.assigned_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3"><button onClick={() => handleUnassign(a.id)} className="text-rose-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add assignment modal */}
              {showAssign && (
                <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowAssign(false)}>
                  <div className="card w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center"><h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.addAssignment")}</h3><button onClick={() => setShowAssign(false)}><X className="w-5 h-5" /></button></div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.targetType")}</label>
                        <select value={assignTarget} onChange={(e) => { setAssignTarget(e.target.value); setAssignUserId(""); }} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
                          {Object.entries(TARGET_LABELS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                        </select>
                      </div>
                      {assignTarget === "user" ? (
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.targetUser")}</label>
                          <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] max-h-40">
                            <option value="">{t("platformMisc.runs.selectUser")}</option>
                            {contacts.map((c) => <option key={c.cid} value={c.cid}>{c.name || c.email || c.cid}</option>)}
                          </select>
                        </div>
                      ) : assignTarget === "group" ? (
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.targetGroup")}</label>
                          <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
                            <option value="">{t("platformMisc.runs.selectGroup")}</option>
                            {groups.map((g) => <option key={g.registration_id || g.id} value={g.registration_id || g.id}>{g.name}</option>)}
                          </select>
                          {!showInlineGroup ? (
                            <button
                              type="button"
                              onClick={() => setShowInlineGroup(true)}
                              className="text-[9px] font-black uppercase text-[var(--brand-orange)] hover:opacity-80 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> {t("platformMisc.runs.newGroup")}
                            </button>
                          ) : (
                            <div className="flex gap-2 items-center">
                              <input
                                autoFocus
                                value={inlineGroupName}
                                onChange={(e) => setInlineGroupName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroupInline((grp) => handleAssign(grp.registration_id || grp.id)); }}
                                placeholder={t("platformMisc.runs.groupNamePlaceholder")}
                                className="flex-1 rounded-xl px-3 py-2 text-[11px] font-bold outline-none bg-primary border border-[var(--brand-orange)] text-[var(--text-primary)]"
                              />
                              <button
                                type="button"
                                onClick={() => handleCreateGroupInline((grp) => handleAssign(grp.registration_id || grp.id))}
                                disabled={creatingGroup || !inlineGroupName.trim()}
                                className="px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase disabled:opacity-40"
                              >
                                {creatingGroup ? "..." : t("platformMisc.runs.createAndAssign")}
                              </button>
                              <button type="button" onClick={() => { setShowInlineGroup(false); setInlineGroupName(""); }} className="p-2 text-[var(--text-secondary)] hover:text-rose-500"><X className="w-3 h-3" /></button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.targetId")}</label><input value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]" placeholder={t("platformMisc.runs.targetIdPlaceholder")} /></div>
                      )}
                    </div>
                    <div className="flex gap-2"><button onClick={() => setShowAssign(false)} className="flex-1 btn btn-secondary">{t("platformMisc.runs.cancel")}</button><button onClick={handleAssign} disabled={saving || !assignUserId} className="flex-1 btn btn-primary">{saving ? t("platformMisc.runs.adding") : t("platformMisc.runs.add")}</button></div>
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
                  <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.runConfiguration")}</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">{t("platformMisc.runs.runConfigurationDesc")}</p>
                </div>
                {!editingSettings ? (
                  <button onClick={() => setEditingSettings(true)} className="px-3 py-2 rounded-xl bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] text-[9px] font-black uppercase hover:bg-[var(--brand-orange)]/20">{t("platformMisc.runs.edit")}</button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingSettings(false); setRunSettings(selectedRun.settings || {}); }} className="px-3 py-2 rounded-xl bg-tertiary text-[var(--text-secondary)] text-[9px] font-black uppercase">{t("platformMisc.runs.cancel")}</button>
                    <button onClick={handleSaveSettings} disabled={saving} className="px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase">{saving ? t("platformMisc.runs.saving") : t("platformMisc.runs.save")}</button>
                  </div>
                )}
              </div>

              <div className="space-y-4 bg-secondary border border-[var(--border-primary)] rounded-2xl p-5">
                {/* Submission Limits */}
                <SettingRow label={t("platformMisc.runs.settingSubmissionLimit")} icon={Hash} desc={t("platformMisc.runs.settingSubmissionLimitDesc")}>
                  {editingSettings ? (
                    <input type="number" min="0" value={runSettings.submission_limit ?? 0} onChange={(e) => setRunSettings({ ...runSettings, submission_limit: parseInt(e.target.value) || 0 })} className="w-24 rounded-xl px-3 py-2 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]" />
                  ) : (
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">{(runSettings.submission_limit || 0) === 0 ? t("platformMisc.runs.unlimited") : runSettings.submission_limit}</span>
                  )}
                </SettingRow>

                {/* Multiple Submissions */}
                <SettingRow label={t("platformMisc.runs.settingMultipleSubmissions")} icon={Send} desc={t("platformMisc.runs.settingMultipleSubmissionsDesc")}>
                  {editingSettings ? (
                    <Toggle checked={!!runSettings.allow_multiple} onChange={(v) => setRunSettings({ ...runSettings, allow_multiple: v })} />
                  ) : (
                    <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded", runSettings.allow_multiple ? "text-emerald-500 bg-emerald-500/10" : "text-slate-500 bg-slate-500/10")}>{runSettings.allow_multiple ? t("platformMisc.runs.yes") : t("platformMisc.runs.no")}</span>
                  )}
                </SettingRow>

                {/* Anonymous Submissions */}
                <SettingRow label={t("platformMisc.runs.settingAnonymousSubmissions")} icon={EyeOff} desc={t("platformMisc.runs.settingAnonymousSubmissionsDesc")}>
                  {editingSettings ? (
                    <Toggle checked={!!runSettings.anonymous} onChange={(v) => setRunSettings({ ...runSettings, anonymous: v })} />
                  ) : (
                    <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded", runSettings.anonymous ? "text-emerald-500 bg-emerald-500/10" : "text-slate-500 bg-slate-500/10")}>{runSettings.anonymous ? t("platformMisc.runs.yes") : t("platformMisc.runs.no")}</span>
                  )}
                </SettingRow>

                {/* Auto-close */}
                <SettingRow label={t("platformMisc.runs.settingAutoClose")} icon={StopCircle} desc={t("platformMisc.runs.settingAutoCloseDesc")}>
                  {editingSettings ? (
                    <Toggle checked={!!runSettings.auto_close} onChange={(v) => setRunSettings({ ...runSettings, auto_close: v })} />
                  ) : (
                    <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded", runSettings.auto_close ? "text-emerald-500 bg-emerald-500/10" : "text-slate-500 bg-slate-500/10")}>{runSettings.auto_close ? t("platformMisc.runs.yes") : t("platformMisc.runs.no")}</span>
                  )}
                </SettingRow>

                {/* Confirmation Message */}
                <SettingRow label={t("platformMisc.runs.settingConfirmationMessage")} icon={MessageSquare} desc={t("platformMisc.runs.settingConfirmationMessageDesc")}>
                  {editingSettings ? (
                    <textarea value={runSettings.confirmation_message || ""} onChange={(e) => setRunSettings({ ...runSettings, confirmation_message: e.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none" placeholder={t("platformMisc.runs.confirmationMessagePlaceholder")} />
                  ) : (
                    <span className="text-[10px] text-[var(--text-secondary)]">{runSettings.confirmation_message || "—"}</span>
                  )}
                </SettingRow>

                {/* Instructions */}
                <SettingRow label={t("platformMisc.runs.settingSubmissionInstructions")} icon={Info} desc={t("platformMisc.runs.settingSubmissionInstructionsDesc")}>
                  {editingSettings ? (
                    <textarea value={runSettings.instructions || ""} onChange={(e) => setRunSettings({ ...runSettings, instructions: e.target.value })} rows={3} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none" placeholder={t("platformMisc.runs.instructionsPlaceholder")} />
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
          <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowReview(false)}>
            <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-secondary border border-[var(--border-primary)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>

              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)] shrink-0">
                <div>
                  <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.reviewSubmission")}</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{reviewing.submitter_name || t("platformMisc.runs.anonymous")}</p>
                </div>
                <button onClick={() => setShowReview(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-tertiary transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {/* Submitted Answers */}
                {reviewing.data && Object.keys(reviewing.data).length > 0 && (() => {
                  const subData = reviewing.data || {};
                  const entries = runFormFields
                    .filter(f => {
                      const val = subData[f.label] ?? subData[String(f.id)] ?? subData[f.id];
                      return val !== undefined && val !== null && val !== "";
                    })
                    .map(f => {
                      const val = subData[f.label] ?? subData[String(f.id)] ?? subData[f.id];
                      let display = String(val);
                      if (typeof val === "string" && val.startsWith("{") && val.includes('"code"')) {
                        try {
                          const p = JSON.parse(val);
                          if (p.code && p.number) {
                            const cnt = [{ code: "+234", flag: "🇳🇬" }, { code: "+229", flag: "🇧🇯" }, { code: "+233", flag: "🇬🇭" }, { code: "+254", flag: "🇰🇪" }, { code: "+27", flag: "🇿🇦" }, { code: "+20", flag: "🇪🇬" }, { code: "+33", flag: "🇫🇷" }, { code: "+44", flag: "🇬🇧" }, { code: "+1", flag: "🇺🇸" }, { code: "+49", flag: "🇩🇪" }, { code: "+91", flag: "🇮🇳" }, { code: "+971", flag: "🇦🇪" }].find(c => c.code === p.code);
                            display = `${cnt?.flag || ""} ${p.code} ${p.number}`;
                          }
                        } catch (_) {}
                      }
                      return { label: f.label, value: display, type: f.field_type };
                    });

                  // Fallback unmatched keys
                  const unmatched = Object.entries(subData)
                    .filter(([k]) => k !== "_scores" && k !== "_evaluation")
                    .filter(([k]) => !runFormFields.some(f => String(f.id) === k || f.label === k));

                  const allEntries = [
                    ...entries,
                    ...unmatched.map(([key, value]) => ({ label: key, value: String(value), type: "text" })),
                  ];

                  if (allEntries.length === 0) return null;

                  return (
                    <div>
                      <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider mb-3">{t("platformMisc.runs.submittedAnswers")}</p>
                      <div className="space-y-3">
                        {allEntries.map(({ label, value, type }) => (
                          <div key={label} className="rounded-xl bg-tertiary border border-[var(--border-primary)] p-4">
                            <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider mb-1.5">{label}</p>
                            <p className={cn(
                              "text-[13px] font-semibold text-[var(--text-primary)] leading-relaxed",
                              (type === "textarea" || type === "richtext") ? "whitespace-pre-wrap" : ""
                            )}>{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* AI Evaluation */}
                {evaluation?.dimensions && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[9px] font-black uppercase text-purple-400 tracking-wider">{t("platformMisc.runs.aiEvaluation")}</p>
                      <div className="flex items-center gap-3">
                        {evaluation.confidence != null && (
                          <span className="text-[9px] text-[var(--text-secondary)]">
                            {t("platformMisc.runs.confidence", { percent: (evaluation.confidence * 100).toFixed(0) })}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                          {t("platformMisc.runs.overallLabel")} <span className="text-purple-400 font-black">{evaluation.overall_score}%</span>
                          {evaluation.ranking && <> · {evaluation.ranking}</>}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-purple-500/20 overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-purple-500/5">
                          <tr className="text-[8px] font-black uppercase text-[var(--text-secondary)]">
                            <th className="px-3 py-2">{t("platformMisc.runs.colDimension")}</th>
                            <th className="px-3 py-2 text-center">{t("platformMisc.runs.colAi")}</th>
                            <th className="px-3 py-2 text-center">{t("platformMisc.runs.colOverride")}</th>
                            <th className="px-3 py-2 text-center">{t("platformMisc.runs.colFinal")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-primary)]">
                          {evaluation.dimensions.map((dim, di) => (
                            <tr key={di} className="text-[10px]">
                              <td className="px-3 py-2">
                                <span className="font-bold text-[var(--text-primary)]">{dim.name}</span>
                                {dim.reasoning && (
                                  <p className="text-[8px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">{dim.reasoning.substring(0, 120)}{dim.reasoning.length > 120 ? "..." : ""}</p>
                                )}
                                {dim.confidence != null && (
                                  <span className="text-[7px] text-[var(--text-secondary)] opacity-50">{t("platformMisc.runs.confidence", { percent: (dim.confidence * 100).toFixed(0) })}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="font-black text-purple-400">{dim.score}</span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number" min={0} max={10} step={0.5}
                                  value={dim.human_score ?? ""}
                                  placeholder={String(dim.score)}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? null : parseFloat(e.target.value);
                                    const updated = { ...evaluation };
                                    updated.dimensions[di].human_score = val;
                                    updated.dimensions[di].final_score = val ?? dim.score;
                                    setEvaluation(updated);
                                  }}
                                  className="w-14 px-1 py-0.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none text-center"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={cn("font-black", (dim.final_score ?? dim.score) >= 7 ? "text-emerald-400" : (dim.final_score ?? dim.score) >= 5 ? "text-amber-400" : "text-rose-400")}>
                                  {dim.final_score ?? dim.score}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {evaluation.recommendation && (
                      <div className="mt-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                        <p className="text-[8px] font-black uppercase text-purple-400 tracking-wider mb-1">{t("platformMisc.runs.recommendation")}</p>
                        <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed">{evaluation.recommendation}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Scoring Breakdown (separate from AI eval) */}
                {reviewing.data?._scores && (
                  <div className="rounded-xl bg-tertiary border border-[var(--border-primary)] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider">{t("platformMisc.runs.scoreBreakdown")}</p>
                      <span className={cn("text-base font-black", reviewing.data._scores.overall >= 80 ? "text-emerald-500" : reviewing.data._scores.overall >= 60 ? "text-amber-500" : "text-rose-500")}>
                        {reviewing.data._scores.overall}%
                        {reviewing.data._scores.ranking && <span className="ml-2 text-[10px] font-bold text-[var(--text-secondary)]">({reviewing.data._scores.ranking})</span>}
                      </span>
                    </div>
                    {reviewing.data._scores.sections && Object.entries(reviewing.data._scores.sections).map(([name, sec]) => (
                      <div key={name} className="flex items-center justify-between text-[10px] py-1 border-t border-[var(--border-primary)]">
                        <span className="text-[var(--text-secondary)]">{name} <span className="text-[8px] opacity-60">{t("platformMisc.runs.weight", { weight: sec.weight })}</span></span>
                        <span className={cn("font-black", sec.score >= 80 ? "text-emerald-500" : sec.score >= 60 ? "text-amber-500" : "text-rose-500")}>{sec.score}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Activity Timeline */}
                {reviewTimeline.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider mb-3">{t("platformMisc.runs.activityTimeline")}</p>
                    <div className="space-y-2">
                      {reviewTimeline.map((entry, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-[10px]">
                          <div className={cn("w-2 h-2 mt-1 rounded-full shrink-0",
                            entry.action === "submitted" ? "bg-blue-500" :
                            entry.action === "approved" ? "bg-emerald-500" :
                            entry.action === "rejected" ? "bg-rose-500" :
                            entry.action === "revision_requested" ? "bg-amber-500" :
                            "bg-slate-500"
                          )} />
                          <div>
                            <span className="font-black uppercase text-[var(--text-primary)]">{entry.action}</span>
                            {entry.actor_name && <span className="text-[var(--text-secondary)]"> {t("platformMisc.runs.by")} {entry.actor_name}</span>}
                            <span className="text-[var(--text-secondary)] ml-1">{new Date(entry.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Review Decision Form */}
                <div className="space-y-3 pt-2 border-t border-[var(--border-primary)]">
                  <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider">{t("platformMisc.runs.yourDecision")}</p>
                  <div>
                    <label className="text-[9px] font-black uppercase text-[var(--text-secondary)] mb-1.5 block">{t("platformMisc.runs.decision")}</label>
                    <select value={reviewData.decision} onChange={(e) => setReviewData({ ...reviewData, decision: e.target.value })} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
                      <option value="approved">{t("platformMisc.runs.decisionApprove")}</option>
                      <option value="rejected">{t("platformMisc.runs.decisionReject")}</option>
                      <option value="revision_requested">{t("platformMisc.runs.decisionRequestRevision")}</option>
                      <option value="escalated">{t("platformMisc.runs.decisionEscalate")}</option>
                      <option value="reassigned">{t("platformMisc.runs.decisionReassign")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-[var(--text-secondary)] mb-1.5 block">{t("platformMisc.runs.publicComment")} <span className="normal-case font-bold opacity-60">{t("platformMisc.runs.visibleToSubmitter")}</span></label>
                    <textarea value={reviewData.comment} onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none" placeholder={t("platformMisc.runs.commentPlaceholder")} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-[var(--text-secondary)] mb-1.5 block">{t("platformMisc.runs.internalNote")} <span className="text-amber-500 font-bold">{t("platformMisc.runs.privateNote")}</span></label>
                    <textarea value={reviewData.internal_note} onChange={(e) => setReviewData({ ...reviewData, internal_note: e.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-amber-500/5 border border-amber-500/20 text-[var(--text-primary)] resize-none" placeholder={t("platformMisc.runs.internalNotePlaceholder")} />
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-[var(--border-primary)] bg-secondary shrink-0">
                <button onClick={() => setShowReview(false)} className="flex-1 btn btn-secondary">{t("platformMisc.runs.cancel")}</button>
                <button
                  onClick={handleReevaluate}
                  disabled={saving}
                  title={t("platformMisc.runs.reevaluateTitle")}
                  className="flex-1 px-3 py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[9px] font-black uppercase hover:bg-purple-500/20 disabled:opacity-40 flex items-center justify-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> {t("platformMisc.runs.reevaluate")}
                </button>
                <button onClick={handleReview} disabled={saving} className="flex-1 btn btn-primary">{saving ? t("platformMisc.runs.saving") : t("platformMisc.runs.submitReview")}</button>
              </div>
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
            { label: t("platformMisc.runs.activeRuns"), value: dashboardStats.active_runs ?? 0, icon: Play, color: "text-emerald-500" },
            { label: t("platformMisc.runs.totalAssigned"), value: dashboardStats.total_assignments ?? 0, icon: Users, color: "text-blue-500" },
            { label: t("platformMisc.runs.submissions"), value: dashboardStats.total_submissions ?? 0, icon: Send, color: "text-indigo-500" },
            { label: t("platformMisc.runs.pendingReview"), value: dashboardStats.pending_reviews ?? 0, icon: Eye, color: "text-amber-500" },
            { label: t("platformMisc.runs.approvalRate"), value: (dashboardStats.approval_rate != null ? Math.round(dashboardStats.approval_rate) + "%" : "—"), icon: CheckCircle2, color: dashboardStats.approval_rate > 50 ? "text-emerald-500" : "text-rose-500" },
            { label: t("platformMisc.runs.overdue"), value: dashboardStats.overdue ?? 0, icon: AlertTriangle, color: (dashboardStats.overdue ?? 0) > 0 ? "text-rose-500" : "text-slate-500" },
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
          <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.runs.formRuns")}</h1>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">{t("platformMisc.runs.formRunsSubtitle")}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase hover:brightness-110"><Plus className="w-3.5 h-3.5" /> {t("platformMisc.runs.newRun")}</button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" /><input type="text" placeholder={t("platformMisc.runs.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]">
          <option value="all">{t("platformMisc.runs.allStatus")}</option><option value="draft">{t("platformMisc.runs.statusDraft")}</option><option value="scheduled">{t("platformMisc.runs.statusScheduled")}</option><option value="active">{t("platformMisc.runs.statusActive")}</option><option value="closed">{t("platformMisc.runs.statusClosed")}</option><option value="cancelled">{t("platformMisc.runs.statusCancelled")}</option><option value="archived">{t("platformMisc.runs.statusArchived")}</option>
        </select>
      </div>
      {loading ? <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" /></div> : (
        <RunsTable runs={runs} search={search} statusFilter={statusFilter} sortField={sortField} sortDir={sortDir} page={page} perPage={perPage} onSort={(f, d) => { setSortField(f); setSortDir(d); setPage(1); }} onPage={setPage} openRun={openRun} groups={groups} />
      )}

      {/* Create modal */}
      {/* ─── Date Picker Modal (completely outside create modal, no clipping) ─── */}
      {showDatePicker && (
        <div className="fixed inset-0 z-[600] bg-black/70 flex items-center justify-center p-6" onClick={() => setShowDatePicker(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-white/60">{t("platformMisc.runs.selecting")} {showDatePicker === 'opens' ? t("platformMisc.runs.opensDate") : t("platformMisc.runs.closesDate")}</span>
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
            <div className="flex justify-between items-center"><h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.newFormRun")}</h3><button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.form")}</label>
                <select value={createData.form_id} onChange={(e) => setCreateData({ ...createData, form_id: e.target.value })} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
                  <option value="">{t("platformMisc.runs.selectPublishedForm")}</option>
                  {forms.map((f) => <option key={f.id} value={f.id}>{f.name} (v{f.version})</option>)}
                </select>
              </div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.runName")}</label><input value={createData.name} onChange={(e) => setCreateData({ ...createData, name: e.target.value })} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]" placeholder={t("platformMisc.runs.runNamePlaceholder")} /></div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.description")}</label><textarea value={createData.description} onChange={(e) => setCreateData({ ...createData, description: e.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.opens")}</label>
                  <button onClick={() => setShowDatePicker('opens')} className={`w-full rounded-xl px-3 py-3 text-[10px] font-bold outline-none bg-primary border text-left flex items-center gap-2 transition-all ${createData.opens_at ? 'border-[var(--brand-orange)] text-[var(--text-primary)]' : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]'}`}>
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{createData.opens_at ? new Date(createData.opens_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : t("platformMisc.runs.setOpenDate")}</span>
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.closes")}</label>
                  <button onClick={() => setShowDatePicker('closes')} className={`w-full rounded-xl px-3 py-3 text-[10px] font-bold outline-none bg-primary border text-left flex items-center gap-2 transition-all ${createData.closes_at ? 'border-[var(--brand-orange)] text-[var(--text-primary)]' : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]'}`}>
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{createData.closes_at ? new Date(createData.closes_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : t("platformMisc.runs.setCloseDate")}</span>
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.assignToGroupOptional")}</label>
                <select
                  value={createData.group_id}
                  onChange={(e) => setCreateData({ ...createData, group_id: e.target.value })}
                  className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]"
                >
                  <option value="">{t("platformMisc.runs.noGroupAssignLater")}</option>
                  {groups.map((g) => (
                    <option key={g.registration_id || g.id} value={g.registration_id || g.id}>
                      {g.name} {g.program_id ? t("platformMisc.runs.programLabel", { id: g.program_id }) : ""}
                    </option>
                  ))}
                </select>
                {!showInlineGroup ? (
                  <button
                    type="button"
                    onClick={() => setShowInlineGroup(true)}
                    className="text-[9px] font-black uppercase text-[var(--brand-orange)] hover:opacity-80 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> {t("platformMisc.runs.newGroup")}
                  </button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <input
                      autoFocus
                      value={inlineGroupName}
                      onChange={(e) => setInlineGroupName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroupInline((grp) => setCreateData({ ...createData, group_id: grp.registration_id || grp.id })); }}
                      placeholder={t("platformMisc.runs.groupNamePlaceholder")}
                      className="flex-1 rounded-xl px-3 py-2 text-[11px] font-bold outline-none bg-primary border border-[var(--brand-orange)] text-[var(--text-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleCreateGroupInline((grp) => setCreateData({ ...createData, group_id: grp.registration_id || grp.id }))}
                      disabled={creatingGroup || !inlineGroupName.trim()}
                      className="px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase disabled:opacity-40"
                    >
                      {creatingGroup ? "..." : t("platformMisc.runs.create")}
                    </button>
                    <button type="button" onClick={() => { setShowInlineGroup(false); setInlineGroupName(""); }} className="p-2 text-[var(--text-secondary)] hover:text-rose-500"><X className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3"><button onClick={() => setShowCreate(false)} className="flex-1 btn btn-secondary">{t("platformMisc.runs.cancel")}</button><button onClick={handleCreate} disabled={saving || !createData.form_id || !createData.name.trim()} className="flex-1 btn btn-primary">{saving ? t("platformMisc.runs.creating") : t("platformMisc.runs.createRun")}</button></div>
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
  const { t } = useI18n();
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
        <h4 className="text-[10px] font-black uppercase text-[var(--text-primary)] flex items-center gap-1.5"><History className="w-3 h-3 text-[var(--brand-orange)]" /> {t("platformMisc.runs.submissionHistory", { name: submission.submitter_name || submission.submitter_id })}</h4>
        <button onClick={onClose}><X className="w-3.5 h-3.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" /></button>
      </div>
      <div className="p-4 max-h-64 overflow-y-auto">
        {/* Scoring Breakdown */}
        {scores && (
          <div className="mb-4 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.assessmentScore")}</p>
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
                      <span className="text-[var(--text-secondary)] text-[8px]">{t("platformMisc.runs.sectionRated", { count: sec.count, weight: sec.weight })}</span>
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
          <p className="text-[10px] text-[var(--text-secondary)] text-center py-4">{t("platformMisc.runs.noTimelineEntries")}</p>
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
                    {entry.actor_name && <span className="text-[var(--text-secondary)]"> {t("platformMisc.runs.by")} {entry.actor_name}</span>}
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
