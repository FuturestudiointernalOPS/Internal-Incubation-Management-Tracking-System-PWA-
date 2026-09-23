"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Download,
  BarChart3, RefreshCw, TrendingUp, Users, Target, Activity, Route,
} from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { stageStatusWord, statusLabel, statusChipClass } from "@/lib/ventureStatuses";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_LIST = [];

const pickVenture = (payload) => (payload?.success ? payload.venture || null : null);
const pickPayload = (payload) => (payload?.success ? payload : null);
const pickMilestones = (payload) => (payload?.success ? payload.milestones || [] : []);
const pickTasks = (payload) => (payload?.success ? payload.tasks || [] : []);
const pickTeam = (payload) => (payload?.success ? payload.team || [] : []);

// The journey progression report degrades gracefully: the screen distinguishes
// "the read failed" from "there is no report yet", which is why the failure
// travels beside the report rather than collapsing into a null report.
const EMPTY_JOURNEY_REPORT = { report: null, failed: false };
const pickJourneyReport = (payload) => ({
  report: payload?.success ? payload.journey_report || null : null,
  failed: !payload?.success,
});

export default function VentureReportsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("overview");

  // The Venture and its four report views, plus the journey progression report,
  // through the shared hook: it owns the cache, the cache-first paint and the
  // discarding of a stale answer, so the page keeps no copy of its own and reads
  // during render. Separate reads keep the Venture identifier a plain dependency
  // rather than a list rebuilt on every render.
  const {
    data: venture,
    loading: ventureLoading,
    refresh: refreshVenture,
  } = useApi(id ? `/api/ventures/${id}` : null, {
    defaultValue: null,
    transform: pickVenture,
    deps: [id],
  });
  const { data: data, loading: dataLoading, refresh: refreshData } = useApi(
    id ? `/api/ventures/${id}/reports?type=analytics` : null,
    { defaultValue: null, transform: pickPayload, deps: [id] },
  );
  const {
    data: milestones,
    loading: milestonesLoading,
    refresh: refreshMilestones,
  } = useApi(id ? `/api/ventures/${id}/reports?type=milestones` : null, {
    defaultValue: EMPTY_LIST,
    transform: pickMilestones,
    deps: [id],
  });
  const { data: tasks, loading: tasksLoading, refresh: refreshTasks } = useApi(
    id ? `/api/ventures/${id}/reports?type=tasks&limit=50` : null,
    { defaultValue: EMPTY_LIST, transform: pickTasks, deps: [id] },
  );
  const { data: team, loading: teamLoading, refresh: refreshTeam } = useApi(
    id ? `/api/ventures/${id}/reports?type=productivity` : null,
    { defaultValue: EMPTY_LIST, transform: pickTeam, deps: [id] },
  );
  const {
    data: journeyPayload,
    loading: jrLoading,
    refresh: refreshJourneyReport,
  } = useApi(id ? `/api/ventures/${id}/journey-report` : null, {
    defaultValue: EMPTY_JOURNEY_REPORT,
    transform: pickJourneyReport,
    deps: [id],
  });
  const journeyReport = journeyPayload.report;
  const jrError = journeyPayload.failed;

  const loading =
    ventureLoading || dataLoading || milestonesLoading || tasksLoading || teamLoading;

  // The header's refresh button re-reads every view on show rather than only the
  // one that happens to be open.
  const refreshAll = () => {
    refreshVenture();
    refreshData();
    refreshMilestones();
    refreshTasks();
    refreshTeam();
    refreshJourneyReport();
  };

  const handleExport = async (format) => {
    try {
      const response = await fetch(`/api/ventures/${id}/reports?type=export&format=${format}&export_type=tasks`);
      if (format === "csv") {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url; link.download = `venture-tasks-${id}.csv`; link.click();
        URL.revokeObjectURL(url);
      } else {
        const payload = await response.json();
        console.log("Export data:", payload);
      }
    } catch {}
  };

  const kpiCard = (label, value, sub, color = "text-[var(--text-primary)]") => (
    <div className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-black mt-1 ${typeof value === "number" && value > 0 && label.includes("Overdue") ? "text-rose-400" : color}`}>{value}</p>
      {sub && <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{sub}</p>}
    </div>
  );

  const progressBar = (pct) => (
    <div className="w-full bg-tertiary rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-[var(--brand-orange)]"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );

  // ONE vocabulary, shared with the timeline, the Venture Manager panel and the
  // founder's journey tab (lib/ventureStatuses): Locked / In Progress / Completed.
  const stageStatusLabel = (status) => statusLabel(stageStatusWord(status), t);

  const journeyStagePill = (status) => statusChipClass(stageStatusWord(status));

  if (loading) return (
    <>
      <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div>
    </>
  );

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}`)}
              className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-[var(--brand-orange)]" /> Reports & Analytics
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{venture?.company_name || ""}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleExport("csv")} className="px-3 py-2 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wider hover:bg-tertiary transition-all flex items-center gap-1.5">
              <Download className="w-3 h-3" /> CSV
            </button>
            <button onClick={refreshAll} className="px-3 py-2 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wider hover:bg-tertiary transition-all flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {[
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "kpis", label: "KPIs", icon: TrendingUp },
            { id: "milestones", label: "Milestones", icon: Target },
            { id: "tasks", label: "Tasks", icon: Activity },
            { id: "team", label: "Productivity", icon: Users },
            { id: "journey", label: t("vadmin.reports.tabJourney"), icon: Route },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all border-b-2 ${
                  activeTab === tab.id ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}>
                <Icon className="w-3 h-3" />{tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPIs Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpiCard("Completion", `${kpis.overall_completion || 0}%`, "", kpis.overall_completion >= 80 ? "text-emerald-400" : "text-amber-400")}
              {kpiCard("Health Score", `${kpis.health_score || 0}%`, "", kpis.health_score >= 70 ? "text-emerald-400" : kpis.health_score >= 40 ? "text-amber-400" : "text-rose-400")}
              {kpiCard("Productivity", `${kpis.productivity_score || 0}%`, "", kpis.productivity_score >= 70 ? "text-emerald-400" : "text-amber-400")}
              {kpiCard("On-Time", `${kpis.on_time_delivery || 0}%`, "", kpis.on_time_delivery >= 80 ? "text-emerald-400" : "text-amber-400")}
              {kpiCard("Tasks Done", kpis.tasks_completed || 0, `${kpis.tasks_pending || 0} pending`)}
              {kpiCard("Overdue", kpis.tasks_overdue || 0, "tasks", kpis.tasks_overdue > 0 ? "text-rose-400" : "text-emerald-400")}
              {kpiCard("Avg Completion", `${kpis.avg_completion_days || 0}d`, "per task")}
              {kpiCard("Milestones Done", kpis.milestones_completed || 0, "")}
            </div>

            {/* Overall Progress */}
            <div className="card">
              <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-3">Overall Completion</h3>
              {progressBar(kpis.overall_completion || 0)}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mb-1"><span>Milestones</span><span>{charts.completion_breakdown?.milestones || 0}%</span></div>
                  {progressBar(charts.completion_breakdown?.milestones || 0)}
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mb-1"><span>Tasks</span><span>{charts.completion_breakdown?.tasks || 0}%</span></div>
                  {progressBar(charts.completion_breakdown?.tasks || 0)}
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mb-1"><span>Deliverables</span><span>{charts.completion_breakdown?.deliverables || 0}%</span></div>
                  {progressBar(charts.completion_breakdown?.deliverables || 0)}
                </div>
              </div>
            </div>

            {/* Activity Trend (last 30 days) */}
            {(charts.activity_trend_30d || []).length > 0 && (
              <div className="card">
                <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-3">Activity Trend (30 days)</h3>
                <div className="flex items-end gap-1 h-24">
                  {charts.activity_trend_30d.slice(-14).map((day, index) => {
                    const maxH = Math.max(...charts.activity_trend_30d.map((point) => point.total), 1);
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full bg-emerald-500/30 rounded-t" style={{ height: `${(day.completed / maxH) * 100}%` }} />
                        <div className="w-full bg-[var(--brand-orange)]/30 rounded-t" style={{ height: `${(day.created / maxH) * 100}%` }} />
                        <span className="text-[10px] text-[var(--text-secondary)] mt-0.5">{day.date?.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* KPIs Tab */}
        {activeTab === "kpis" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiCard("Overall Completion", `${kpis.overall_completion || 0}%`)}
            {kpiCard("Health Score", `${kpis.health_score || 0}%`)}
            {kpiCard("Productivity Score", `${kpis.productivity_score || 0}%`)}
            {kpiCard("On-Time Delivery", `${kpis.on_time_delivery || 0}%`)}
            {kpiCard("Tasks Completed", kpis.tasks_completed || 0)}
            {kpiCard("Tasks Pending", kpis.tasks_pending || 0)}
            {kpiCard("Tasks Overdue", kpis.tasks_overdue || 0, "", "text-rose-400")}
            {kpiCard("Blocked Tasks", kpis.blocked_count || 0, "", "text-rose-400")}
            {kpiCard("Milestones Completed", kpis.milestones_completed || 0)}
            {kpiCard("Delayed Milestones", kpis.delayed_count || 0, "", "text-rose-400")}
            {kpiCard("Avg Completion Time", `${kpis.avg_completion_days || 0} days`)}
            {kpiCard("Task Status", `${(kpis.tasks_completed || 0) + (kpis.tasks_pending || 0)} total`)}
          </div>
        )}

        {/* Milestones Tab */}
        {activeTab === "milestones" && (
          <div className="card">
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-4">All Milestones</h3>
            {milestones.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] text-center py-8">No milestones</p>
            ) : (
              <div className="space-y-3">
                {milestones.map((milestone) => (
                  <div key={milestone.id} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)]">{milestone.title}</span>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          milestone.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                          milestone.status === "in_progress" ? "bg-amber-500/10 text-amber-400" :
                          milestone.status === "delayed" ? "bg-rose-500/10 text-rose-400" :
                          "bg-slate-500/10 text-slate-500"
                        }`}>{milestone.status?.replace(/_/g, " ")}</span>
                      </div>
                      <span className="text-[9px] font-bold">{milestone.completion_percentage || 0}%</span>
                    </div>
                    {progressBar(milestone.completion_percentage || 0)}
                    <div className="flex gap-4 mt-2 text-[10px] text-[var(--text-secondary)]">
                      <span>Deliverables: {milestone.del_done || 0}/{milestone.del_total || 0}</span>
                      <span>Tasks: {milestone.task_done || 0}/{milestone.task_total || 0}</span>
                      {milestone.due_date && <span>Due: {new Date(milestone.due_date).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === "tasks" && (
          <div className="card">
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-4">Recent Tasks</h3>
            {tasks.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] text-center py-8">No tasks</p>
            ) : (
              <div className="space-y-1">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      task.status === "done" ? "bg-emerald-500" : task.status === "blocked" ? "bg-rose-500" :
                      task.status === "in_progress" ? "bg-amber-500" : "bg-slate-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{task.title}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">{task.assigned_name || "Unassigned"} {task.milestone_title ? `· ${task.milestone_title}` : ""}</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      task.priority === "critical" ? "bg-rose-500/10 text-rose-400" :
                      task.priority === "high" ? "bg-amber-500/10 text-amber-400" :
                      "bg-slate-500/10 text-slate-500"
                    }`}>{task.priority}</span>
                    <span className="text-[10px] text-[var(--text-secondary)] capitalize">{task.status?.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Team Productivity Tab */}
        {activeTab === "team" && (
          <div className="card">
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-4">Team Productivity</h3>
            {team.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] text-center py-8">No team data</p>
            ) : (
              <div className="space-y-4">
                {team.map((teamMember, index) => (
                  <div key={index} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-[10px] font-black text-[var(--brand-orange)]">
                          {teamMember.name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[var(--text-primary)]">{teamMember.name || "Unnamed"}</p>
                          <p className="text-[10px] text-[var(--text-secondary)]">{teamMember.completed}/{teamMember.total_tasks} tasks done</p>
                        </div>
                      </div>
                      <span className="text-lg font-black text-[var(--brand-orange)]">{teamMember.completion_rate || 0}%</span>
                    </div>
                    {progressBar(teamMember.completion_rate || 0)}
                    <div className="flex gap-3 mt-2 text-[10px] text-[var(--text-secondary)]">
                      <span>📊 {teamMember.total_tasks} tasks</span>
                      {teamMember.blocked > 0 && <span className="text-rose-400">🚫 {teamMember.blocked} blocked</span>}
                      {teamMember.overdue > 0 && <span className="text-rose-400">⏰ {teamMember.overdue} overdue</span>}
                      <span>⏱ {teamMember.total_estimated || 0}h estimated</span>
                    </div>
                  </div>
                ))}
                {/* Workload distribution bar */}
                <div className="mt-4">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Workload Distribution</p>
                  {team.map((teamMember, index) => {
                    const total = team.reduce((sum, member) => sum + member.total_tasks, 1);
                    const pct = (teamMember.total_tasks / total) * 100;
                    return (
                      <div key={index} className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] w-24 truncate">{teamMember.name}</span>
                        <div className="flex-1 bg-tertiary rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[var(--brand-orange)] to-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-[var(--text-secondary)] w-8 text-right">{teamMember.total_tasks}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Journey Progression Tab */}
        {activeTab === "journey" && (
          <div className="card">
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-4">{t("vadmin.reports.journeyProgression")}</h3>
            {jrLoading && !journeyReport ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" /></div>
            ) : jrError ? (
              <p className="text-sm text-[var(--text-secondary)] text-center py-8">{t("vadmin.reports.journeyLoadFailed")}</p>
            ) : !journeyReport || (journeyReport.stages || []).length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] text-center py-8">{t("vadmin.reports.noJourneyData")}</p>
            ) : (() => {
              const jp = journeyReport.journey_progression || {};
              const overdueCount = (journeyReport.overdue || []).length;
              const upcomingSessions = journeyReport.sessions?.upcoming || 0;
              const responsibilities = journeyReport.support?.responsibilities || [];
              return (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-[var(--text-primary)]">
                      {t("vadmin.reports.journeyCompleteOf", { done: jp.completed || 0, total: jp.total || 0 })}
                      <span className="text-[var(--text-secondary)]"> · {jp.progress_pct || 0}%</span>
                    </p>
                  </div>
                  {progressBar(jp.progress_pct || 0)}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                    {kpiCard(t("vadmin.reports.kpiOverdue"), overdueCount)}
                    {kpiCard(t("vadmin.reports.upcomingSessions"), upcomingSessions)}
                    {kpiCard(t("vadmin.reports.support"), responsibilities.length, responsibilities.length ? responsibilities.join(", ") : "—")}
                  </div>
                  <div className="space-y-3 mt-6 pt-6 border-t border-[var(--border-primary)]">
                    {(journeyReport.stages || []).map((stage) => (
                      <div key={stage.id} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-[var(--text-primary)]">{stage.name}</span>
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${journeyStagePill(stage.status)}`}>{stageStatusLabel(stage.status)}</span>
                          </div>
                          <span className="text-[9px] font-bold text-[var(--text-secondary)] shrink-0">
                            {t("vadmin.reports.milestonesFraction", { done: stage.milestones?.completed || 0, total: stage.milestones?.total || 0 })} · {stage.milestones?.progress_pct || 0}%
                          </span>
                        </div>
                        {progressBar(stage.milestones?.progress_pct || 0)}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}
