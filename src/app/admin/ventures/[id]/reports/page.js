"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2, AlertTriangle, Download,
  BarChart3, RefreshCw, TrendingUp, Clock, Users, Target,Activity,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export default function VentureReportsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [venture, setVenture] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vRes, rRes, mRes, tRes, pRes] = await Promise.all([
        fetch(`/api/ventures/${id}`),
        fetch(`/api/ventures/${id}/reports?type=analytics`),
        fetch(`/api/ventures/${id}/reports?type=milestones`),
        fetch(`/api/ventures/${id}/reports?type=tasks&limit=50`),
        fetch(`/api/ventures/${id}/reports?type=productivity`),
      ]);
      const v = await vRes.json();
      const r = await rRes.json();
      const m = await mRes.json();
      const t = await tRes.json();
      const p = await pRes.json();
      if (v.success) setVenture(v.venture);
      if (r.success) setData(r);
      if (m.success) setMilestones(m.milestones || []);
      if (t.success) setTasks(t.tasks || []);
      if (p.success) setTeam(p.team || []);
    } catch {} finally { setLoading(false); }
  };

  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);

  const handleExport = async (format) => {
    try {
      const res = await fetch(`/api/ventures/${id}/reports?type=export&format=${format}&export_type=tasks`);
      if (format === "csv") {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `venture-tasks-${id}.csv`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const d = await res.json();
        console.log("Export data:", d);
      }
    } catch {}
  };

  const kpiCard = (label, value, sub, color = "text-[var(--text-primary)]") => (
    <div className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-black mt-1 ${typeof value === "number" && value > 0 && label.includes("Overdue") ? "text-rose-400" : color}`}>{value}</p>
      {sub && <p className="text-[8px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );

  const progressBar = (pct) => (
    <div className="w-full bg-tertiary rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-[var(--brand-orange)]"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );

  if (loading) return (
    <DashboardLayout role="super_admin">
      <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div>
    </DashboardLayout>
  );

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const summary = data?.summary || {};

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}/dashboard`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> {t("vadmin.reports.backToDashboard")}
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-[var(--brand-orange)]" /> {t("vadmin.reports.reportsAnalytics")}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name || ""}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleExport("csv")} className="px-3 py-2 rounded-xl border border-[var(--border-primary)] text-[8px] font-black uppercase tracking-wider hover:bg-tertiary transition-all flex items-center gap-1.5">
              <Download className="w-3 h-3" /> {t("vadmin.reports.exportCsv")}
            </button>
            <button onClick={fetchData} className="px-3 py-2 rounded-xl border border-[var(--border-primary)] text-[8px] font-black uppercase tracking-wider hover:bg-tertiary transition-all flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3" /> {t("vadmin.reports.refresh")}
            </button>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {[
            { id: "overview", label: t("vadmin.reports.tabOverview"), icon: BarChart3 },
            { id: "kpis", label: t("vadmin.reports.tabKpis"), icon: TrendingUp },
            { id: "milestones", label: t("vadmin.reports.tabMilestones"), icon: Target },
            { id: "tasks", label: t("vadmin.reports.tabTasks"), icon: Activity },
            { id: "team", label: t("vadmin.reports.tabProductivity"), icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all border-b-2 ${
                  activeTab === tab.id ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-slate-500 hover:text-[var(--text-primary)]"
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
              {kpiCard(t("vadmin.reports.kpiCompletion"), `${kpis.overall_completion || 0}%`, "", kpis.overall_completion >= 80 ? "text-emerald-400" : "text-amber-400")}
              {kpiCard(t("vadmin.reports.kpiHealthScore"), `${kpis.health_score || 0}%`, "", kpis.health_score >= 70 ? "text-emerald-400" : kpis.health_score >= 40 ? "text-amber-400" : "text-rose-400")}
              {kpiCard(t("vadmin.reports.kpiProductivity"), `${kpis.productivity_score || 0}%`, "", kpis.productivity_score >= 70 ? "text-emerald-400" : "text-amber-400")}
              {kpiCard(t("vadmin.reports.kpiOnTime"), `${kpis.on_time_delivery || 0}%`, "", kpis.on_time_delivery >= 80 ? "text-emerald-400" : "text-amber-400")}
              {kpiCard(t("vadmin.reports.kpiTasksDone"), kpis.tasks_completed || 0, t("vadmin.reports.tasksPending", { count: kpis.tasks_pending || 0 }))}
              {kpiCard(t("vadmin.reports.kpiOverdue"), kpis.tasks_overdue || 0, t("vadmin.reports.tasks"), kpis.tasks_overdue > 0 ? "text-rose-400" : "text-emerald-400")}
              {kpiCard(t("vadmin.reports.kpiAvgCompletion"), `${kpis.avg_completion_days || 0}d`, t("vadmin.reports.perTask"))}
              {kpiCard(t("vadmin.reports.kpiMilestonesDone"), kpis.milestones_completed || 0, "")}
            </div>

            {/* Overall Progress */}
            <div className="card">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t("vadmin.reports.overallCompletion")}</h3>
              {progressBar(kpis.overall_completion || 0)}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <div className="flex justify-between text-[8px] text-slate-500 mb-1"><span>{t("vadmin.reports.milestones")}</span><span>{charts.completion_breakdown?.milestones || 0}%</span></div>
                  {progressBar(charts.completion_breakdown?.milestones || 0)}
                </div>
                <div>
                  <div className="flex justify-between text-[8px] text-slate-500 mb-1"><span>{t("vadmin.reports.tasks")}</span><span>{charts.completion_breakdown?.tasks || 0}%</span></div>
                  {progressBar(charts.completion_breakdown?.tasks || 0)}
                </div>
                <div>
                  <div className="flex justify-between text-[8px] text-slate-500 mb-1"><span>{t("vadmin.reports.deliverables")}</span><span>{charts.completion_breakdown?.deliverables || 0}%</span></div>
                  {progressBar(charts.completion_breakdown?.deliverables || 0)}
                </div>
              </div>
            </div>

            {/* Activity Trend (last 30 days) */}
            {(charts.activity_trend_30d || []).length > 0 && (
              <div className="card">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t("vadmin.reports.activityTrend")}</h3>
                <div className="flex items-end gap-1 h-24">
                  {charts.activity_trend_30d.slice(-14).map((d, i) => {
                    const maxH = Math.max(...charts.activity_trend_30d.map((x) => x.total), 1);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full bg-emerald-500/30 rounded-t" style={{ height: `${(d.completed / maxH) * 100}%` }} />
                        <div className="w-full bg-[var(--brand-orange)]/30 rounded-t" style={{ height: `${(d.created / maxH) * 100}%` }} />
                        <span className="text-[6px] text-slate-500 mt-0.5">{d.date?.slice(5)}</span>
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
            {kpiCard(t("vadmin.reports.overallCompletion"), `${kpis.overall_completion || 0}%`)}
            {kpiCard(t("vadmin.reports.kpiHealthScore"), `${kpis.health_score || 0}%`)}
            {kpiCard(t("vadmin.reports.kpiProductivityScore"), `${kpis.productivity_score || 0}%`)}
            {kpiCard(t("vadmin.reports.kpiOnTimeDelivery"), `${kpis.on_time_delivery || 0}%`)}
            {kpiCard(t("vadmin.reports.kpiTasksCompleted"), kpis.tasks_completed || 0)}
            {kpiCard(t("vadmin.reports.kpiTasksPending"), kpis.tasks_pending || 0)}
            {kpiCard(t("vadmin.reports.kpiTasksOverdue"), kpis.tasks_overdue || 0, "", "text-rose-400")}
            {kpiCard(t("vadmin.reports.kpiBlockedTasks"), kpis.blocked_count || 0, "", "text-rose-400")}
            {kpiCard(t("vadmin.reports.kpiMilestonesCompleted"), kpis.milestones_completed || 0)}
            {kpiCard(t("vadmin.reports.kpiDelayedMilestones"), kpis.delayed_count || 0, "", "text-rose-400")}
            {kpiCard(t("vadmin.reports.kpiAvgCompletionTime"), t("vadmin.reports.days", { count: kpis.avg_completion_days || 0 }))}
            {kpiCard(t("vadmin.reports.kpiTaskStatus"), t("vadmin.reports.total", { count: (kpis.tasks_completed || 0) + (kpis.tasks_pending || 0) }))}
          </div>
        )}

        {/* Milestones Tab */}
        {activeTab === "milestones" && (
          <div className="card">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{t("vadmin.reports.allMilestones")}</h3>
            {milestones.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">{t("vadmin.reports.noMilestones")}</p>
            ) : (
              <div className="space-y-3">
                {milestones.map((m) => (
                  <div key={m.id} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)]">{m.title}</span>
                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${
                          m.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                          m.status === "in_progress" ? "bg-amber-500/10 text-amber-400" :
                          m.status === "delayed" ? "bg-rose-500/10 text-rose-400" :
                          "bg-slate-500/10 text-slate-500"
                        }`}>{m.status?.replace(/_/g, " ")}</span>
                      </div>
                      <span className="text-[9px] font-bold">{m.completion_percentage || 0}%</span>
                    </div>
                    {progressBar(m.completion_percentage || 0)}
                    <div className="flex gap-4 mt-2 text-[8px] text-slate-500">
                      <span>{t("vadmin.reports.deliverablesCount", { done: m.del_done || 0, total: m.del_total || 0 })}</span>
                      <span>{t("vadmin.reports.tasksProgress", { done: m.task_done || 0, total: m.task_total || 0 })}</span>
                      {m.due_date && <span>{t("vadmin.reports.due", { date: new Date(m.due_date).toLocaleDateString() })}</span>}
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
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{t("vadmin.reports.recentTasks")}</h3>
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">{t("vadmin.reports.noTasks")}</p>
            ) : (
              <div className="space-y-1">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      t.status === "done" ? "bg-emerald-500" : t.status === "blocked" ? "bg-rose-500" :
                      t.status === "in_progress" ? "bg-amber-500" : "bg-slate-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{t.title}</p>
                      <p className="text-[8px] text-slate-500">{t.assigned_name || t("vadmin.reports.unassigned")} {t.milestone_title ? `· ${t.milestone_title}` : ""}</p>
                    </div>
                    <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${
                      t.priority === "critical" ? "bg-rose-500/10 text-rose-400" :
                      t.priority === "high" ? "bg-amber-500/10 text-amber-400" :
                      "bg-slate-500/10 text-slate-500"
                    }`}>{t.priority}</span>
                    <span className="text-[8px] text-slate-500 capitalize">{t.status?.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Team Productivity Tab */}
        {activeTab === "team" && (
          <div className="card">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{t("vadmin.reports.teamProductivity")}</h3>
            {team.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">{t("vadmin.reports.noTeamData")}</p>
            ) : (
              <div className="space-y-4">
                {team.map((m, i) => (
                  <div key={i} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-[10px] font-black text-[var(--brand-orange)]">
                          {m.name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[var(--text-primary)]">{m.name || t("vadmin.reports.unnamed")}</p>
                          <p className="text-[8px] text-slate-500">{t("vadmin.reports.tasksDone", { done: m.completed, total: m.total_tasks })}</p>
                        </div>
                      </div>
                      <span className="text-lg font-black text-[var(--brand-orange)]">{m.completion_rate || 0}%</span>
                    </div>
                    {progressBar(m.completion_rate || 0)}
                    <div className="flex gap-3 mt-2 text-[8px] text-slate-500">
                      <span>📊 {t("vadmin.reports.tasksCount", { count: m.total_tasks })}</span>
                      {m.blocked > 0 && <span className="text-rose-400">🚫 {t("vadmin.reports.blockedCount", { count: m.blocked })}</span>}
                      {m.overdue > 0 && <span className="text-rose-400">⏰ {t("vadmin.reports.overdueCount", { count: m.overdue })}</span>}
                      <span>⏱ {t("vadmin.reports.estimatedHours", { hours: m.total_estimated || 0 })}</span>
                    </div>
                  </div>
                ))}
                {/* Workload distribution bar */}
                <div className="mt-4">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2">{t("vadmin.reports.workloadDistribution")}</p>
                  {team.map((m, i) => {
                    const total = team.reduce((s, x) => s + x.total_tasks, 1);
                    const pct = (m.total_tasks / total) * 100;
                    return (
                      <div key={i} className="flex items-center gap-2 mb-1">
                        <span className="text-[8px] font-bold text-slate-500 w-24 truncate">{m.name}</span>
                        <div className="flex-1 bg-tertiary rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[var(--brand-orange)] to-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[8px] text-slate-500 w-8 text-right">{m.total_tasks}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
