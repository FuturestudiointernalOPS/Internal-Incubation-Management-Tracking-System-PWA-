"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Play, Plus, Search, Loader2, X, Send, Clock, Users, CheckCircle2,
  XCircle, FileText, RotateCcw, Eye, MessageSquare, Filter,
  ArrowLeft, Settings, Link2, Trash2, AlertTriangle, BarChart3,
  History, Calendar, Hash, Globe, EyeOff, ShieldAlert, PauseCircle,
  StopCircle, Archive, RefreshCw, ChevronDown, ChevronUp, ChevronRight, Info, Sparkles, Mail, Key, LogIn, Download,
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

// Email lifecycle statuses (Resend events) — success states are delivered/
// opened/clicked; failed/bounced/cancelled remain manually retryable.
const EMAIL_STATUS_CONFIG = {
  sent: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "platformMisc.runs.emailSent" },
  delivered: { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "platformMisc.runs.emailDelivered" },
  opened: { color: "text-sky-500", bg: "bg-sky-500/10", label: "platformMisc.runs.emailOpened" },
  clicked: { color: "text-indigo-500", bg: "bg-indigo-500/10", label: "platformMisc.runs.emailClicked" },
  delayed: { color: "text-amber-500", bg: "bg-amber-500/10", label: "platformMisc.runs.emailDelayed" },
  complained: { color: "text-rose-500", bg: "bg-rose-500/10", label: "platformMisc.runs.emailComplained" },
  failed: { color: "text-rose-500", bg: "bg-rose-500/10", label: "platformMisc.runs.emailFailed" },
  bounced: { color: "text-amber-500", bg: "bg-amber-500/10", label: "platformMisc.runs.emailBounced" },
  cancelled: { color: "text-slate-400", bg: "bg-slate-500/10", label: "platformMisc.runs.emailCancelled" },
  skipped: { color: "text-slate-500", bg: "bg-slate-500/10", label: "platformMisc.runs.emailSkipped" },
  pending: { color: "text-amber-500", bg: "bg-amber-500/10", label: "platformMisc.runs.emailPending" },
};

const EMAIL_STATUS_ORDER = ["sent", "delivered", "opened", "clicked", "delayed", "complained", "failed", "bounced", "cancelled", "skipped", "pending"];

const EMAIL_PAGE_SIZE = 25;

// Filter option lists for the Run Overview tracking columns.
const EMAIL_FILTER_OPTIONS = ["sent", "delivered", "opened", "clicked", "delayed", "bounced", "failed", "cancelled", "skipped", "pending", "not_sent"];
const REVIEW_FILTER_OPTIONS = ["approved", "rejected", "revision_requested"];
const STATUS_FILTER_OPTIONS = ["submitted", "approved", "rejected", "revision_requested", "draft"];
const ACCOUNT_STATUS_OPTIONS = ["active", "inactive", "activation_pending", "pending_approval", "archived", "deleted", "not_created"];
const ACCOUNT_STATUS_STYLES = {
  not_created: { cls: "bg-slate-500/10 text-slate-400", label: "platformMisc.runs.accountNotCreated", title: "platformMisc.runs.accountNotCreatedTitle" },
  pending_approval: { cls: "bg-orange-500/10 text-orange-400", label: "platformMisc.runs.accountPendingApproval", title: "platformMisc.runs.accountPendingApprovalTitle" },
  activation_pending: { cls: "bg-amber-500/10 text-amber-500", label: "platformMisc.runs.accountPendingActivation", title: "platformMisc.runs.accountPendingActivationTitle" },
  active: { cls: "bg-emerald-500/10 text-emerald-500", label: "platformMisc.runs.accountActivated", title: "platformMisc.runs.accountActivatedTitle" },
  inactive: { cls: "bg-rose-500/10 text-rose-400", label: "platformMisc.runs.accountInactive", title: "platformMisc.runs.accountInactiveTitle" },
  archived: { cls: "bg-slate-500/10 text-slate-400", label: "platformMisc.runs.accountArchived", title: "platformMisc.runs.accountArchivedTitle" },
  deleted: { cls: "bg-rose-500/10 text-rose-400", label: "platformMisc.runs.accountDeleted", title: "platformMisc.runs.accountDeletedTitle" },
};

const TARGET_LABELS = {
  user: "platformMisc.runs.targetUser", group: "platformMisc.runs.targetGroup", program: "platformMisc.runs.targetProgram", cohort: "platformMisc.runs.targetCohort",
  team: "platformMisc.runs.targetTeam", organization: "platformMisc.runs.targetOrganization", all: "platformMisc.runs.targetAll",
};

function cn(...classes) { return classes.filter(Boolean).join(" "); }

// ─── Optimized Runs Table (memoized for performance) ───
const RunsTable = React.memo(function RunsTable({ runs, search, statusFilter, sortField, sortDir, page, perPage, total, onSort, onPage, openRun, groups, onArchive, onRestore }) {
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

  const totalPages = Math.ceil(total / perPage);
  const paginated = sorted;

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
            <th className="px-3 py-3 text-right">{t("platformMisc.runs.colActions")}</th>
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
                <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  {r.status === "archived" ? (
                    <button onClick={() => onRestore(r.id)} title={t("platformMisc.runs.restore")} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"><RotateCcw className="w-3.5 h-3.5" /></button>
                  ) : r.status !== "active" ? (
                    <button onClick={() => onArchive(r.id)} title={t("platformMisc.runs.archive")} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-500/10 transition-colors"><Archive className="w-3.5 h-3.5" /></button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {totalPages > 1 && (
      <div className="flex items-center justify-between pt-2">
        <p className="text-[10px] text-[var(--text-secondary)]">{t("platformMisc.runs.showingRange", { start: ((page - 1) * perPage) + 1, end: Math.min(page * perPage, total), total })}</p>
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
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [totalRuns, setTotalRuns] = useState(0);

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
  const [assignTypes, setAssignTypes] = useState({ user: false, group: false, program: false, other: false });
  const [assignUserId, setAssignUserId] = useState("");
  const [assignGroupId, setAssignGroupId] = useState("");
  const [assignProgramId, setAssignProgramId] = useState("");
  const [assignOtherType, setAssignOtherType] = useState("cohort");
  const [assignOtherId, setAssignOtherId] = useState("");

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
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      const res = await fetch(`/api/platform/form-runs?${params}`);
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setRuns(data.runs || []);
        setTotalRuns(data.total || 0);
      } else {
        console.error("[runs] list error:", data.error || res.status);
        notify(t("platformMisc.runs.loadError", { error: data.error || res.status }));
      }
    } catch (e) {
      console.error("[runs] list fetch failed:", e);
      notify(t("platformMisc.runs.loadError", { error: e.message || "network" }));
    }
    setLoading(false);
  }, [statusFilter, page, perPage]);

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

  const fetchPrograms = useCallback(async () => {
    try {
      const res = await fetch("/api/pm/programs");
      const data = await res.json();
      if (data.success) setPrograms(data.programs || []);
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
        notify(t((data.error || t("platformMisc.runs.failedToCreateGroup")) || "") || (data.error || t("platformMisc.runs.failedToCreateGroup")));
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

  useEffect(() => { fetchRuns(); fetchForms(); fetchContacts(); fetchGroups(); fetchPrograms(); fetchDashboardStats(); }, [fetchRuns]);

  // Reset to the first page whenever the run status filter changes.
  useEffect(() => { setPage(1); }, [statusFilter]);

  const openRun = useCallback(async (run, opts = {}) => {
    if (!opts.keepTab) {
      setDetailTab("overview");
      setSubFilter("all");
    }
    setSelectedRun(run);
    setSubLoading(true);
    try {
      const res = await fetch(`/api/platform/form-runs?id=${run.id}`);
      const data = await res.json();
      if (data.success) {
        setSubmissions(data.submissions || []);
        setReviews(data.reviews || []);
        setAssignments(data.assignments || []);
        setRunSettings(data.run.settings || {});
        setEvaluations(data.evaluations || []);
        setEmailLog(data.emails || []);
        setRunTemplates(data.run?.settings?.templates || {});
        setFieldLabels(data.field_labels || {});
        setFilterableFields(data.filterable_fields || []);
        if (!opts.keepTab) {
          // Fresh run → reset search/filters so nothing leaks across runs
          setRespSearch("");
          setScoreOp("");
          setScoreVal("");
          setScoreVal2("");
          setFieldFilters({});
          setApprovalEmailFilter("");
          setActivationEmailFilter("");
          setReviewFilter("");
          setAccountStatusFilter("");
          setRespPage(1);
          setSelectedIds([]);
          setShowDuplicates(false);
          setFilterPickerOpen(false);
          setFilterPickerMode(null);
          setBulkSummary(null);
          setBulkMenuOpen(false);
          setBulkConfirmOpen(false);
          setRetrySelected([]);
          setRetrySummary(null);
        }
      }

      // Fetch form fields for spreadsheet column view
      try {
        const formRes = await fetch(`/api/platform/forms?id=${run.form_id}`);
        const formData = await formRes.json();
        if (formData.success) {
          setRunFormFields((formData.fields || []).filter(f => !["hidden"].includes(f.field_type)));
          setRunFormSettings(formData.form?.settings || {});
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

  const handleArchiveRun = async (id) => {
    if (!confirm(t("platformMisc.runs.archiveRunConfirm"))) return;
    try {
      const res = await fetch("/api/platform/form-runs?action=status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "archived" }),
      });
      const data = await res.json();
      if (data.success) {
        notify(t("platformMisc.runs.runStatusChanged", { status: "archived" }));
        fetchRuns();
      }
    } catch (_) {}
  };

  const handleRestoreRun = async (id) => {
    if (!confirm(t("platformMisc.runs.restoreRunConfirm"))) return;
    try {
      const res = await fetch("/api/platform/form-runs?action=status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "draft" }),
      });
      const data = await res.json();
      if (data.success) {
        notify(t("platformMisc.runs.runStatusChanged", { status: "draft" }));
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
        notify(t((data.error || t("platformMisc.runs.reviewFailed")) || "") || (data.error || t("platformMisc.runs.reviewFailed")));
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
        notify(t((data.error || t("platformMisc.runs.reevaluationFailed")) || "") || (data.error || t("platformMisc.runs.reevaluationFailed")));
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

  const resetAssignModal = () => {
    setAssignTypes({ user: false, group: false, program: false, other: false });
    setAssignUserId("");
    setAssignGroupId("");
    setAssignProgramId("");
    setAssignOtherId("");
    setAssignOtherType("cohort");
  };

  const toggleAssignType = (type) => setAssignTypes((prev) => ({ ...prev, [type]: !prev[type] }));

  const handleAssignWithGroup = (grp) => {
    setAssignGroupId(grp.registration_id || grp.id);
    setAssignTypes((prev) => ({ ...prev, group: true }));
    handleAssign();
  };

  const handleAssign = async () => {
    if (!selectedRun) return;

    const targets = [];
    if (assignTypes.user && assignUserId) targets.push({ target_type: "user", target_id: assignUserId });
    if (assignTypes.group && assignGroupId) targets.push({ target_type: "group", target_id: assignGroupId });
    if (assignTypes.program && assignProgramId) targets.push({ target_type: "program", target_id: assignProgramId });
    if (assignTypes.other && assignOtherId.trim()) targets.push({ target_type: assignOtherType, target_id: assignOtherId.trim() });

    const checkedTypes = Object.keys(assignTypes).filter((k) => assignTypes[k]);
    if (checkedTypes.length === 0) {
      notify(t("platformMisc.runs.assignErrorNoTargets"));
      return;
    }
    const missing = checkedTypes.find((k) =>
      k === "user" ? !assignUserId : k === "group" ? !assignGroupId : k === "program" ? !assignProgramId : !assignOtherId.trim(),
    );
    if (missing) {
      const typeLabel =
        missing === "user" ? t("platformMisc.runs.targetUser")
        : missing === "group" ? t("platformMisc.runs.targetGroup")
        : missing === "program" ? t("platformMisc.runs.targetProgram")
        : t("platformMisc.runs.targetId");
      notify(t("platformMisc.runs.assignErrorMissing", { type: typeLabel }));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/platform/form-runs?action=assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: selectedRun.id, targets }),
      });
      let data = null;
      try { data = await res.json(); } catch (_) { data = null; }
      if (data && data.success) {
        setAssignments(data.assignments || []);
        const added = data.added ?? targets.length;
        const skipped = data.skipped ?? 0;
        if (added > 0 && skipped > 0) notify(t("platformMisc.runs.assignmentsAddedWithSkipped", { added, skipped }));
        else if (added > 0) notify(t("platformMisc.runs.assignmentsAdded", { count: added }));
        else notify(t("platformMisc.runs.assignmentsSkipped", { count: skipped }));
        setShowAssign(false);
        setShowInlineGroup(false);
        setInlineGroupName("");
        resetAssignModal();
      } else {
        notify(t((data?.error || t("platformMisc.runs.assignFailed")) || "") || (data?.error || t("platformMisc.runs.assignFailed")));
      }
    } catch (_) {
      notify(t("platformMisc.runs.assignFailed"));
    }
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
        notify(t((data.error || t("platformMisc.runs.deleteFailed")) || "") || (data.error || t("platformMisc.runs.deleteFailed")));
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
  const [evaluations, setEvaluations] = useState([]); // AI evaluation rows for the open run
  const [emailLog, setEmailLog] = useState([]); // email delivery log for the open run
  const [runTemplates, setRunTemplates] = useState({}); // run-level email template overrides
  const [runFormSettings, setRunFormSettings] = useState({}); // form settings (for template fallback + AI base)
  const [runTplSaving, setRunTplSaving] = useState(false);
  const [runPersonalizing, setRunPersonalizing] = useState(null); // template key while AI writes

  // Run-scoped respondent search + filters (operate only on THIS run's submissions)
  const [respSearch, setRespSearch] = useState("");
  const [scoreOp, setScoreOp] = useState(""); // "" | "eq" | "gte" | "gt" | "lte" | "lt" | "between"
  const [scoreVal, setScoreVal] = useState("");
  const [scoreVal2, setScoreVal2] = useState("");
  const [fieldFilters, setFieldFilters] = useState({}); // field label → option value
  const [approvalEmailFilter, setApprovalEmailFilter] = useState("");
  const [activationEmailFilter, setActivationEmailFilter] = useState("");
  const [reviewFilter, setReviewFilter] = useState("");
  const [accountStatusFilter, setAccountStatusFilter] = useState("");
  const [fieldLabels, setFieldLabels] = useState({}); // field id → label (from the run's form)
  const [filterableFields, setFilterableFields] = useState([]); // form fields that carry options
  const [respPage, setRespPage] = useState(1); // respondent table pagination
  const [showDuplicates, setShowDuplicates] = useState(false); // duplicates-only view
  const [filterPickerOpen, setFilterPickerOpen] = useState(false); // Add Filter dropdown
  const [filterPickerMode, setFilterPickerMode] = useState(null); // null | "score" | { type: "field", label }
  const filterRowRef = useRef(null); // closes the picker when clicking outside
  const [selectedIds, setSelectedIds] = useState([]); // bulk-selected respondent ids
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false); // bulk Actions dropdown
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false); // confirm dialog
  const [bulkProcessing, setBulkProcessing] = useState(false); // bulk op running
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkSummary, setBulkSummary] = useState(null); // { approved, already_approved, failed[] }
  const bulkAbortRef = useRef(false); // stops issuing new bulk batches when true
  const [retrySelected, setRetrySelected] = useState([]); // "submissionId:emailType" keys
  const [retryProcessing, setRetryProcessing] = useState(false);
  const [retryProgress, setRetryProgress] = useState({ done: 0, total: 0 });
  const [retrySummary, setRetrySummary] = useState(null); // { sent, already_sent, failed[] }
  const retryAbortRef = useRef(false); // stops issuing new retry batches when true
  const [activationConfirmOpen, setActivationConfirmOpen] = useState(false);
  const [activationForceResend, setActivationForceResend] = useState(false);
  const [activationProcessing, setActivationProcessing] = useState(false);
  const [activationProgress, setActivationProgress] = useState({ done: 0, total: 0 });

  // Manual message composer (Room Overview → selected participants)
  const [showMessageComposer, setShowMessageComposer] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageResult, setMessageResult] = useState(null); // { recipients, sent, failed }
  const [messageSummary, setMessageSummary] = useState(null); // { title, sent, skipped }
  const [aiPersonalizing, setAiPersonalizing] = useState(false);

  // Manual add respondent (super admin injects a test person into a run)
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualAddName, setManualAddName] = useState("");
  const [manualAddEmail, setManualAddEmail] = useState("");
  const [manualAdding, setManualAdding] = useState(false);
  // Manual message composer (Room Overview → selected participants)
  // Export options (format + scope)
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv"); // csv | xlsx
  const [exportScope, setExportScope] = useState("filtered"); // selected | filtered

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
        notify(t((data.error || t("platformMisc.runs.evalStopped")) || "") || (data.error || t("platformMisc.runs.evalStopped")));
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

  // ─── RUN-SCOPED FILTERING (Overview) ───
  // Runs against ONLY this run's submissions + their AI evaluations.
  const fmtAnswer = (v) => {
    if (v === undefined || v === null) return "";
    if (Array.isArray(v)) {
      return v.map((item) => {
        if (item === undefined || item === null) return "";
        if (typeof item === "object") return item.label || item.value || JSON.stringify(item);
        return String(item);
      }).filter(Boolean).join(", ");
    }
    if (typeof v === "string") {
      try {
        if (v.startsWith("{") && v.includes('"code"')) {
          const p = JSON.parse(v);
          if (p.code != null) return `${p.code} ${p.number || ""}`.trim();
        }
      } catch (_) {}
      return v;
    }
    if (typeof v === "object") {
      if (v.label) return String(v.label);
      if (v.value) return String(v.value);
      return JSON.stringify(v);
    }
    return String(v);
  };

  const submissionAnswers = (s) => {
    const d = s.data || {};
    const answers = {};
    for (const [key, value] of Object.entries(d)) {
      if (key.startsWith("_")) continue;
      answers[fieldLabels[key] || key] = fmtAnswer(value);
    }
    return answers;
  };

  const latestEmailOf = (s, type) =>
    emailLog
      .filter((e) => e.submission_id === s.id && e.email_type === type)
      .slice(-1)[0] || null;
  const latestReviewOf = (s) => {
    const rs = reviews.filter((r) => r.submission_id === s.id);
    return rs[rs.length - 1] || null;
  };
  const emailStatusOf = (s, type) => {
    const e = latestEmailOf(s, type);
    return e ? e.status : "not_sent";
  };
  const accountStatusOf = (s) =>
    s.account_status || (s.account_activated ? "active" : s.account_created ? "activation_pending" : "not_created");

  const filteredSubmissions = useMemo(() => {
    if (!selectedRun) return [];
    const q = respSearch.trim().toLowerCase();
    const v1 = parseFloat(scoreVal);
    const v2 = parseFloat(scoreVal2);
    const hasScore = !!scoreOp && !isNaN(v1);
    const scorePass = (score) => {
      if (!hasScore) return true;
      switch (scoreOp) {
        case "eq": return score === v1;
        case "gte": return score >= v1;
        case "gt": return score > v1;
        case "lte": return score <= v1;
        case "lt": return score < v1;
        case "between": return !isNaN(v2) ? score >= v1 && score <= v2 : score >= v1;
        default: return true;
      }
    };
    const activeFieldFilters = Object.entries(fieldFilters).filter(([, v]) => v);

    return submissions.filter((s) => {
      if (subFilter !== "all" && s.status !== subFilter) return false;

      if (approvalEmailFilter && emailStatusOf(s, "approval") !== approvalEmailFilter) return false;
      if (activationEmailFilter && emailStatusOf(s, "activation") !== activationEmailFilter) return false;
      if (reviewFilter) {
        const r = latestReviewOf(s);
        const decision = r ? r.decision : "none";
        if (decision !== reviewFilter) return false;
      }
      if (accountStatusFilter && accountStatusOf(s) !== accountStatusFilter) return false;

      if (q) {
        const hay = [
          s.submitter_name || "",
          s.email || "",
          ...Object.values(submissionAnswers(s)),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (hasScore) {
        const evalRow = evaluations.find((e) => e.submission_id === s.id);
        const score = evalRow != null ? Number(evalRow.overall_score) : null;
        if (score == null || isNaN(score) || !scorePass(score)) return false;
      }

      if (activeFieldFilters.length > 0) {
        const answers = submissionAnswers(s);
        for (const [label, val] of activeFieldFilters) {
          const actual = String(answers[label] ?? "").trim().toLowerCase();
          if (actual !== String(val).trim().toLowerCase()) return false;
        }
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRun, submissions, evaluations, emailLog, reviews, subFilter, respSearch, scoreOp, scoreVal, scoreVal2, fieldFilters, fieldLabels, approvalEmailFilter, activationEmailFilter, reviewFilter, accountStatusFilter]);

  const hasRunFilters = !!(
    respSearch.trim() ||
    (scoreOp && scoreVal !== "") ||
    Object.values(fieldFilters).some(Boolean) ||
    approvalEmailFilter ||
    activationEmailFilter ||
    reviewFilter ||
    accountStatusFilter
  );

  // Any search/filter change returns the respondent table to page 1 AND
  // clears the selection — hidden selections must never be bulk-approved.
  useEffect(() => {
    setRespPage(1);
    setSelectedIds([]);
    setShowDuplicates(false);
  }, [respSearch, scoreOp, scoreVal, scoreVal2, fieldFilters, subFilter, approvalEmailFilter, activationEmailFilter, reviewFilter, accountStatusFilter]);

  const clearRunFilters = () => {
    setRespSearch("");
    setScoreOp("");
    setScoreVal("");
    setScoreVal2("");
    setFieldFilters({});
    setApprovalEmailFilter("");
    setActivationEmailFilter("");
    setReviewFilter("");
    setAccountStatusFilter("");
    setRespPage(1);
    setSelectedIds([]);
    setFilterPickerOpen(false);
    setFilterPickerMode(null);
  };

  // ─── Filter chips (presentation only — the underlying filter state is the
  // same scoreOp/scoreVal/fieldFilters the filtering logic already uses) ───
  const SCORE_OPS = { eq: "=", gt: ">", gte: "≥", lt: "<", lte: "≤" };
  const scoreChipActive = !!scoreOp && scoreVal !== "";
  const scoreChipLabel = scoreChipActive
    ? scoreOp === "between"
      ? `${t("platformMisc.runs.colAiScore")}: ${scoreVal}–${scoreVal2 || "?"}%`
      : `${t("platformMisc.runs.colAiScore")}: ${SCORE_OPS[scoreOp] || ""} ${scoreVal}%`
    : "";
  const activeFieldFilters = Object.entries(fieldFilters).filter(([, v]) => v);

  // Tracking filters (Approval Email / Review / Status / Activation Email /
  // Account Status) — same pattern as field filters, but backed by fixed
  // option lists and the tracking filter state.
  const TRACKING_FILTERS = [
    { key: "approval_email", label: "Approval Email" },
    { key: "review", label: "Review" },
    { key: "status", label: "Status" },
    { key: "activation_email", label: "Activation Email" },
    { key: "account_status", label: "Account Status" },
  ];
  const trackingFilterValue = (key) => {
    if (key === "approval_email") return approvalEmailFilter;
    if (key === "review") return reviewFilter;
    if (key === "status") return subFilter === "all" ? "" : subFilter;
    if (key === "activation_email") return activationEmailFilter;
    if (key === "account_status") return accountStatusFilter;
    return "";
  };
  const setTrackingFilter = (key, value) => {
    if (key === "approval_email") setApprovalEmailFilter(value);
    else if (key === "review") setReviewFilter(value);
    else if (key === "status") setSubFilter(value || "all");
    else if (key === "activation_email") setActivationEmailFilter(value);
    else if (key === "account_status") setAccountStatusFilter(value);
  };
  const trackingFilterOptions = (key) => {
    if (key === "approval_email" || key === "activation_email") return EMAIL_FILTER_OPTIONS;
    if (key === "review") return REVIEW_FILTER_OPTIONS;
    if (key === "status") return STATUS_FILTER_OPTIONS;
    if (key === "account_status") return ACCOUNT_STATUS_OPTIONS;
    return [];
  };
  const trackingFilterOptionLabel = (key, val) => {
    if (key === "account_status") {
      const cfg = ACCOUNT_STATUS_STYLES[val];
      return cfg ? t(cfg.label) : val;
    }
    if (key === "approval_email" || key === "activation_email") {
      if (val === "not_sent") return t("platformMisc.runs.emailNotSent");
      return EMAIL_STATUS_CONFIG[val] ? t(EMAIL_STATUS_CONFIG[val].label) : val;
    }
    return SUB_STATUS[val] ? t(SUB_STATUS[val].label) : val;
  };
  const activeTrackingFilters = TRACKING_FILTERS
    .map((f) => ({ key: f.key, label: f.label, value: trackingFilterValue(f.key) }))
    .filter((f) => f.value);

  const availableParams = [
    ...(scoreChipActive ? [] : [{ key: "score", label: t("platformMisc.runs.colAiScore") }]),
    ...TRACKING_FILTERS
      .filter((f) => !trackingFilterValue(f.key))
      .map((f) => ({ key: f.key, label: f.label })),
    ...filterableFields
      .filter((f) => !fieldFilters[f.label])
      .map((f) => ({ key: `field:${f.label}`, label: f.label })),
  ];
  const fieldOptionsOf = (label) => filterableFields.find((f) => f.label === label)?.options || [];

  const removeFieldFilter = (label) =>
    setFieldFilters((prev) => {
      const next = { ...prev };
      delete next[label];
      return next;
    });

  const clearScoreFilter = () => {
    setScoreOp("");
    setScoreVal("");
    setScoreVal2("");
  };

  // Clicking anywhere outside the filter row closes the Add Filter dropdown
  // and any open inline editor automatically.
  useEffect(() => {
    if (!filterPickerOpen && !filterPickerMode) return;
    const onDown = (e) => {
      if (filterRowRef.current && !filterRowRef.current.contains(e.target)) {
        setFilterPickerOpen(false);
        setFilterPickerMode(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filterPickerOpen, filterPickerMode]);

  const pickFilterParam = (p) => {
    setFilterPickerOpen(false);
    if (p.key === "score") setFilterPickerMode("score");
    else if (p.key.startsWith("field:")) setFilterPickerMode({ type: "field", label: p.label });
    else setFilterPickerMode({ type: "status", key: p.key });
  };

  // ─── Duplicate detection: same resolved email appearing multiple times ───
  // The keeper (highest AI score) is marked; the rest are duplicates. After
  // evaluation, only the keeper should receive approval/activation emails.
  const duplicateGroups = useMemo(() => {
    const byEmail = new Map();
    for (const s of submissions) {
      const key = (s.email || "").trim().toLowerCase();
      if (!key || !key.includes("@")) continue;
      if (!byEmail.has(key)) byEmail.set(key, []);
      byEmail.get(key).push(s);
    }
    const groups = [...byEmail.values()].filter((g) => g.length > 1);
    const keeperIds = new Set();
    for (const g of groups) {
      let best = null;
      let bestScore = NaN;
      for (const s of g) {
        const ev = evaluations.find((e) => e.submission_id === s.id);
        const sc = ev != null ? Number(ev.overall_score) : NaN;
        if (!isNaN(sc) && (isNaN(bestScore) || sc > bestScore)) {
          best = s;
          bestScore = sc;
        }
      }
      if (best) keeperIds.add(best.id);
    }
    const extra = groups.reduce((n, g) => n + g.length - 1, 0);
    return { groups, keeperIds, extra };
  }, [submissions, evaluations]);

  const duplicateEmailSet = useMemo(() => {
    const set = new Set();
    for (const g of duplicateGroups.groups) {
      for (const s of g) set.add((s.email || "").trim().toLowerCase());
    }
    return set;
  }, [duplicateGroups]);

  // What the table actually displays: the filtered set, or only duplicates
  // when the duplicates view is active.
  const visibleSubmissions = useMemo(
    () =>
      showDuplicates
        ? filteredSubmissions.filter((s) => duplicateEmailSet.has((s.email || "").trim().toLowerCase()))
        : filteredSubmissions,
    [filteredSubmissions, showDuplicates, duplicateEmailSet]
  );

  // ─── Respondent table pagination (perPage rows per page) ───
  const respTotalPages = Math.max(1, Math.ceil(visibleSubmissions.length / perPage));
  const respSafePage = Math.min(respPage, respTotalPages);
  const pagedSubmissions = visibleSubmissions.slice(
    (respSafePage - 1) * perPage,
    respSafePage * perPage
  );

  // ─── Bulk selection (respects the CURRENT filters; Select All = all filtered, across pages) ───
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allFilteredSelected =
    visibleSubmissions.length > 0 && visibleSubmissions.every((s) => selectedSet.has(s.id));

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds(allFilteredSelected ? [] : visibleSubmissions.map((s) => s.id));
  };

  // Bulk approve: batches of 10 through the SAME review workflow as a single
  // approval (server-side action=bulk_review → processReviewInternal).
  const BULK_BATCH = 10;
  const runBulkApprove = async () => {
    if (!selectedRun || selectedIds.length === 0 || bulkProcessing) return;
    setBulkProcessing(true);
    setBulkConfirmOpen(false);
    bulkAbortRef.current = false;
    const ids = [...selectedIds];
    const agg = { approved: 0, already_approved: 0, failed: [], cancelled: 0 };
    setBulkProgress({ done: 0, total: ids.length });
    let aborted = false;
    let processed = 0;
    for (let i = 0; i < ids.length && !aborted && !bulkAbortRef.current; i += BULK_BATCH) {
      const chunk = ids.slice(i, i + BULK_BATCH);
      let data;
      try {
        const res = await fetch("/api/platform/form-runs?action=bulk_review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: selectedRun.id, submission_ids: chunk, decision: "approved" }),
        });
        data = await res.json();
      } catch (_) {
        aborted = true;
        agg.failed.push({ name: t("platformMisc.runs.batchLabel", { count: Math.floor(i / BULK_BATCH) + 1 }), error: t("platformMisc.runs.bulkNetworkError") });
        break;
      }
      if (!data.success) {
        aborted = true;
        agg.failed.push({ name: t("platformMisc.runs.batchFallback"), error: data.error || t("platformMisc.runs.bulkFailedError") });
        break;
      }
      for (const r of data.results || []) {
        if (r.status === "approved") agg.approved++;
        else if (r.status === "already_approved") agg.already_approved++;
        else agg.failed.push({ name: r.name || `#${r.submission_id}`, error: r.error || t("platformMisc.runs.failedFallback") });
      }
      processed = Math.min(i + BULK_BATCH, ids.length);
      setBulkProgress({ done: processed, total: ids.length });
    }
    // Anything not yet processed when the user cancels (or a batch fails) is
    // reported as cancelled — nothing was sent for those rows, and they stay
    // in their previous state so they can be selected again later.
    agg.cancelled = ids.length - processed;
    // Record the unprocessed remainder as CANCELLED so history keeps
    // sent / failed / cancelled distinct and those rows stay retryable later.
    const unprocessedIds = ids.slice(processed);
    if (unprocessedIds.length > 0 && selectedRun) {
      try {
        await fetch("/api/platform/form-runs?action=mark_email_cancelled", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            run_id: selectedRun.id,
            items: unprocessedIds.map((sid) => ({ submission_id: sid, email_type: "approval" })),
          }),
        });
      } catch (_) {}
    }
    setBulkProcessing(false);
    setSelectedIds([]);
    if (selectedRun) await openRun(selectedRun);
    setBulkSummary(agg);
  };

  // ─── Email delivery summary: latest row per (submission, email_type) ───
  const emailSummary = useMemo(() => {
    const latest = new Map();
    for (const e of emailLog) latest.set(`${e.submission_id}:${e.email_type}`, e);
    const empty = () => ({ sent: 0, delivered: 0, opened: 0, clicked: 0, delayed: 0, complained: 0, failed: 0, bounced: 0, cancelled: 0, skipped: 0, pending: 0 });
    const stats = { approval: empty(), activation: empty() };
    const notDelivered = [];
    for (const e of latest.values()) {
      const bucket = e.email_type === "activation" ? stats.activation : stats.approval;
      const status = e.status;
      if (status === "sent") bucket.sent++;
      else if (["delivered", "opened", "clicked"].includes(status)) bucket[status]++;
      else if (status === "delayed") bucket.delayed++;
      else if (status === "complained") bucket.complained++;
      else if (["failed", "bounced", "cancelled", "pending"].includes(status)) {
        bucket[status]++;
        notDelivered.push(e);
      } else if (status === "skipped") bucket.skipped++;
    }
    return { stats, notDelivered };
  }, [emailLog]);

  // All email rows (latest per submission:email_type) enriched with the
  // respondent's resolved name + recipient.
  const allEmailRows = useMemo(() => {
    const latest = new Map();
    for (const e of emailLog) latest.set(`${e.submission_id}:${e.email_type}`, e);
    return [...latest.values()].map((e) => {
      const sub = submissions.find((s) => s.id === e.submission_id);
      return {
        ...e,
        name: sub?.display_name || sub?.submitter_name || `#${e.submission_id}`,
        email: e.recipient || sub?.email || "",
      };
    });
  }, [emailLog, submissions]);

  // Only these statuses are selectable for manual retry.
  const RETRYABLE_EMAIL_STATUSES = ["failed", "bounced", "cancelled", "pending"];

  const [emailStatusFilter, setEmailStatusFilter] = useState("all");
  const [emailDateFrom, setEmailDateFrom] = useState("");
  const [emailDateTo, setEmailDateTo] = useState("");
  const [emailSearch, setEmailSearch] = useState("");
  const [emailTypeFilter, setEmailTypeFilter] = useState("all"); // all | approval | activation
  const [emailPage, setEmailPage] = useState(1);

  const visibleEmailRows = useMemo(() => {
    return allEmailRows.filter((r) => {
      if (emailTypeFilter !== "all" && r.email_type !== emailTypeFilter) return false;
      if (emailStatusFilter !== "all" && r.status !== emailStatusFilter) return false;
      if (emailSearch) {
        const q = emailSearch.toLowerCase();
        const hay = `${r.name || ""} ${r.email || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const ts = r.sent_at || r.created_at;
      if (ts) {
        const d = new Date(ts);
        if (emailDateFrom && d < new Date(emailDateFrom + "T00:00:00")) return false;
        if (emailDateTo && d > new Date(emailDateTo + "T23:59:59")) return false;
      }
      return true;
    });
  }, [allEmailRows, emailTypeFilter, emailStatusFilter, emailSearch, emailDateFrom, emailDateTo]);

  const retryableVisible = useMemo(
    () => visibleEmailRows.filter((f) => RETRYABLE_EMAIL_STATUSES.includes(f.status)),
    [visibleEmailRows]
  );

  // All lifecycle statuses ever recorded per (submission, email_type) — used
  // to render delivery milestones (sent / delivered / opened / clicked) per
  // email from the appended Resend event rows.
  const emailStatusSets = useMemo(() => {
    const map = new Map();
    for (const e of emailLog) {
      const key = `${e.submission_id}:${e.email_type}`;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(e.status);
    }
    return map;
  }, [emailLog]);

  const emailTotalPages = Math.max(1, Math.ceil(visibleEmailRows.length / EMAIL_PAGE_SIZE));
  const safeEmailPage = Math.min(emailPage, emailTotalPages);
  const pagedEmailRows = visibleEmailRows.slice((safeEmailPage - 1) * EMAIL_PAGE_SIZE, safeEmailPage * EMAIL_PAGE_SIZE);

  const retrySelectedSet = useMemo(() => new Set(retrySelected), [retrySelected]);
  const toggleRetrySelect = (key) =>
    setRetrySelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  // ─── Export (shared dataset: Overview = Messaging = Export) ───
  // Always one row per participant. Each form question becomes a COLUMN;
  // answers stay in the participant's row. No joins/arrays/events may ever
  // duplicate a participant.
  const buildExportRows = (subs) => {
    const seen = new Set();
    const unique = subs.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    // Form questions as ordered columns (hidden fields already excluded).
    // Fall back to fieldLabels when the field list has not loaded yet.
    const questionFields = runFormFields.length > 0
      ? runFormFields.map((f) => ({ id: String(f.id), label: f.label }))
      : Object.entries(fieldLabels)
          .filter(([, label]) => label)
          .map(([id, label]) => ({ id, label }));

    const headers = [
      t("platformMisc.runs.colSn"),
      t("platformMisc.runs.colName"),
      t("platformMisc.runs.colEmail"),
      ...questionFields.map((q) => q.label),
      t("platformMisc.runs.colAiScore"),
      t("platformMisc.runs.colApprovalEmail"),
      t("platformMisc.runs.colActivationEmail"),
      t("platformMisc.runs.colAccountStatus"),
    ];

    const rows = unique.map((s, i) => {
      const evalRow = evaluations.find((e) => e.submission_id === s.id);
      const activationEmail = emailLog
        .filter((e) => e.submission_id === s.id && e.email_type === "activation")
        .slice(-1)[0];
      const approvalEmail = emailLog
        .filter((e) => e.submission_id === s.id && e.email_type === "approval")
        .slice(-1)[0];
      const accountStatus = s.account_status || (s.account_activated
        ? "active"
        : s.account_created
          ? "activation_pending"
          : "not_created");
      const answers = submissionAnswers(s);
      const cells = [
        i + 1,
        s.display_name || s.submitter_name || s.submitter_id,
        s.email || "",
      ];
      for (const q of questionFields) cells.push(answers[q.label] ?? "");
      cells.push(
        evalRow != null ? evalRow.overall_score : (s.data?._scores?.overall ?? ""),
        approvalEmail ? approvalEmail.status : "",
        activationEmail ? activationEmail.status : "",
        accountStatus,
      );
      return cells;
    });
    return { headers, rows };
  };

  const exportParticipants = async (format, scope) => {
    const source = scope === "selected"
      ? visibleSubmissions.filter((s) => selectedSet.has(s.id))
      : visibleSubmissions;
    if (!source.length) return;

    const { headers, rows } = buildExportRows(source);
    const baseName = `${selectedRun?.name || "run"}-participants`;

    if (format === "xlsx") {
      try {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Participants");
        XLSX.writeFile(wb, `${baseName}.xlsx`);
      } catch (_) {
        notify("Excel export failed");
      }
    } else {
      const esc = (v) => {
        const s = v == null ? "" : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const csv = "\uFEFF" + [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setShowExportOptions(false);
  };

  // ─── Manual message (Room Overview → selected participants) ───
  const openMessageComposer = () => {
    setMessageSubject("");
    setMessageBody("");
    setMessageResult(null);
    setBulkMenuOpen(false);
    setShowMessageComposer(true);
  };

  // ─── Manual add respondent (super admin injects a test person) ───
  const openManualAdd = () => {
    setManualAddName("");
    setManualAddEmail("");
    setBulkMenuOpen(false);
    setShowManualAdd(true);
  };

  const submitManualAdd = async () => {
    if (!selectedRun || manualAdding) return;
    if (!manualAddName.trim() && !manualAddEmail.trim()) {
      notify(t("platformMisc.runs.manualAddNameOrEmailRequired"));
      return;
    }
    setManualAdding(true);
    try {
      const res = await fetch("/api/platform/form-runs?action=manual_add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: selectedRun.id,
          name: manualAddName.trim(),
          email: manualAddEmail.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify(t("platformMisc.runs.manualAddSuccess"));
        setShowManualAdd(false);
        setManualAddName("");
        setManualAddEmail("");
        if (selectedRun) await openRun(selectedRun, { keepTab: true });
      } else {
        notify(data.error || t("platformMisc.runs.manualAddFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.runs.manualAddFailed"));
    }
    setManualAdding(false);
  };

  const personalizeMessage = async () => {
    setAiPersonalizing(true);
    try {
      const res = await fetch("/api/platform/ai/personalize-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_key: "manual",
          existing_subject: messageSubject,
          existing_body: messageBody,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.subject) setMessageSubject(data.subject);
        if (data.body) setMessageBody(data.body);
        notify(t("platformMisc.runs.aiPersonalized"));
      } else {
        notify(data.error || t("platformMisc.runs.personalizeFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.runs.personalizeFailed"));
    }
    setAiPersonalizing(false);
  };

  const sendManualMessages = async () => {
    if (!selectedRun || selectedIds.length === 0 || messageSending) return;
    if (!messageSubject.trim() || !messageBody.trim()) {
      notify(t("platformMisc.runs.messageSubjectBodyRequired"));
      return;
    }
    setMessageSending(true);
    setMessageResult(null);
    try {
      const res = await fetch("/api/platform/form-runs?action=send_manual_message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: selectedRun.id,
          submission_ids: selectedIds,
          subject: messageSubject,
          body: messageBody,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessageResult(data);
      } else {
        notify(data.error || t("platformMisc.runs.messageSendFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.runs.messageSendFailed"));
    }
    setMessageSending(false);
  };

  // Activation history per submission (real email log — the ONLY source of truth
  // for "was the activation email ever sent?" — never derived from account status).
  const activationLogBySubmission = useMemo(() => {
    const map = new Map();
    for (const e of emailLog) {
      if (e.email_type !== "activation") continue;
      if (!map.has(e.submission_id)) map.set(e.submission_id, []);
      map.get(e.submission_id).push(e);
    }
    return map;
  }, [emailLog]);

  const hasActivationEmailSent = (id) => {
    // Full-history truth from the API enrichment (sent rows only) takes
    // priority; the client email log carries only the latest row per type.
    const s = submissions.find((x) => x.id === id);
    if (s?.activation_history?.first_sent_at) return true;
    const rows = activationLogBySubmission.get(id) || [];
    return rows.some((r) => r.status === "sent");
  };

  // FIRST send: approved + activation email never sent yet
  const eligibleSendActivationIds = useMemo(() => {
    return selectedIds.filter((id) => {
      const s = submissions.find((x) => x.id === id);
      if (!s || String(s.status || "").toLowerCase() !== "approved") return false;
      return !hasActivationEmailSent(id);
    });
  }, [selectedIds, submissions, activationLogBySubmission]);

  // RESEND: approved + activation email already sent at least once
  const eligibleResendActivationIds = useMemo(() => {
    return selectedIds.filter((id) => {
      const s = submissions.find((x) => x.id === id);
      if (!s || String(s.status || "").toLowerCase() !== "approved") return false;
      return hasActivationEmailSent(id);
    });
  }, [selectedIds, submissions, activationLogBySubmission]);

  const openActivationConfirm = (forceResend = false) => {
    setBulkMenuOpen(false);
    const ids = forceResend ? eligibleResendActivationIds : eligibleSendActivationIds;
    if (ids.length === 0) {
      // State-aware messaging: the empty list means different things for
      // Send vs Resend, and the message must never claim an email was
      // "already sent" when it was not (or vice versa).
      if (!forceResend && eligibleResendActivationIds.length > 0) {
        notify(t("platformMisc.runs.noEligibleSendAlreadySent"));
      } else if (forceResend && eligibleSendActivationIds.length > 0) {
        notify(t("platformMisc.runs.noEligibleResendNotSentYet"));
      } else {
        notify(t(forceResend ? "platformMisc.runs.noEligibleResendNone" : "platformMisc.runs.noEligibleSendNone"));
      }
      return;
    }
    setActivationForceResend(forceResend);
    setActivationConfirmOpen(true);
  };

  const runSendActivationMessages = async () => {
    const targetIds = activationForceResend ? eligibleResendActivationIds : eligibleSendActivationIds;
    if (!selectedRun || targetIds.length === 0 || activationProcessing) return;
    setActivationConfirmOpen(false);
    setActivationProcessing(true);
    const forceResend = activationForceResend;
    const CHUNK = 30;
    const ids = [...targetIds];
    const agg = { sent: 0, already_sent: 0, skipped: 0, failed: 0, total: ids.length };
    setActivationProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const res = await fetch("/api/platform/form-runs?action=send_activation_messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: selectedRun.id, submission_ids: chunk, force: forceResend }),
        });
        const data = await res.json();
        if (!data.success) {
          notify(data.error || t("platformMisc.runs.messageSendFailed"));
          break;
        }
        for (const r of data.results || []) {
          if (r.status === "sent") agg.sent++;
          else if (r.status === "already_sent") agg.already_sent++;
          else if (r.status === "failed" || r.status === "not_found") agg.failed++;
          else agg.skipped++;
        }
        setActivationProgress({ done: Math.min(i + CHUNK, ids.length), total: ids.length });
      }
      setMessageSummary({
        title: t(forceResend ? "platformMisc.runs.sendActivationResendMessage" : "platformMisc.runs.sendActivationMessage"),
        sent: agg.sent,
        already_sent: agg.already_sent,
        skipped: agg.skipped,
        failed: agg.failed,
      });
      setSelectedIds([]);
      if (selectedRun) await openRun(selectedRun);
    } catch (_) {
      notify(t("platformMisc.runs.messageSendFailed"));
    } finally {
      setActivationProcessing(false);
      setActivationForceResend(false);
      setActivationProgress({ done: 0, total: 0 });
    }
  };

  const runRetryEmails = async () => {
    if (!selectedRun || retrySelected.length === 0 || retryProcessing) return;
    setRetryProcessing(true);
    retryAbortRef.current = false;
    const items = retrySelected.map((k) => {
      const [sid, type] = k.split(":");
      return { submission_id: parseInt(sid), email_type: type };
    });
    const agg = { sent: 0, already_sent: 0, failed: [], cancelled: 0 };
    setRetryProgress({ done: 0, total: items.length });
    let aborted = false;
    let processed = 0;
    for (let i = 0; i < items.length && !aborted && !retryAbortRef.current; i += 10) {
      const chunk = items.slice(i, i + 10);
      let data;
      try {
        const res = await fetch("/api/platform/form-runs?action=retry_emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: selectedRun.id, retries: chunk }),
        });
        data = await res.json();
      } catch (_) {
        aborted = true;
        agg.failed.push({ name: t("platformMisc.runs.batchLabel", { count: Math.floor(i / 10) + 1 }), error: t("platformMisc.runs.retryNetworkError") });
        break;
      }
      if (!data.success) {
        aborted = true;
        agg.failed.push({ name: t("platformMisc.runs.batchFallback"), error: data.error || t("platformMisc.runs.retryFailedError") });
        break;
      }
      for (const r of data.results || []) {
        if (r.status === "sent") agg.sent++;
        else if (r.status === "already_sent") agg.already_sent++;
        else agg.failed.push({ name: r.name || `#${r.submission_id} (${r.email_type})`, error: r.error || t("platformMisc.runs.failedFallback") });
      }
      processed = Math.min(i + 10, items.length);
      setRetryProgress({ done: processed, total: items.length });
    }
    agg.retried = items.length;
    agg.cancelled = items.length - processed;
    // Record the unprocessed remainder as CANCELLED so history keeps
    // sent / failed / bounced / cancelled distinct and those rows stay
    // retryable later.
    const unprocessed = items.slice(processed);
    if (unprocessed.length > 0 && selectedRun) {
      try {
        await fetch("/api/platform/form-runs?action=mark_email_cancelled", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: selectedRun.id, items: unprocessed }),
        });
      } catch (_) {}
    }
    setRetryProcessing(false);
    setRetrySelected([]);
    // Refresh with keepTab so we STAY on the Emails tab — the summary modal
    // lives there, and the Failed list must update in place: successful
    // retries disappear from it, failures keep their latest reason.
    if (selectedRun) await openRun(selectedRun, { keepTab: true });
    setRetrySummary(agg);
    notify(
      agg.failed.length > 0
        ? t("platformMisc.runs.emailRetryPartial", { sent: agg.sent, failed: agg.failed.length })
        : t("platformMisc.runs.emailRetrySuccess", { sent: agg.sent })
    );
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
      { id: "overview", label: t("platformMisc.runs.tabOverview"), icon: BarChart3 },
      { id: "share", label: t("platformMisc.runs.tabShare"), icon: Link2 },
      { id: "assignments", label: t("platformMisc.runs.tabAssignments", { count: assignments.length }), icon: Users },
      { id: "responses", label: t("platformMisc.runs.tabAllResponses"), icon: FileText, href: `/platform/responses?run_id=${selectedRun?.id || ""}` },
      { id: "templates", label: t("platformMisc.runs.tabTemplates"), icon: Mail },
      { id: "emails", label: t("platformMisc.runs.tabEmails"), icon: Send },
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
          {(selectedRun.status === "closed" || selectedRun.status === "cancelled") && (
            <button onClick={() => handleStatusChange(selectedRun.id, "archived")} className="px-3 py-1.5 rounded-xl bg-slate-500/10 text-slate-500 border border-slate-500/30 text-[9px] font-black uppercase hover:bg-slate-500/20 flex items-center gap-1"><Archive className="w-3 h-3" /> {t("platformMisc.runs.archive")}</button>
          )}
          {selectedRun.status === "archived" && (
            <>
              <button onClick={() => handleStatusChange(selectedRun.id, "draft")} className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[9px] font-black uppercase hover:bg-emerald-500/20 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> {t("platformMisc.runs.restore")}</button>
              <button onClick={() => handleDeleteRun(selectedRun.id)} className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/30 text-[9px] font-black uppercase hover:bg-rose-500/20 flex items-center gap-1"><Trash2 className="w-3 h-3" /> {t("platformMisc.runs.delete")}</button>
            </>
          )}
          {(selectedRun.status === "closed" || selectedRun.status === "cancelled") && (
            <button onClick={() => handleStatusChange(selectedRun.id, "active")} className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[9px] font-black uppercase hover:bg-emerald-500/20 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {t("platformMisc.runs.reactivate")}</button>
          )}
          <button onClick={openManualAdd} className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[9px] font-black uppercase hover:bg-blue-500/20 flex items-center gap-1"><Plus className="w-3 h-3" /> {t("platformMisc.runs.addRespondent")}</button>
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

              {/* Run-scoped search + filters */}
              <div className="rounded-xl border border-[var(--border-primary)] bg-secondary p-4 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    value={respSearch}
                    onChange={(e) => setRespSearch(e.target.value)}
                    placeholder="Search this run's respondents (name, email, answers)..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-primary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap" ref={filterRowRef}>
                  <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-[var(--text-secondary)]">
                    <Filter className="w-3 h-3" /> Filters
                  </span>

                  {/* Active filter chips — each removable individually */}
                  {scoreChipActive && (
                    <button
                      onClick={clearScoreFilter}
                      title="Remove this filter"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30 text-[9px] font-bold text-[var(--brand-orange)] hover:bg-[var(--brand-orange)]/20"
                    >
                      {scoreChipLabel} <X className="w-3 h-3" />
                    </button>
                  )}

                  {activeFieldFilters.map(([label, val]) => (
                    <button
                      key={label}
                      onClick={() => removeFieldFilter(label)}
                      title="Remove this filter"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30 text-[9px] font-bold text-[var(--brand-orange)] hover:bg-[var(--brand-orange)]/20"
                    >
                      {label}: {val} <X className="w-3 h-3" />
                    </button>
                  ))}

                  {activeTrackingFilters.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setTrackingFilter(f.key, "")}
                      title="Remove this filter"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30 text-[9px] font-bold text-[var(--brand-orange)] hover:bg-[var(--brand-orange)]/20"
                    >
                      {f.label}: {trackingFilterOptionLabel(f.key, f.value)} <X className="w-3 h-3" />
                    </button>
                  ))}

                  {/* Inline editor — AI Score */}
                  {filterPickerMode === "score" && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-tertiary border border-[var(--brand-orange)]/30">
                      <select
                        value={scoreOp}
                        onChange={(e) => setScoreOp(e.target.value)}
                        className="bg-primary border border-[var(--border-primary)] rounded-md px-1.5 py-1 text-[9px] font-bold outline-none"
                      >
                        <option value="gte">≥</option>
                        <option value="gt">&gt;</option>
                        <option value="eq">=</option>
                        <option value="lte">≤</option>
                        <option value="lt">&lt;</option>
                        <option value="between">Between</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={scoreVal}
                        onChange={(e) => setScoreVal(e.target.value)}
                        placeholder="80"
                        className="w-14 px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)] text-[9px] font-bold outline-none focus:border-[var(--brand-orange)]"
                      />
                      {scoreOp === "between" && (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={scoreVal2}
                          onChange={(e) => setScoreVal2(e.target.value)}
                          placeholder="90"
                          className="w-14 px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)] text-[9px] font-bold outline-none focus:border-[var(--brand-orange)]"
                        />
                      )}
                      <span className="text-[9px] font-bold text-[var(--text-secondary)]">%</span>
                      <button
                        onClick={() => setFilterPickerMode(null)}
                        disabled={scoreVal === ""}
                        className="px-2 py-1 rounded-md bg-[var(--brand-orange)] text-black text-[8px] font-black uppercase disabled:opacity-40"
                      >
                        Apply
                      </button>
                      <button onClick={() => { setFilterPickerMode(null); clearScoreFilter(); }} className="text-[var(--text-secondary)] hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Inline editor — form field option */}
                  {filterPickerMode && filterPickerMode.type === "field" && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-tertiary border border-[var(--brand-orange)]/30">
                      <span className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{filterPickerMode.label}:</span>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            setFieldFilters((prev) => ({ ...prev, [filterPickerMode.label]: e.target.value }));
                            setFilterPickerMode(null);
                          }
                        }}
                        className="bg-primary border border-[var(--border-primary)] rounded-md px-1.5 py-1 text-[9px] font-bold outline-none focus:border-[var(--brand-orange)]"
                      >
                        <option value="">Select…</option>
                        {fieldOptionsOf(filterPickerMode.label).map((o, idx) => (
                          <option key={`${filterPickerMode.label}-${idx}`} value={String(o)}>
                            {String(o)}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => setFilterPickerMode(null)} className="text-[var(--text-secondary)] hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Inline editor — tracking filter (Approval Email / Review / Status / Activation Email / Account Status) */}
                  {filterPickerMode && filterPickerMode.type === "status" && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-tertiary border border-[var(--brand-orange)]/30">
                      <span className="text-[9px] font-black uppercase text-[var(--text-secondary)]">
                        {TRACKING_FILTERS.find((f) => f.key === filterPickerMode.key)?.label || filterPickerMode.key}:
                      </span>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            setTrackingFilter(filterPickerMode.key, e.target.value);
                            setFilterPickerMode(null);
                          }
                        }}
                        className="bg-primary border border-[var(--border-primary)] rounded-md px-1.5 py-1 text-[9px] font-bold outline-none focus:border-[var(--brand-orange)]"
                      >
                        <option value="">Select…</option>
                        {trackingFilterOptions(filterPickerMode.key).map((v) => (
                          <option key={v} value={v}>{trackingFilterOptionLabel(filterPickerMode.key, v)}</option>
                        ))}
                      </select>
                      <button onClick={() => setFilterPickerMode(null)} className="text-[var(--text-secondary)] hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* + Add Filter dropdown — parameters come from this run's form */}
                  {availableParams.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setFilterPickerOpen(!filterPickerOpen)}
                        className="px-2.5 py-1.5 rounded-lg border border-dashed border-[var(--border-primary)] text-[9px] font-black uppercase text-[var(--text-secondary)] hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange)] flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Filter
                      </button>
                      {filterPickerOpen && (
                        <div className="absolute left-0 top-full mt-1 w-52 rounded-lg border border-[var(--border-primary)] bg-secondary shadow-xl z-30 max-h-64 overflow-y-auto">
                          {availableParams.map((p) => (
                            <button
                              key={p.key}
                              onClick={() => pickFilterParam(p)}
                              className="w-full px-3 py-2 text-left text-[10px] font-bold text-[var(--text-primary)] hover:bg-tertiary"
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {duplicateGroups.groups.length > 0 && (
                    <button
                      onClick={() => setShowDuplicates(!showDuplicates)}
                      className={cn("px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase border", showDuplicates ? "bg-amber-500 text-black border-amber-500" : "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20")}
                    >
                      {showDuplicates ? "Show all" : `Duplicates (${duplicateGroups.extra})`}
                    </button>
                  )}

                  {hasRunFilters && (
                    <button
                      onClick={clearRunFilters}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 text-[9px] font-black uppercase hover:bg-rose-500/20"
                    >
                      Clear all
                    </button>
                  )}

                  {/* Export the CURRENTLY FILTERED set (or selection) */}
                  {visibleSubmissions.length > 0 && (
                    <button
                      onClick={() => { setShowExportOptions(true); setExportScope("filtered"); }}
                      className="ml-auto px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[9px] font-black uppercase hover:bg-emerald-500/20 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> {t("platformMisc.runs.exportBtn")} ({visibleSubmissions.length})
                    </button>
                  )}
                </div>

                {/* Visual separator between the filter controls and the selection bar */}
                <div className="border-t border-[var(--border-primary)]" />

                {/* Bulk selection bar — selection always respects the active filters */}
                {duplicateGroups.groups.length > 0 && (
                  <div className="flex items-center gap-2 text-[9px] font-bold text-amber-500">
                    <AlertTriangle className="w-3 h-3" />
                    {duplicateGroups.groups.length} duplicate email group{duplicateGroups.groups.length === 1 ? "" : "s"} — {duplicateGroups.extra} extra submission{duplicateGroups.extra === 1 ? "" : "s"}. Only the highest-scored duplicate receives emails.
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        className="accent-[var(--brand-orange)] w-3.5 h-3.5"
                      />
                      Select all filtered
                    </label>
                    <span className="text-[9px] font-bold text-[var(--text-secondary)]">
                      {showDuplicates
                        ? `${visibleSubmissions.length} duplicate submission${visibleSubmissions.length === 1 ? "" : "s"}`
                        : `${filteredSubmissions.length} respondent${filteredSubmissions.length === 1 ? "" : "s"} match your filters`}
                    </span>
                  </div>
                  {selectedIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-[var(--brand-orange)]">
                        {selectedIds.length} selected
                      </span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setBulkMenuOpen(!bulkMenuOpen)}
                          disabled={bulkProcessing}
                          className="px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase disabled:opacity-50 flex items-center gap-1"
                        >
                          Actions <ChevronDown className="w-3 h-3" />
                        </button>
                        {bulkMenuOpen && (
                          <div className="absolute right-0 mt-1 w-56 rounded-lg border border-[var(--border-primary)] bg-secondary shadow-xl z-30">
                            <button
                              type="button"
                              onClick={() => { setBulkMenuOpen(false); setBulkConfirmOpen(true); }}
                              className="w-full px-3 py-2 text-left text-[10px] font-black uppercase text-emerald-400 hover:bg-emerald-500/10"
                            >
                              {t("platformMisc.runs.approve")}
                            </button>
                            <button
                              type="button"
                              onClick={() => openActivationConfirm(false)}
                              className="w-full px-3 py-2 text-left text-[10px] font-black uppercase text-[var(--text-primary)] hover:bg-tertiary flex items-center gap-1.5"
                            >
                              <Key className="w-3 h-3" /> {t("platformMisc.runs.sendActivationMessage")}
                            </button>
                            <button
                              type="button"
                              onClick={() => openActivationConfirm(true)}
                              className="w-full px-3 py-2 text-left text-[10px] font-black uppercase text-amber-400 hover:bg-amber-500/10 flex items-center gap-1.5"
                            >
                              <RefreshCw className="w-3 h-3" /> {t("platformMisc.runs.resendActivationMessage")}
                            </button>
                            <button
                              type="button"
                              onClick={openMessageComposer}
                              className="w-full px-3 py-2 text-left text-[10px] font-black uppercase text-[var(--text-primary)] hover:bg-tertiary flex items-center gap-1.5"
                            >
                              <Mail className="w-3 h-3" /> {t("platformMisc.runs.sendCustomMessage")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[9px] font-bold text-[var(--text-secondary)]">
                  {t("platformMisc.runs.showingRespondentsInRun", { start: visibleSubmissions.length === 0 ? 0 : (respSafePage - 1) * perPage + 1, end: Math.min(respSafePage * perPage, visibleSubmissions.length), total: visibleSubmissions.length })}
                </p>
              </div>

              {/* Submissions table */}
              {subLoading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" /></div> : (
                <>
                <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                  <table className="w-full text-left">
                    <thead className="bg-tertiary">
                      <tr className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleSelectAllFiltered}
                            className="accent-[var(--brand-orange)] w-3.5 h-3.5 align-middle"
                          />
                        </th>
                        <th className="px-4 py-3 w-10">{t("platformMisc.runs.colSn")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colEmail")}</th>
                        {runFormFields.slice(0, 2).map(f => (
                          <th key={f.id} className="px-3 py-3 max-w-[120px]" title={f.label}>
                            <span className="line-clamp-1">{f.label.length > 25 ? f.label.substring(0, 25) + "..." : f.label}</span>
                          </th>
                        ))}
                        <th className="px-4 py-3">{t("platformMisc.runs.statusSubmitted")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colAiScore")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colApprovalEmail")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.review")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colStatus")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colActivationEmail")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colAccountStatus")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colActions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-primary)]">
                      {pagedSubmissions.map((s, i) => {
                        const sc = SUB_STATUS[s.status] || SUB_STATUS.draft;
                        const subReviews = reviews.filter((r) => r.submission_id === s.id);
                        const lastReview = subReviews[subReviews.length - 1];
                        const subData = s.data || {};
                        const scores = subData._scores;
                        // AI evaluation table is the source of truth; fall back
                        // to legacy inline _scores for pre-evaluation data.
                        const evalRow = evaluations.find((e) => e.submission_id === s.id);
                        const overall = evalRow != null ? evalRow.overall_score : scores?.overall;
                        const ranking = evalRow != null ? evalRow.ranking : scores?.ranking;
                        const activationEmail = emailLog
                          .filter((e) => e.submission_id === s.id && e.email_type === "activation")
                          .slice(-1)[0];
                        // "Actually sent" must come from sent rows in the full
                        // history (activation_history.first_sent_at) — never
                        // inferred from a queued/pending row or account status.
                        const activationEverSent =
                          !!s.activation_history?.first_sent_at ||
                          (activationEmail && ["sent", "delivered", "opened", "clicked"].includes(activationEmail.status));
                        const approvalEmail = emailLog
                          .filter((e) => e.submission_id === s.id && e.email_type === "approval")
                          .slice(-1)[0];
                        const accountStatus = s.account_status || (s.account_activated
                          ? "active"
                          : s.account_created
                            ? "activation_pending"
                            : "not_created");
                        // The address the system actually sent to (from the
                        // delivery log) — falls back to the resolved respondent
                        // email when nothing has been sent yet.
                        const sentLog = [...emailLog]
                          .filter((e) => e.submission_id === s.id && (e.status === "sent" || e.status === "failed"))
                          .slice(-1)[0];
                        const sentEmail = sentLog?.recipient || s.email || "";
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
                            <td className="px-4 py-3 w-10">
                              <input
                                type="checkbox"
                                checked={selectedSet.has(s.id)}
                                onChange={() => toggleSelect(s.id)}
                                className="accent-[var(--brand-orange)] w-3.5 h-3.5 align-middle"
                              />
                            </td>
                            {/* S/N — presentation-level row number, continuous across pages and respecting filters */}
                            <td className="px-4 py-3 w-10 text-center text-[10px] text-[var(--text-secondary)]">
                              {(respSafePage - 1) * perPage + i + 1}
                            </td>
                            {/* Email — the address the system actually sent to (from the delivery log), falling back to the resolved respondent email */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="text-[10px] text-[var(--text-secondary)] truncate max-w-[160px] block"
                                  title={sentLog
                                    ? t("platformMisc.runs.emailSentToTooltip", { recipient: sentLog.recipient || "n/a", type: sentLog.email_type, provider: sentLog.provider || "email", status: sentLog.status, date: sentLog.sent_at ? ", " + new Date(sentLog.sent_at).toLocaleString() : "" })
                                    : s.email || t("platformMisc.runs.noEmailProvided")}
                                >
                                  {sentEmail || t("platformMisc.runs.noEmailProvided")}
                                </span>
                                {s.email && duplicateEmailSet.has(String(s.email).trim().toLowerCase()) && (
                                  <span className={cn("px-1.5 py-0.5 rounded text-[7px] font-black uppercase whitespace-nowrap", duplicateGroups.keeperIds.has(s.id) ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>
                                    {duplicateGroups.keeperIds.has(s.id) ? t("platformMisc.runs.emailKeeper") : t("platformMisc.runs.emailDuplicate")}
                                  </span>
                                )}
                              </div>
                            </td>
                            {runFormFields.slice(0, 2).map(f => (
                              <td key={f.id} className="px-3 py-3 text-[10px] text-[var(--text-secondary)] max-w-[150px] truncate" title={fv(f)}>{fv(f)}</td>
                            ))}
                            <td className="px-4 py-3 text-[10px] text-[var(--text-secondary)]">{s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : "—"}</td>
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
                            <td className="px-4 py-3">
                              {approvalEmail ? (
                                (() => {
                                  const cfg = EMAIL_STATUS_CONFIG[approvalEmail.status] || { color: "text-slate-500", bg: "bg-slate-500/10", label: "platformMisc.runs.emailPending" };
                                  return (
                                    <span title={approvalEmail.error || t(cfg.label)} className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", cfg.bg, cfg.color)}>
                                      {t(cfg.label)}
                                    </span>
                                  );
                                })()
                              ) : (
                                <span title={t("platformMisc.runs.emailNotSentTitle")} className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-slate-500/10 text-slate-400">{t("platformMisc.runs.emailNotSent")}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[9px] text-[var(--text-secondary)]">
                              {lastReview ? <span>{lastReview.decision} {t("platformMisc.runs.by")} {lastReview.reviewer_name || lastReview.reviewer_id}</span> : "—"}
                            </td>
                            <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", sc.color, sc.bg)}>{t(sc.label)}</span></td>
                            <td className="px-4 py-3">
                              {activationEverSent || activationEmail?.status === "failed" ? (
                                (() => {
                                  const cfg = EMAIL_STATUS_CONFIG[activationEmail.status] || { color: "text-amber-500", bg: "bg-amber-500/10", label: "platformMisc.runs.emailPending" };
                                  return (
                                    <span title={activationEmail.error || t(cfg.label)} className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", cfg.bg, cfg.color)}>
                                      {t(cfg.label)}
                                    </span>
                                  );
                                })()
                              ) : (
                                <span
                                  title={activationEmail?.error ? `${t("platformMisc.runs.activationNotSentYet")} — ${activationEmail.error}` : t("platformMisc.runs.activationNotSentYet")}
                                  className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-slate-500/10 text-slate-400"
                                >
                                  {t("platformMisc.runs.emailNotSent")}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {(() => {
                                const cfg = ACCOUNT_STATUS_STYLES[accountStatus] || ACCOUNT_STATUS_STYLES.not_created;
                                const hist = s.activation_history;
                                // A queued/pending row is NOT "sent" — show it as
                                // not-sent-yet so the column never implies an
                                // activation email went out when it did not.
                                const emailStatusShown =
                                  hist?.email_status && !["pending", "skipped", "cancelled"].includes(hist.email_status)
                                    ? t("platformMisc.runs.activationEmailStatus", { status: t(EMAIL_STATUS_CONFIG[hist.email_status]?.label || "platformMisc.runs.emailPending") })
                                    : null;
                                const histTitle = [
                                  t(cfg.title),
                                  emailStatusShown || t("platformMisc.runs.activationNotSentYet"),
                                  hist?.first_sent_at ? t("platformMisc.runs.activationFirstSent", { date: new Date(hist.first_sent_at).toLocaleString() }) : null,
                                  hist?.last_sent_at ? t("platformMisc.runs.activationLastSent", { date: new Date(hist.last_sent_at).toLocaleString() }) : null,
                                  hist?.token_valid ? t("platformMisc.runs.activationLinkValid", { date: hist.token_expires_at ? new Date(hist.token_expires_at).toLocaleString() : "" }) : (hist?.token_expires_at ? t("platformMisc.runs.activationLinkExpired") : null),
                                ].filter(Boolean).join(" | ");
                                return (
                                  <span title={histTitle} className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", cfg.cls)}>
                                    {t(cfg.label)}
                                  </span>
                                );
                              })()}
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
                {respTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-[10px] text-[var(--text-secondary)]">Page {respSafePage} of {respTotalPages}</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setRespPage(Math.max(1, respSafePage - 1))} disabled={respSafePage === 1} className="px-2 py-1 rounded-lg bg-tertiary text-[10px] font-bold text-[var(--text-secondary)] disabled:opacity-30 hover:text-[var(--text-primary)]">Prev</button>
                      {Array.from({ length: Math.min(respTotalPages, 7) }, (_, i) => {
                        let pn;
                        if (respTotalPages <= 7) pn = i + 1;
                        else if (respSafePage <= 4) pn = i + 1;
                        else if (respSafePage >= respTotalPages - 3) pn = respTotalPages - 6 + i;
                        else pn = respSafePage - 3 + i;
                        return <button key={pn} onClick={() => setRespPage(pn)} className={cn("w-7 h-7 rounded-lg text-[10px] font-bold", respSafePage === pn ? "bg-[var(--brand-orange)] text-black" : "bg-tertiary text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>{pn}</button>;
                      })}
                      <button onClick={() => setRespPage(Math.min(respTotalPages, respSafePage + 1))} disabled={respSafePage === respTotalPages} className="px-2 py-1 rounded-lg bg-tertiary text-[10px] font-bold text-[var(--text-secondary)] disabled:opacity-30 hover:text-[var(--text-primary)]">Next</button>
                    </div>
                  </div>
                )}
                </>
              )}

              {/* Submission Timeline (expandable per submission) */}
              {selectedSubmission && (
                <SubmissionTimeline submission={selectedSubmission} onClose={() => setSelectedSubmission(null)} />
              )}

              {/* ─── BULK APPROVE CONFIRM ─── */}
              {bulkConfirmOpen && (
                <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-md w-full space-y-4">
                    <h4 className="text-sm font-black uppercase text-[var(--text-primary)]">
                      {t("platformMisc.runs.bulkApproveTitle", { count: selectedIds.length })}
                    </h4>
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                      {t("platformMisc.runs.bulkApproveDesc")}
                    </p>
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setBulkConfirmOpen(false)} disabled={bulkProcessing} className="px-4 py-2 rounded-lg bg-tertiary text-[10px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.cancel")}</button>
                      <button onClick={runBulkApprove} disabled={bulkProcessing} className="px-4 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase">
                        {t("platformMisc.runs.bulkApproveConfirm", { count: selectedIds.length })}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── SEND ACTIVATION MESSAGES CONFIRM ─── */}
              {activationConfirmOpen && (
                <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-md w-full space-y-4">
                    <h4 className="text-sm font-black uppercase text-[var(--text-primary)]">
                      {t(activationForceResend ? "platformMisc.runs.activationResendConfirmTitle" : "platformMisc.runs.activationConfirmTitle")}
                    </h4>
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                      {t(activationForceResend ? "platformMisc.runs.activationResendConfirmDesc" : "platformMisc.runs.activationConfirmDesc", { count: (activationForceResend ? eligibleResendActivationIds : eligibleSendActivationIds).length })}
                    </p>
                    {activationForceResend && eligibleResendActivationIds.slice(0, 5).map((id) => {
                      const s = submissions.find((x) => x.id === id);
                      const h = s?.activation_history;
                      return (
                        <div key={id} className="rounded-lg bg-primary/50 border border-[var(--border-primary)] px-3 py-2 text-[9px] text-[var(--text-secondary)] space-y-0.5">
                          <p className="font-black text-[var(--text-primary)] uppercase truncate">{s?.display_name || s?.submitter_name || `#${id}`}</p>
                          {h?.first_sent_at && <p>{t("platformMisc.runs.activationFirstSent", { date: new Date(h.first_sent_at).toLocaleString() })}</p>}
                          {h?.last_sent_at && <p>{t("platformMisc.runs.activationLastSent", { date: new Date(h.last_sent_at).toLocaleString() })}</p>}
                          <p className={h?.token_valid ? "text-emerald-500" : "text-rose-500"}>
                            {h?.token_valid
                              ? t("platformMisc.runs.activationLinkValid", { date: h.token_expires_at ? new Date(h.token_expires_at).toLocaleString() : "" })
                              : t("platformMisc.runs.activationLinkExpired")}
                          </p>
                        </div>
                      );
                    })}
                    {activationForceResend && eligibleResendActivationIds.length > 5 && (
                      <p className="text-[9px] font-bold text-[var(--text-secondary)]">
                        +{eligibleResendActivationIds.length - 5} {t("platformMisc.runs.moreRecipients")}
                      </p>
                    )}
                    {selectedIds.length > (activationForceResend ? eligibleResendActivationIds : eligibleSendActivationIds).length && (
                      <p className="text-[10px] font-bold text-amber-500">
                        {t("platformMisc.runs.activationIneligible", { count: selectedIds.length - (activationForceResend ? eligibleResendActivationIds : eligibleSendActivationIds).length })}
                      </p>
                    )}
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setActivationConfirmOpen(false)} disabled={activationProcessing} className="px-4 py-2 rounded-lg bg-tertiary text-[10px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.cancel")}</button>
                      <button onClick={runSendActivationMessages} disabled={activationProcessing || (activationForceResend ? eligibleResendActivationIds : eligibleSendActivationIds).length === 0} className="px-4 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase">
                        {t(activationForceResend ? "platformMisc.runs.resendActivationConfirm" : "platformMisc.runs.sendActivationConfirm")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── ACTIVATION SENDING PROGRESS ─── */}
              {activationProcessing && (
                <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-sm w-full text-center space-y-3">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)] mx-auto" />
                    <p className="text-[10px] font-black uppercase text-[var(--text-primary)]">
                      {t("platformMisc.runs.messageSending")} {activationProgress.done}/{activationProgress.total}
                    </p>
                  </div>
                </div>
              )}

              {/* ─── BULK PROCESSING ─── */}
              {bulkProcessing && (
                <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-sm w-full text-center space-y-3">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)] mx-auto" />
                    <p className="text-[10px] font-black uppercase text-[var(--text-primary)]">
                      {t("platformMisc.runs.bulkApproving", { done: bulkProgress.done, total: bulkProgress.total })}
                    </p>
                    <p className="text-[9px] text-[var(--text-secondary)]">
                      {t("platformMisc.runs.bulkApprovingHint")}
                    </p>
                    <button
                      onClick={() => { bulkAbortRef.current = true; }}
                      className="px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[9px] font-black uppercase hover:bg-rose-500/20"
                    >
                      {t("platformMisc.runs.bulkCancelSending")}
                    </button>
                  </div>
                </div>
              )}

              {/* ─── BULK SUMMARY ─── */}
              {bulkSummary && !bulkProcessing && (
                <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-md w-full space-y-3">
                    <h4 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.bulkComplete")}</h4>
                    <p className="text-[10px] font-bold text-emerald-500">{t("platformMisc.runs.bulkApprovedCount", { count: bulkSummary.approved })}</p>
                    {bulkSummary.already_approved > 0 && (
                      <p className="text-[10px] font-bold text-slate-400">{t("platformMisc.runs.bulkAlreadyApproved", { count: bulkSummary.already_approved })}</p>
                    )}
                    {bulkSummary.cancelled > 0 && (
                      <p className="text-[10px] font-bold text-slate-400">{t("platformMisc.runs.bulkCancelledCount", { count: bulkSummary.cancelled })}</p>
                    )}
                    {bulkSummary.failed.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-rose-500">{t("platformMisc.runs.bulkFailedCount", { count: bulkSummary.failed.length })}</p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {bulkSummary.failed.map((f, i) => (
                            <p key={i} className="text-[9px] text-[var(--text-secondary)]">• {f.name || t("platformMisc.runs.bulkFailedFallback")} — {f.error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    <button onClick={() => setBulkSummary(null)} className="w-full py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase">{t("platformMisc.runs.done")}</button>
                  </div>
                </div>
              )}

              {/* ─── MESSAGE RESULT SUMMARY ─── */}
              {messageSummary && (
                <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-md w-full space-y-3">
                    <h4 className="text-sm font-black uppercase text-[var(--text-primary)]">{messageSummary.title}</h4>
                    <p className="text-[10px] font-bold text-emerald-500">{t("platformMisc.runs.messageSentCount", { count: messageSummary.sent })}</p>
                    {messageSummary.already_sent > 0 && (
                      <p className="text-[10px] font-bold text-slate-400">{t("platformMisc.runs.messageAlreadySentCount", { count: messageSummary.already_sent })}</p>
                    )}
                    {messageSummary.skipped > 0 && (
                      <p className="text-[10px] font-bold text-amber-500">{t("platformMisc.runs.messageSkippedCount", { count: messageSummary.skipped })}</p>
                    )}
                    {messageSummary.failed > 0 && (
                      <p className="text-[10px] font-bold text-rose-500">{t("platformMisc.runs.messageFailedCount", { count: messageSummary.failed })}</p>
                    )}
                    <button onClick={() => setMessageSummary(null)} className="w-full py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase">{t("platformMisc.runs.done")}</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── EMAILS TAB ─── */}
          {detailTab === "emails" && (() => {
const allRetryableSelected = retryableVisible.length > 0 && retryableVisible.every((f) => retrySelectedSet.has(`${f.submission_id}:${f.email_type}`));
            const STATUS_BADGE = {
              sent: "bg-emerald-500/10 text-emerald-500",
              delivered: "bg-emerald-400/10 text-emerald-400",
              opened: "bg-sky-500/10 text-sky-500",
              clicked: "bg-indigo-500/10 text-indigo-500",
              delayed: "bg-amber-500/10 text-amber-500",
              complained: "bg-rose-500/10 text-rose-500",
              failed: "bg-rose-500/10 text-rose-500",
              bounced: "bg-amber-500/10 text-amber-500",
              cancelled: "bg-slate-500/10 text-slate-400",
              skipped: "bg-slate-500/10 text-slate-400",
              pending: "bg-amber-500/10 text-amber-400",
            };
            return (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Email stats — clickable status filters per category */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: "approval", label: t("platformMisc.runs.emailSummaryApproval") },
                    { key: "activation", label: t("platformMisc.runs.emailSummaryActivation") },
                  ].map((cat) => {
                    const catTotal = allEmailRows.filter((r) => r.email_type === cat.key).length;
                    return (
                      <div key={cat.key} className="rounded-xl border border-[var(--border-primary)] bg-tertiary p-4 space-y-2">
                        <p className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{cat.label}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => { setEmailTypeFilter(cat.key); setEmailStatusFilter("all"); setEmailPage(1); }}
                            className={cn("px-2 py-1 rounded-lg text-[9px] font-black uppercase border transition-all",
                              emailTypeFilter === cat.key && emailStatusFilter === "all"
                                ? "bg-[var(--brand-orange)] text-black border-[var(--brand-orange)]"
                                : "bg-secondary text-[var(--text-secondary)] border-[var(--border-primary)] hover:text-[var(--text-primary)]")}
                          >
                            {t("platformMisc.runs.emailStatusAll")} ({catTotal})
                          </button>
                          {EMAIL_STATUS_ORDER.map((k) => {
                            const cfg = EMAIL_STATUS_CONFIG[k];
                            const count = emailSummary.stats[cat.key][k];
                            const active = emailTypeFilter === cat.key && emailStatusFilter === k;
                            return (
                              <button
                                key={k}
                                onClick={() => { setEmailTypeFilter(cat.key); setEmailStatusFilter(k); setEmailPage(1); }}
                                className={cn("px-2 py-1 rounded-lg text-[9px] font-black uppercase border transition-all",
                                  active ? "bg-[var(--brand-orange)] text-black border-[var(--brand-orange)]"
                                         : "bg-secondary text-[var(--text-secondary)] border-[var(--border-primary)] hover:text-[var(--text-primary)]")}
                              >
                                <span className={active ? "text-black" : cfg.color}>{count}</span> {t(cfg.label)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                                {/* Email rows — stats/dropdown/search/date filters + retryable table */}
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {/* Category tabs */}
                                      {[
                                        { key: "all", label: t("platformMisc.runs.emailTypeAll") },
                                        { key: "approval", label: t("platformMisc.runs.emailTypeApproval") },
                                        { key: "activation", label: t("platformMisc.runs.emailTypeActivation") },
                                      ].map((tab) => (
                                        <button
                                          key={tab.key}
                                          onClick={() => { setEmailTypeFilter(tab.key); setEmailPage(1); }}
                                          className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all",
                                            emailTypeFilter === tab.key
                                              ? "bg-[var(--brand-orange)] text-black"
                                              : "bg-tertiary text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}
                                        >
                                          {tab.label}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
                                        <input
                                          type="text"
                                          value={emailSearch}
                                          onChange={(e) => { setEmailSearch(e.target.value); setEmailPage(1); }}
                                          placeholder={t("platformMisc.runs.emailSearchPlaceholder")}
                                          className="w-56 pl-9 pr-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)]"
                                        />
                                      </div>
                                      <input
                                        type="date"
                                        value={emailDateFrom}
                                        onChange={(e) => { setEmailDateFrom(e.target.value); setEmailPage(1); }}
                                        className="px-2 py-1 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                                      />
                                      <span className="text-[9px] text-[var(--text-secondary)]">{t("platformMisc.runs.emailDateTo")}</span>
                                      <input
                                        type="date"
                                        value={emailDateTo}
                                        onChange={(e) => { setEmailDateTo(e.target.value); setEmailPage(1); }}
                                        className="px-2 py-1 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                                      />
                                      <select
                                        value={emailStatusFilter}
                                        onChange={(e) => { setEmailStatusFilter(e.target.value); setEmailPage(1); }}
                                        className="px-2 py-1 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                                      >
                                        <option value="all">{t("platformMisc.runs.emailAllStatuses")}</option>
                                        {EMAIL_STATUS_ORDER.map((k) => (
                                          <option key={k} value={k}>{t(EMAIL_STATUS_CONFIG[k].label)}</option>
                                        ))}
                                      </select>
                                      {(emailDateFrom || emailDateTo || emailStatusFilter !== "all" || emailSearch || emailTypeFilter !== "all") && (
                                        <button
                                          onClick={() => { setEmailStatusFilter("all"); setEmailDateFrom(""); setEmailDateTo(""); setEmailSearch(""); setEmailTypeFilter("all"); setEmailPage(1); setRetrySelected([]); }}
                                          className="px-2 py-1 rounded-lg bg-tertiary text-[var(--text-secondary)] text-[8px] font-black uppercase border border-[var(--border-primary)] hover:text-[var(--text-primary)]"
                                        >
                                          {t("platformMisc.runs.emailResetFilters")}
                                        </button>
                                      )}
                                    </div>
                                    {retrySelected.length > 0 && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-[var(--brand-orange)]">{t("platformMisc.runs.emailSelectedCount", { count: retrySelected.length })}</span>
                                        <button
                                          onClick={() => setRetrySelected([])}
                                          disabled={retryProcessing}
                                          title={t("platformMisc.runs.emailDeselectTitle")}
                                          className="px-3 py-1.5 rounded-lg bg-tertiary text-[var(--text-secondary)] text-[9px] font-black uppercase hover:text-[var(--text-primary)] disabled:opacity-50"
                                        >
                                          {t("platformMisc.runs.cancel")}
                                        </button>
                                        <button
                                          onClick={runRetryEmails}
                                          disabled={retryProcessing}
                                          className="px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase disabled:opacity-50 flex items-center gap-1"
                                        >
                                          <RefreshCw className="w-3 h-3" /> {t("platformMisc.runs.emailRetrySelected")}
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {allEmailRows.length === 0 ? (
                                    <div className="py-12 text-center bg-secondary rounded-2xl border border-[var(--border-primary)] border-dashed">
                                      <Mail className="w-8 h-8 mx-auto text-[var(--text-secondary)] opacity-30" />
                                      <p className="text-[12px] font-bold text-[var(--text-secondary)] mt-3">{t("platformMisc.runs.emailNoEmailsYet")}</p>
                                    </div>
                                  ) : visibleEmailRows.length === 0 ? (
                                    <p className="text-[10px] text-[var(--text-secondary)]">
                                      {emailStatusFilter !== "all"
                                        ? `${t("platformMisc.runs.emailNoMatchStatus", { label: t(EMAIL_STATUS_CONFIG[emailStatusFilter].label).toLowerCase() })} — ${t("platformMisc.runs.emailNoMatchStatusHint", { label: t(EMAIL_STATUS_CONFIG[emailStatusFilter].label).toLowerCase() })}`
                                        : t("platformMisc.runs.emailNoneMatchFilter")}
                                    </p>
                                  ) : (
                                    <>
                                    <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                                      <table className="w-full text-left">
                                        <thead className="bg-tertiary">
                                          <tr className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                                            <th className="px-4 py-3 w-10">
                                              <input
                                                type="checkbox"
                                                checked={allRetryableSelected}
                                                onChange={() =>
                                                  setRetrySelected(allRetryableSelected ? [] : retryableVisible.map((f) => `${f.submission_id}:${f.email_type}`))
                                                }
                                                className="accent-[var(--brand-orange)] w-3.5 h-3.5"
                                              />
                                            </th>
                                            <th className="px-3 py-3">{t("platformMisc.runs.emailColRespondent")}</th>
                                            <th className="px-3 py-3">{t("platformMisc.runs.emailColType")}</th>
                                            <th className="px-3 py-3">{t("platformMisc.runs.colStatus")}</th>
                                            <th className="px-3 py-3">{t("platformMisc.runs.emailColRecipient")}</th>
                                            <th className="px-3 py-3">{t("platformMisc.runs.emailSent")}</th>
                                            <th className="px-3 py-3">{t("platformMisc.runs.emailDelivered")}</th>
                                            <th className="px-3 py-3">{t("platformMisc.runs.emailOpened")}</th>
                                            <th className="px-3 py-3">{t("platformMisc.runs.emailClicked")}</th>
                                            <th className="px-3 py-3">{t("platformMisc.runs.emailColReason")}</th>
                                            <th className="px-3 py-3">{t("platformMisc.runs.emailColDate")}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--border-primary)]">
                                          {pagedEmailRows.map((f) => {
                                            const key = `${f.submission_id}:${f.email_type}`;
                                            const isRetryable = RETRYABLE_EMAIL_STATUSES.includes(f.status);
                                            const statusSet = emailStatusSets.get(key) || new Set();
                                            const had = (st) => statusSet.has(st);
                                            const milestoneSent = had("sent") || ["delivered", "opened", "clicked", "delayed", "bounced", "failed", "complained"].some(had);
                                            const milestoneDelivered = had("delivered") || had("opened") || had("clicked");
                                            const milestoneOpened = had("opened") || had("clicked");
                                            const milestoneClicked = had("clicked");
                                            return (
                                              <tr key={key} className="text-[11px] font-bold text-[var(--text-primary)] hover:bg-tertiary/50">
                                                <td className="px-4 py-3 w-10">
                                                  {isRetryable && (
                                                    <input
                                                      type="checkbox"
                                                      checked={retrySelectedSet.has(key)}
                                                      onChange={() => toggleRetrySelect(key)}
                                                      className="accent-[var(--brand-orange)] w-3.5 h-3.5"
                                                    />
                                                  )}
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">{f.name}</td>
                                                <td className="px-3 py-3">
                                                  <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", f.email_type === "activation" ? "bg-purple-500/10 text-purple-400" : "bg-cyan-500/10 text-cyan-400")}>
                                                    {f.email_type}
                                                  </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                  <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", STATUS_BADGE[f.status] || STATUS_BADGE.failed)}>
                                                    {t(EMAIL_STATUS_CONFIG[f.status]?.label || "platformMisc.runs.emailPending")}
                                                  </span>
                                                </td>
                                                <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] truncate max-w-[180px]" title={f.email}>
                                                  {f.email || "—"}
                                                </td>
                                                <td className="px-3 py-3 text-center">{milestoneSent ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" /> : <span className="text-[var(--text-secondary)] opacity-40">—</span>}</td>
                                                <td className="px-3 py-3 text-center">{milestoneDelivered ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" /> : <span className="text-[var(--text-secondary)] opacity-40">—</span>}</td>
                                                <td className="px-3 py-3 text-center">{milestoneOpened ? <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 inline" /> : <span className="text-[var(--text-secondary)] opacity-40">—</span>}</td>
                                                <td className="px-3 py-3 text-center">{milestoneClicked ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 inline" /> : <span className="text-[var(--text-secondary)] opacity-40">—</span>}</td>
                                                <td className="px-3 py-3 text-[10px] text-rose-400 max-w-[260px] truncate" title={f.error || "Unknown reason"}>
                                                  {f.error || "Unknown reason"}
                                                </td>
                                                <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] whitespace-nowrap">
                                                  {f.sent_at ? new Date(f.sent_at).toLocaleDateString() : (f.created_at ? new Date(f.created_at).toLocaleDateString() : "—")}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                      <p className="text-[9px] text-[var(--text-secondary)]">
                                        {t("platformMisc.runs.emailShowingRange", { start: (safeEmailPage - 1) * EMAIL_PAGE_SIZE + 1, end: Math.min(safeEmailPage * EMAIL_PAGE_SIZE, visibleEmailRows.length), total: visibleEmailRows.length })}
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => setEmailPage(safeEmailPage - 1)}
                                          disabled={safeEmailPage <= 1}
                                          className="px-3 py-1.5 rounded-lg bg-tertiary text-[var(--text-secondary)] text-[9px] font-black uppercase border border-[var(--border-primary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                                        >
                                          {t("platformMisc.runs.emailPagePrev")}
                                        </button>
                                        <span className="text-[9px] text-[var(--text-secondary)]">{safeEmailPage} / {emailTotalPages}</span>
                                        <button
                                          onClick={() => setEmailPage(safeEmailPage + 1)}
                                          disabled={safeEmailPage >= emailTotalPages}
                                          className="px-3 py-1.5 rounded-lg bg-tertiary text-[var(--text-secondary)] text-[9px] font-black uppercase border border-[var(--border-primary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                                        >
                                          {t("platformMisc.runs.emailPageNext")}
                                        </button>
                                      </div>
                                    </div>
                                    </>
                                  )}
                                </div>
{/* ─── RETRY PROCESSING ─── */}
                {retryProcessing && (
                  <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-sm w-full text-center space-y-3">
                      <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)] mx-auto" />
                      <p className="text-[10px] font-black uppercase text-[var(--text-primary)]">
                        Retrying {retryProgress.done} of {retryProgress.total} emails...
                      </p>
                      <p className="text-[9px] text-[var(--text-secondary)]">
                        Already-sent emails are kept. Stopping leaves the remaining rows unchanged — select them again later.
                      </p>
                      <button
                        onClick={() => { retryAbortRef.current = true; }}
                        className="px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[9px] font-black uppercase hover:bg-rose-500/20"
                      >
                        Cancel Sending
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── RETRY SUMMARY ─── */}
                {retrySummary && !retryProcessing && (
                  <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-md w-full space-y-3">
                      <h4 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.emailRetryComplete")}</h4>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                        {t("platformMisc.runs.emailRetryCount", { count: retrySummary.retried })}
                      </p>
                      <p className="text-[10px] font-bold text-emerald-500">{t("platformMisc.runs.emailRetrySent", { count: retrySummary.sent })}</p>
                      {retrySummary.already_sent > 0 && (
                        <p className="text-[10px] font-bold text-slate-400">{t("platformMisc.runs.emailRetryAlready", { count: retrySummary.already_sent })}</p>
                      )}
                      {retrySummary.cancelled > 0 && (
                        <p className="text-[10px] font-bold text-slate-400">{t("platformMisc.runs.bulkCancelledCount", { count: retrySummary.cancelled })}</p>
                      )}
                      {retrySummary.failed.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-rose-500">{t("platformMisc.runs.emailRetryFailedCount", { count: retrySummary.failed.length })}</p>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {retrySummary.failed.map((f, i) => (
                              <p key={i} className="text-[9px] text-[var(--text-secondary)]">• {f.name || t("platformMisc.runs.emailFallback")} — {f.error}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      <button onClick={() => setRetrySummary(null)} className="w-full py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase">{t("platformMisc.runs.done")}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

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
                    {/* Direct Link (Submission) */}
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

                    {/* Export Responses — structured Excel / PDF download */}
                    <div className="space-y-3 p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-2)]">
                      <div>
                        <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.exportTitle")}</h3>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                          {t("platformMisc.runs.exportDesc")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/api/run-export?id=${selectedRun.id}&format=xlsx`}
                          className="px-5 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase hover:bg-emerald-500/20 border border-emerald-500/30 transition-all"
                        >
                          {t("platformMisc.runs.exportExcel")}
                        </a>
                        <a
                          href={`/api/run-export?id=${selectedRun.id}&format=pdf`}
                          className="px-5 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase hover:bg-rose-500/20 border border-rose-500/30 transition-all"
                        >
                          {t("platformMisc.runs.exportPdf")}
                        </a>
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
                <button onClick={() => { setShowAssign(true); resetAssignModal(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase hover:brightness-110"><Plus className="w-3 h-3" /> {t("platformMisc.runs.add")}</button>
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
                        const targetName = a.target_name || (g ? g.name : c ? (c.name || c.email) : a.target_id);
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
                        <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.assignTo")}</label>
                        <p className="text-[10px] text-[var(--text-secondary)]">{t("platformMisc.runs.assignToHint")}</p>
                        <div className="space-y-2 pt-1">
                          {/* User */}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={assignTypes.user} onChange={() => toggleAssignType("user")} className="w-3.5 h-3.5 accent-[var(--brand-orange)]" />
                            <span className="text-[11px] font-bold text-[var(--text-primary)]">{t("platformMisc.runs.targetUser")}</span>
                          </label>
                          {assignTypes.user && (
                            <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] max-h-40">
                              <option value="">{t("platformMisc.runs.selectUser")}</option>
                              {contacts.map((c) => <option key={c.cid} value={c.cid}>{c.name || c.email || c.cid}</option>)}
                            </select>
                          )}

                          {/* Group */}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={assignTypes.group} onChange={() => toggleAssignType("group")} className="w-3.5 h-3.5 accent-[var(--brand-orange)]" />
                            <span className="text-[11px] font-bold text-[var(--text-primary)]">{t("platformMisc.runs.targetGroup")}</span>
                          </label>
                          {assignTypes.group && (
                            <div className="space-y-1">
                              <select value={assignGroupId} onChange={(e) => setAssignGroupId(e.target.value)} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
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
                                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroupInline(handleAssignWithGroup); }}
                                    placeholder={t("platformMisc.runs.groupNamePlaceholder")}
                                    className="flex-1 rounded-xl px-3 py-2 text-[11px] font-bold outline-none bg-primary border border-[var(--brand-orange)] text-[var(--text-primary)]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleCreateGroupInline(handleAssignWithGroup)}
                                    disabled={creatingGroup || !inlineGroupName.trim()}
                                    className="px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase disabled:opacity-40"
                                  >
                                    {creatingGroup ? "..." : t("platformMisc.runs.createAndAssign")}
                                  </button>
                                  <button type="button" onClick={() => { setShowInlineGroup(false); setInlineGroupName(""); }} className="p-2 text-[var(--text-secondary)] hover:text-rose-500"><X className="w-3 h-3" /></button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Program */}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={assignTypes.program} onChange={() => toggleAssignType("program")} className="w-3.5 h-3.5 accent-[var(--brand-orange)]" />
                            <span className="text-[11px] font-bold text-[var(--text-primary)]">{t("platformMisc.runs.targetProgram")}</span>
                          </label>
                          {assignTypes.program && (
                            <select value={assignProgramId} onChange={(e) => setAssignProgramId(e.target.value)} className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
                              <option value="">{t("platformMisc.runs.selectProgram")}</option>
                              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          )}

                          {/* Other (cohort / team / organization / all) */}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={assignTypes.other} onChange={() => toggleAssignType("other")} className="w-3.5 h-3.5 accent-[var(--brand-orange)]" />
                            <span className="text-[11px] font-bold text-[var(--text-primary)]">{t("platformMisc.runs.targetOther")}</span>
                          </label>
                          {assignTypes.other && (
                            <div className="flex gap-2 items-center">
                              <select value={assignOtherType} onChange={(e) => setAssignOtherType(e.target.value)} className="w-2/5 rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
                                {["cohort", "team", "organization", "all"].map((k) => <option key={k} value={k}>{t(TARGET_LABELS[k])}</option>)}
                              </select>
                              <input value={assignOtherId} onChange={(e) => setAssignOtherId(e.target.value)} className="flex-1 rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]" placeholder={t("platformMisc.runs.targetIdPlaceholder")} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2"><button onClick={() => { setShowAssign(false); resetAssignModal(); }} className="flex-1 btn btn-secondary">{t("platformMisc.runs.cancel")}</button><button onClick={handleAssign} disabled={saving} className="flex-1 btn btn-primary">{saving ? t("platformMisc.runs.adding") : t("platformMisc.runs.add")}</button></div>
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

          {/* ─── TEMPLATES TAB (run-level email overrides) ─── */}
          {detailTab === "templates" && (() => {
            const updateRunTemplate = (key, field, val) => {
              setRunTemplates((prev) => {
                const next = JSON.parse(JSON.stringify(prev || {}));
                if (!next[key]) next[key] = {};
                next[key][field] = val;
                return next;
              });
            };

            const saveRunTemplates = async () => {
              if (!selectedRun) return;
              setRunTplSaving(true);
              try {
                // Never persist empty template shells: an entry whose subject AND
                // body are both blank must fall through to the form template, not
                // shadow it at send time.
                const cleanedTemplates = Object.fromEntries(
                  Object.entries(runTemplates || {}).filter(([, t]) => {
                    const s = (t?.subject || "").trim();
                    const b = (t?.body || "").trim();
                    return s || b;
                  })
                );
                const res = await fetch("/api/platform/form-runs", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: selectedRun.id, settings: { ...(runSettings || {}), templates: cleanedTemplates } }),
                });
                const data = await res.json();
                if (data.success) {
                  setRunSettings(data.run.settings || {});
                  setSelectedRun({ ...selectedRun, settings: data.run.settings });
                  notify(t("platformMisc.runs.runTemplatesSaved"));
                } else {
                  notify(data.error || t("platformMisc.runs.runTemplatesSaveFailed"));
                }
              } catch (_) {
                notify(t("platformMisc.runs.runTemplatesSaveNetworkError"));
              }
              setRunTplSaving(false);
            };

            const personalizeRunTemplate = async (tKey, label) => {
              if (runPersonalizing) return;
              setRunPersonalizing(tKey);
              try {
                // Draft base: run-level draft first; when the run draft is empty,
                // personalize the form-level template (never the platform default
                // alone) so a designed template is improved, not replaced.
                const formTpl = runFormSettings?.automation?.templates?.[tKey] || {};
                const baseSubject = (runTemplates[tKey]?.subject || "").trim() || (formTpl.subject || "").trim();
                const baseBody = (runTemplates[tKey]?.body || "").trim() || (formTpl.body || "").trim();
                const res = await fetch("/api/platform/ai/personalize-template", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    template_key: tKey,
                    form_name: selectedRun?.name || "",
                    organization: "Future Studio",
                    existing_subject: baseSubject,
                    existing_body: baseBody,
                  }),
                });
                const data = await res.json();
                if (data.success) {
                  updateRunTemplate(tKey, "subject", data.subject);
                  updateRunTemplate(tKey, "body", data.body);
                  notify(t("platformMisc.forms.templatePersonalized", { label }));
                } else {
                  notify(data.error || t("platformMisc.forms.templatePersonalizeFailed"));
                }
              } catch (_) {
                notify(t("platformMisc.forms.templatePersonalizeNetworkError"));
              }
              setRunPersonalizing(null);
            };

            const RunTemplateEditor = ({ tKey, label, icon: Icon, desc, vars, current }) => (
              <div className="space-y-2 p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-cyan-400" />
                  <p className="text-[10px] font-black uppercase text-[var(--text-primary)]">{label}</p>
                  <button
                    type="button"
                    disabled={runPersonalizing === tKey}
                    onClick={() => personalizeRunTemplate(tKey, label)}
                    className="ml-auto px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[7px] font-black uppercase hover:bg-indigo-500/20 disabled:opacity-40 transition-all flex items-center gap-1"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    {runPersonalizing === tKey ? t("platformMisc.forms.templateWriting") : t("platformMisc.forms.templatePersonalize")}
                  </button>
                </div>
                <p className="text-[8px] text-[var(--text-secondary)]">{desc}</p>
                <div className="space-y-1">
                  <label className="text-[7px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.templateSubject")}</label>
                  <input
                    value={current.subject || ""}
                    onChange={(e) => updateRunTemplate(tKey, "subject", e.target.value)}
                    placeholder={t("platformMisc.runs.runTemplateEmptyHint")}
                    className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[7px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.forms.templateBody")}</label>
                  <textarea
                    value={current.body || ""}
                    onChange={(e) => updateRunTemplate(tKey, "body", e.target.value)}
                    rows={4}
                    placeholder={t("platformMisc.runs.runTemplateEmptyHint")}
                    className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-cyan-500 resize-y font-mono"
                  />
                </div>
                {vars && (
                  <p className="text-[7px] text-[var(--text-secondary)] italic">{t("platformMisc.forms.templateVariables", { vars: vars.join(", ") })}</p>
                )}
              </div>
            );

            return (
              <div className="space-y-6 max-w-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.runTemplatesTitle")}</h3>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">{t("platformMisc.runs.runTemplatesDesc")}</p>
                  </div>
                  <button onClick={saveRunTemplates} disabled={runTplSaving} className="px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase hover:brightness-110 disabled:opacity-40">
                    {runTplSaving ? t("platformMisc.runs.saving") : t("platformMisc.forms.templatesSave")}
                  </button>
                </div>

                <div className="space-y-3">
                  <RunTemplateEditor
                    tKey="approval"
                    label={t("platformMisc.forms.templateApprovalLabel")}
                    icon={CheckCircle2}
                    desc={t("platformMisc.runs.runTemplateApprovalDesc")}
                    vars={["name", "form_name", "score", "group_name", "organization"]}
                    current={runTemplates.approval || {}}
                  />
                  <RunTemplateEditor
                    tKey="activation"
                    label={t("platformMisc.forms.templateActivationLabel")}
                    icon={Key}
                    desc={t("platformMisc.runs.runTemplateActivationDesc")}
                    vars={["name", "organization", "activation_link"]}
                    current={runTemplates.activation || {}}
                  />
                  <RunTemplateEditor
                    tKey="existing_user"
                    label={t("platformMisc.forms.templateExistingUserLabel")}
                    icon={LogIn}
                    desc={t("platformMisc.runs.runTemplateExistingUserDesc")}
                    vars={["name", "organization", "login_url"]}
                    current={runTemplates.existing_user || {}}
                  />
                  <RunTemplateEditor
                    tKey="rejection"
                    label={t("platformMisc.forms.templateRejectionLabel")}
                    icon={XCircle}
                    desc={t("platformMisc.runs.runTemplateRejectionDesc")}
                    vars={["name", "form_name", "organization"]}
                    current={runTemplates.rejection || {}}
                  />
                </div>
              </div>
            );
          })()}
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

        {/* ─── MANUAL ADD RESPONDENT MODAL ─── */}
        {showManualAdd && (
          <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowManualAdd(false)}>
            <div className="w-full max-w-sm rounded-2xl bg-secondary border border-[var(--border-primary)] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.addRespondent")}</h3>
                <button onClick={() => setShowManualAdd(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-tertiary text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">{t("platformMisc.runs.addRespondentDesc")}</p>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.manualAddName")}</label>
                <input value={manualAddName} onChange={(e) => setManualAddName(e.target.value)} placeholder={t("platformMisc.runs.manualAddNamePlaceholder")} className="w-full px-3 py-2.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.manualAddEmail")}</label>
                <input type="email" value={manualAddEmail} onChange={(e) => setManualAddEmail(e.target.value)} placeholder={t("platformMisc.runs.manualAddEmailPlaceholder")} className="w-full px-3 py-2.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowManualAdd(false)} disabled={manualAdding} className="flex-1 btn btn-secondary">{t("platformMisc.runs.cancel")}</button>
                <button onClick={submitManualAdd} disabled={manualAdding} className="flex-1 btn btn-primary">{manualAdding ? t("platformMisc.runs.manualAdding") : t("platformMisc.runs.addRespondent")}</button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MESSAGE COMPOSER MODAL ─── */}
        {showMessageComposer && (
          <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowMessageComposer(false)}>
            <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-secondary border border-[var(--border-primary)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)] shrink-0">
                <div>
                  <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.messageSend")}</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t("platformMisc.runs.messageRecipients", { count: selectedIds.length })}</p>
                </div>
                <button onClick={() => setShowMessageComposer(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-tertiary transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X className="w-4 h-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messageResult ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-sm font-black text-emerald-400">{t("platformMisc.runs.messageSentTitle")}</p>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-1">{t("platformMisc.runs.messageRecipientsCount", { count: messageResult.recipients })}</p>
                      <p className="text-[10px] font-bold text-emerald-400 mt-1">{t("platformMisc.runs.messageSentCount", { count: messageResult.sent })}</p>
                      {messageResult.failed > 0 && <p className="text-[10px] font-bold text-rose-400 mt-1">{t("platformMisc.runs.messageFailedCount", { count: messageResult.failed })}</p>}
                    </div>
                    <button onClick={() => { setShowMessageComposer(false); setMessageResult(null); }} className="w-full py-2.5 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase">{t("platformMisc.runs.done")}</button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.messageSubject")}</label>
                      <input value={messageSubject} onChange={(e) => setMessageSubject(e.target.value)} placeholder="Enter subject..." className="w-full px-3 py-2.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.messageBody")}</label>
                      <textarea value={messageBody} onChange={(e) => setMessageBody(e.target.value)} rows={6} placeholder="Enter message..." className="w-full px-3 py-2.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[11px] font-medium text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-y" />
                    </div>
                    <button
                      onClick={personalizeMessage}
                      disabled={aiPersonalizing}
                      className="px-3 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[9px] font-black uppercase hover:bg-purple-500/20 disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3" /> {aiPersonalizing ? t("platformMisc.runs.messagePersonalizing") : t("platformMisc.runs.messageAiPersonalize")}
                    </button>
                  </>
                )}
              </div>

              {!messageResult && (
                <div className="flex gap-3 px-6 py-4 border-t border-[var(--border-primary)] bg-secondary shrink-0">
                  <button onClick={() => setShowMessageComposer(false)} className="flex-1 btn btn-secondary">{t("platformMisc.runs.cancel")}</button>
                  <button onClick={sendManualMessages} disabled={messageSending || selectedIds.length === 0} className="flex-1 btn btn-primary">{messageSending ? t("platformMisc.runs.messageSending") : t("platformMisc.runs.messageSendTo", { count: selectedIds.length })}</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── EXPORT OPTIONS MODAL ─── */}
        {showExportOptions && (
          <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowExportOptions(false)}>
            <div className="w-full max-w-sm rounded-2xl bg-secondary border border-[var(--border-primary)] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.exportTitle")}</h3>
                <button onClick={() => setShowExportOptions(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-tertiary text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.exportFormat")}</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)] cursor-pointer">
                    <input type="radio" name="exportFormat" checked={exportFormat === "csv"} onChange={() => setExportFormat("csv")} className="accent-[var(--brand-orange)]" /> {t("platformMisc.runs.exportCsv")}
                  </label>
                  <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)] cursor-pointer">
                    <input type="radio" name="exportFormat" checked={exportFormat === "xlsx"} onChange={() => setExportFormat("xlsx")} className="accent-[var(--brand-orange)]" /> {t("platformMisc.runs.exportXlsx")}
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runs.exportScope")}</label>
                <div className="space-y-1.5">
                  {selectedIds.length > 0 && (
                    <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)] cursor-pointer">
                      <input type="radio" name="exportScope" checked={exportScope === "selected"} onChange={() => setExportScope("selected")} className="accent-[var(--brand-orange)]" /> {t("platformMisc.runs.exportSelected", { count: selectedIds.length })}
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)] cursor-pointer">
                    <input type="radio" name="exportScope" checked={exportScope === "filtered"} onChange={() => setExportScope("filtered")} className="accent-[var(--brand-orange)]" /> {t("platformMisc.runs.exportFiltered", { count: visibleSubmissions.length })}
                  </label>
                </div>
              </div>
              <button
                onClick={() => exportParticipants(exportFormat, exportScope)}
                className="w-full py-2.5 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase"
              >
                {t("platformMisc.runs.exportAction")}
              </button>
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
        <RunsTable runs={runs} search={search} statusFilter={statusFilter} sortField={sortField} sortDir={sortDir} page={page} perPage={perPage} total={totalRuns} onSort={(f, d) => { setSortField(f); setSortDir(d); setPage(1); }} onPage={setPage} openRun={openRun} groups={groups} onArchive={handleArchiveRun} onRestore={handleRestoreRun} />
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
