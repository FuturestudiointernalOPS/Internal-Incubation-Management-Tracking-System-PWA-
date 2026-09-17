"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
ArrowLeft, Loader2, AlertCircle, CheckCircle2, Calendar, Clock,
  Flag, BarChart3, RefreshCw, Target, Route,
} from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.


const pickVenture = (d) => (d?.success ? d.venture || null : null);
const pickPayload = (d) => (d?.success ? d : null);
const pickProgress = (d) => (d?.success ? d.progress : null);
const pickJourneyReport = (d) =>
  d?.success ? d.journey_report || null : null;
import { useI18n } from "@/lib/i18n";
import {
  MILESTONE_STATUSES,
  stageStatusWord,
  milestoneStatusWord,
  statusLabel,
  statusChipClass,
} from "@/lib/ventureStatuses";

const ROW_COLORS = {
  milestone: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
  task: { bg: "bg-[var(--brand-orange)]/10", text: "text-[var(--brand-orange)]", border: "border-[var(--brand-orange)]/20" },
  deliverable: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
};

const STATUS_COLORS = {
  completed: "bg-emerald-500", done: "bg-emerald-500", approved: "bg-emerald-500",
  in_progress: "bg-amber-500", review: "bg-purple-500",
  delayed: "bg-rose-500", blocked: "bg-rose-500",
  backlog: "bg-slate-500", todo: "bg-blue-500", pending: "bg-slate-500",
  cancelled: "bg-slate-500/30",
};

export default function VentureTimelinePage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [view, setView] = useState("gantt"); // gantt | timeline | progress
  const [zoom, setZoom] = useState("week"); // day | week | month
  // Snapshot the clock once per render — reading it mid-render is impure.
  const [now] = useState(() => Date.now());

  // Roadmap view state — the journey report is fetched on demand only, never
  // as part of the `view=` requests above (see the effect below fetchAll).

  // The venture and its three timeline views, through the shared hook: it owns the
  // cache, the cache-first paint and the discarding of a stale answer, so the page
  // keeps no copy of its own and reads its data during render.
  const { data: venture, loading: ventureLoading } = useApi(
    id ? `/api/ventures/${id}` : null,
    { defaultValue: null, transform: pickVenture, deps: [id] },
  );
  const { data: data, loading: dataLoading, refresh: refreshGantt } = useApi(
    id ? `/api/ventures/${id}/timeline?view=gantt` : null,
    { defaultValue: null, transform: pickPayload, deps: [id] },
  );
  const { data: progress, loading: progressLoading } = useApi(
    id ? `/api/ventures/${id}/timeline?view=progress` : null,
    { defaultValue: null, transform: pickProgress, deps: [id] },
  );
  const { data: delays, loading: delaysLoading } = useApi(
    id ? `/api/ventures/${id}/timeline?view=delay` : null,
    { defaultValue: null, transform: pickPayload, deps: [id] },
  );

  const loading =
    ventureLoading || dataLoading || progressLoading || delaysLoading;

  // Roadmap view only: the journey report loads when the view is selected, and
  // again on a later visit (the ref clears once another view is active). It is
  // deliberately independent of the `view=` fetches above, so the three
  // existing views are never affected — a failure degrades to the empty state.
  // The roadmap view's own read. It is addressed only while that view is selected,
  // which is what the effect this replaces expressed with a ref recording that it
  // had already asked once for this visit - an address that says when to read needs
  // no such record.
  const { data: journeyReport, loading: journeyLoading } = useApi(
    id && view === "roadmap" ? `/api/ventures/${id}/journey-report` : null,
    { defaultValue: null, transform: pickJourneyReport, deps: [id, view] },
  );

  if (loading) return (
    <>
      <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div>
    </>
  );

  const rows = data?.rows || [];
  const overdue = data?.overdue || [];

  // Calculate date range for Gantt
  let minDate = Infinity, maxDate = -Infinity;
  for (const r of rows) {
    if (r.start_date) { const d = new Date(r.start_date).getTime(); if (d < minDate) minDate = d; }
    if (r.end_date) { const d = new Date(r.end_date).getTime(); if (d > maxDate) maxDate = d; }
  }
  if (!isFinite(minDate)) minDate = now;
  if (maxDate < 0 || !isFinite(maxDate)) maxDate = minDate + 30 * 86400000;
  const rangeMs = maxDate - minDate;
  const rangeDays = Math.max(rangeMs / 86400000, 14);

  const getX = (date) => {
    if (!date) return 0;
    const pct = (new Date(date).getTime() - minDate) / (maxDate - minDate);
    return Math.max(0, Math.min(100, pct * 100));
  };
  const getWidth = (start, end) => {
    if (!start && !end) return 0;
    const s = start ? new Date(start).getTime() : minDate;
    const e = end ? new Date(end).getTime() : maxDate;
    return Math.max(3, ((e - s) / (maxDate - minDate)) * 100);
  };

  const progressBar = (pct) => (
    <div className="w-full bg-tertiary rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-[var(--brand-orange)]"}`}
        style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );

  const overview = (label, value, color = "text-[var(--text-primary)]") => (
    <div className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
    </div>
  );

  // Roadmap wording — ONE vocabulary, shared with the Venture Manager panel and
  // the founder's journey tab (lib/ventureStatuses). Never a second opinion.
  const journeyStatusLabel = (status) => statusLabel(stageStatusWord(status), t);

  const journeyStatusPill = (status) => statusChipClass(stageStatusWord(status));

  const milestoneStatusLabel = (status) => statusLabel(milestoneStatusWord(status), t);

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-[var(--brand-orange)]" /> Project Timeline
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name || ""}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-tertiary rounded-xl border border-[var(--border-primary)] p-0.5">
              {["gantt", "progress", "delay"].map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${view === v ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]" : "text-slate-500 hover:text-[var(--text-primary)]"}`}>
                  {v === "gantt" ? "Gantt" : v === "progress" ? "Progress" : "Delays"}
                </button>
              ))}
              <button onClick={() => setView("roadmap")}
                className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${view === "roadmap" ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]" : "text-slate-500 hover:text-[var(--text-primary)]"}`}>
                {t("vadmin.reports.tabJourney")}
              </button>
            </div>
            <button onClick={() => refreshGantt()} className="p-2 hover:bg-white/5 rounded-lg"><RefreshCw className="w-4 h-4 text-slate-500" /></button>
          </div>
        </div>

        {/* Progress Overview Cards */}
        {progress && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {overview("Overall", `${progress.overall}%`, progress.overall >= 80 ? "text-emerald-400" : progress.overall >= 40 ? "text-amber-400" : "text-[var(--brand-orange)]")}
            {overview("Milestones", `${progress.milestones?.done || 0}/${progress.milestones?.total || 0}`)}
            {overview("Tasks", `${progress.tasks?.done || 0}/${progress.tasks?.total || 0}`)}
            {overview("Deliverables", `${progress.deliverables?.done || 0}/${progress.deliverables?.total || 0}`)}
            {overview("Delayed", progress.delayed || 0, progress.delayed > 0 ? "text-rose-400" : "text-emerald-400")}
          </div>
        )}

        {/* Overall Progress Bar */}
        {progress && (
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Overall Project Progress</span>
              <span className="text-xs font-black text-[var(--text-primary)]">{progress.overall}%</span>
            </div>
            {progressBar(progress.overall)}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <div className="flex items-center justify-between text-[8px] text-slate-500 mb-1"><span>Milestones</span><span>{progress.milestones?.done || 0}/{progress.milestones?.total || 0}</span></div>
                {progressBar(progress.milestones?.total > 0 ? (progress.milestones.done / progress.milestones.total) * 100 : 0)}
              </div>
              <div>
                <div className="flex items-center justify-between text-[8px] text-slate-500 mb-1"><span>Tasks</span><span>{progress.tasks?.done || 0}/{progress.tasks?.total || 0}</span></div>
                {progressBar(progress.tasks?.total > 0 ? (progress.tasks.done / progress.tasks.total) * 100 : 0)}
              </div>
              <div>
                <div className="flex items-center justify-between text-[8px] text-slate-500 mb-1"><span>Deliverables</span><span>{progress.deliverables?.done || 0}/{progress.deliverables?.total || 0}</span></div>
                {progressBar(progress.deliverables?.total > 0 ? (progress.deliverables.done / progress.deliverables.total) * 100 : 0)}
              </div>
            </div>
          </div>
        )}

        {/* Gantt Chart View */}
        {view === "gantt" && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gantt Chart</h3>
              <div className="flex gap-1 bg-tertiary rounded-lg p-0.5">
                {["day", "week", "month"].map((z) => (
                  <button key={z} onClick={() => setZoom(z)}
                    className={`px-2 py-1 rounded text-[7px] font-black uppercase tracking-wider ${zoom === z ? "bg-primary text-[var(--text-primary)]" : "text-slate-500"}`}>{z}</button>
                ))}
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="text-center py-12"><BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">No timeline data yet. Create milestones and tasks first.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <div style={{ minWidth: "600px" }}>
                  {/* Gantt Header (date axis) */}
                  <div className="flex border-b border-[var(--border-primary)] pb-2 mb-2">
                    <div className="w-48 shrink-0" />
                    <div className="flex-1 relative h-6">
                      {Array.from({ length: Math.ceil(rangeDays / 7) }).map((_, i) => {
                        const left = (i * 7 / rangeDays) * 100;
                        return (
                          <div key={i} className="absolute top-0 text-[7px] text-slate-500 font-bold"
                            style={{ left: `${left}%` }}>
                            {new Date(minDate + i * 7 * 86400000).toLocaleDateString()}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Gantt Rows */}
                  <div className="space-y-1">
                    {rows.map((row) => {
                      const colors = ROW_COLORS[row.type] || ROW_COLORS.task;
                      const left = getX(row.start_date);
                      const width = getWidth(row.start_date, row.end_date);
                      const isOverdue = overdue.some((o) => o.id === row.id);
                      return (
                        <div key={row.id} className="flex items-center gap-2 py-1.5">
                          <div className="w-48 shrink-0 flex items-center gap-2 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.bg} shrink-0`} />
                            <span className="text-[9px] font-bold text-[var(--text-primary)] truncate">{row.title}</span>
                            <span className={`text-[6px] font-black uppercase px-1 py-0.5 rounded ${colors.bg} ${colors.text} shrink-0`}>{row.type}</span>
                            {isOverdue && <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />}
                          </div>
                          <div className="flex-1 relative h-6 bg-tertiary rounded">
                            {row.start_date && (
                              <div className={`absolute top-0.5 h-5 rounded ${STATUS_COLORS[row.status] || "bg-slate-500"} opacity-80`}
                                style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}>
                                <div className="h-full rounded bg-white/20" style={{ width: `${row.progress}%` }} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress View */}
        {view === "progress" && (
          <div className="card">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">All Timeline Items</h3>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No items tracked</p>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => {
                  const colors = ROW_COLORS[row.type] || ROW_COLORS.task;
                  const isOverdue = overdue.some((o) => o.id === row.id);
                  return (
                    <div key={row.id} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full ${colors.bg}`} />
                          <span className="text-xs font-bold text-[var(--text-primary)] truncate">{row.title}</span>
                          <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>{row.type}</span>
                          {row.status && <span className="text-[7px] text-slate-500 capitalize">{row.status.replace(/_/g, " ")}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[9px] font-bold">{row.progress}%</span>
                          {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                        </div>
                      </div>
                      {progressBar(row.progress)}
                      <div className="flex items-center gap-3 mt-2 text-[8px] text-slate-500">
                        {row.start_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Start: {new Date(row.start_date).toLocaleDateString()}</span>}
                        {row.end_date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Due: {new Date(row.end_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Delay Detection View */}
        {view === "delay" && (
          <div className="space-y-6">
            {/* Overdue Tasks */}
            <div className="card">
              <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" /> Overdue Tasks ({delays?.overdue_tasks?.length || 0})
              </h3>
              {(delays?.overdue_tasks || []).length === 0 ? (
                <p className="text-[10px] text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> No overdue tasks</p>
              ) : (
                <div className="space-y-2">
                  {delays.overdue_tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-rose-500/5 rounded-xl border border-rose-500/20">
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">{t.title}</span>
                      <span className="text-[8px] text-rose-400">Due: {new Date(t.due_date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delayed Milestones */}
            <div className="card">
              <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Flag className="w-3.5 h-3.5" /> Delayed Milestones ({delays?.delayed_milestones?.length || 0})
              </h3>
              {(delays?.delayed_milestones || []).length === 0 ? (
                <p className="text-[10px] text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> All milestones on track</p>
              ) : (
                <div className="space-y-2">
                  {delays.delayed_milestones.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-rose-500/5 rounded-xl border border-rose-500/20">
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">{m.title}</span>
                      <span className="text-[8px] text-rose-400">Due: {new Date(m.due_date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Deadlines (7 days) */}
            <div className="card">
              <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> Upcoming Deadlines (next 7 days) ({delays?.upcoming_deadlines?.length || 0})
              </h3>
              {(delays?.upcoming_deadlines || []).length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No upcoming deadlines this week</p>
              ) : (
                <div className="space-y-2">
                  {delays.upcoming_deadlines.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-amber-500/5 rounded-xl border border-amber-500/20">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${item.type === "milestone" ? "bg-indigo-400" : "bg-[var(--brand-orange)]"}`} />
                        <span className="text-[10px] font-bold text-[var(--text-primary)]">{item.title}</span>
                        <span className="text-[7px] text-slate-500 uppercase">{item.type}</span>
                      </div>
                      <span className="text-[8px] text-amber-400">{new Date(item.due_date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Blocked Items */}
            {progress?.blocked > 0 && (
              <div className="card">
                <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Target className="w-3.5 h-3.5" /> Blocked Items ({progress.blocked})
                </h3>
                <p className="text-[10px] text-slate-500">{progress.blocked} task(s) currently blocked</p>
              </div>
            )}
          </div>
        )}

        {/* Roadmap View — the Venture's defined progression (read-only) */}
        {view === "roadmap" && (
          <div className="space-y-6">
            {journeyLoading && !journeyReport ? (
              <div className="card flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
              </div>
            ) : !journeyReport || (journeyReport.stages || []).length === 0 ? (
              <div className="card text-center py-12">
                <Route className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">{t("vadmin.timeline.noDataYet")}</p>
              </div>
            ) : (() => {
              const jp = journeyReport.journey_progression || {};
              const stages = journeyReport.stages || [];
              const taskCompletion = journeyReport.task_completion || {};
              const milestonesByStatus = journeyReport.milestones_by_status || {};
              const milestonesDone = stages.reduce((n, s) => n + (s.milestones?.completed || 0), 0);
              const milestonesTotal = stages.reduce((n, s) => n + (s.milestones?.total || 0), 0);
              const awaitingDeliverables = journeyReport.deliverables_awaiting_review || 0;
              const upcomingSessions = journeyReport.sessions?.upcoming || 0;
              const responsibilities = journeyReport.support?.responsibilities || [];
              const shownStatuses = MILESTONE_STATUSES.filter((s) => milestonesByStatus[s] > 0);
              return (
                <>
                  {/* Summary — what the operating report already computes */}
                  <div className="card">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{t("vadmin.reports.journeyProgression")}</h3>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-[var(--text-primary)]">
                        {t("vadmin.reports.journeyCompleteOf", { done: jp.completed || 0, total: jp.total || 0 })}
                        <span className="text-slate-500"> · {jp.progress_pct || 0}%</span>
                      </p>
                    </div>
                    {progressBar(jp.progress_pct || 0)}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
                      {overview(t("vadmin.reports.tabJourney"), `${jp.completed || 0}/${jp.total || 0}`)}
                      {overview(t("vadmin.reports.milestones"), `${milestonesDone}/${milestonesTotal}`)}
                      {overview(t("vadmin.reports.tasks"), `${taskCompletion.completed || 0}/${taskCompletion.total || 0}`)}
                      {overview(t("venture.attention.awaitingDeliverables"), awaitingDeliverables, awaitingDeliverables > 0 ? "text-amber-400" : "text-[var(--text-primary)]")}
                      {overview(t("vadmin.reports.upcomingSessions"), upcomingSessions)}
                      {overview(t("vadmin.reports.support"), responsibilities.length)}
                    </div>
                  </div>

                  {/* Journeys — in the order defined on the roadmap */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("venture.manager.stagesCount", { count: stages.length })}</h3>
                      <span className="text-[9px] font-bold text-slate-500">{t("vadmin.reports.milestonesFraction", { done: milestonesDone, total: milestonesTotal })}</span>
                    </div>
                    <div className="space-y-3">
                      {stages.map((st, i) => (
                        <div key={st.id} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[9px] font-black text-slate-500">{String(i + 1).padStart(2, "0")}</span>
                              <span className="text-xs font-bold text-[var(--text-primary)]">{st.name}</span>
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${journeyStatusPill(st.status)}`}>{journeyStatusLabel(st.status)}</span>
                            </div>
                            <span className="text-[9px] font-bold text-slate-500 shrink-0">
                              {t("vadmin.reports.milestonesFraction", { done: st.milestones?.completed || 0, total: st.milestones?.total || 0 })} · {st.milestones?.progress_pct || 0}%
                            </span>
                          </div>
                          {progressBar(st.milestones?.progress_pct || 0)}
                          {(st.target_date || st.completed_at) && (
                            <div className="flex items-center gap-3 mt-2 text-[8px] text-slate-500">
                              {st.target_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{t("venture.manager.targetDate", { date: new Date(st.target_date).toLocaleDateString() })}</span>}
                              {st.completed_at && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{t("venture.manager.completedOn", { date: new Date(st.completed_at).toLocaleDateString() })}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Milestone states — the roadmap's milestone breakdown */}
                  {shownStatuses.length > 0 && (
                    <div className="card">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{t("venture.manager.irMilestones")}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {shownStatuses.map((s) => (
                          <React.Fragment key={s}>{overview(milestoneStatusLabel(s), milestonesByStatus[s])}</React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}
