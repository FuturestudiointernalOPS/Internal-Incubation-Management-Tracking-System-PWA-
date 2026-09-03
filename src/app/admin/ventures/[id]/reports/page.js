"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2, AlertTriangle, Download,
  BarChart3, RefreshCw, TrendingUp, Clock, Users, Target,Activity,
} from "lucide-react";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

export default function VentureReportsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [venture, setVenture] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async (bypassCache = false) => {
    const urls = [
      `/api/ventures/${id}`,
      `/api/ventures/${id}/reports?type=analytics`,
      `/api/ventures/${id}/reports?type=milestones`,
      `/api/ventures/${id}/reports?type=tasks&limit=50`,
      `/api/ventures/${id}/reports?type=productivity`,
    ];
    const apply = (v, r, m, t, p) => {
      if (v.success) setVenture(v.venture);
      if (r.success) setData(r);
      if (m.success) setMilestones(m.milestones || []);
      if (t.success) setTasks(t.tasks || []);
      if (p.success) setTeam(p.team || []);
    };
    let painted = false;
    setLoading(true);
    try {
      // Cache-first paint: returning to this page renders instantly from
      // fresh snapshots; the refresh button passes the click event, so
      // fetchData bypasses the cache and always reloads latest data.
      if (!bypassCache) {
        const cached = urls.map((u) => cacheGet(u));
        if (cached.every((c) => c !== null && c.success)) {
          apply(cached[0], cached[1], cached[2], cached[3], cached[4]);
          setLoading(false);
          painted = true;
        }
      }
      const [vRes, rRes, mRes, tRes, pRes] = await Promise.all([
        fetch(urls[0]),
        fetch(urls[1]),
        fetch(urls[2]),
        fetch(urls[3]),
        fetch(urls[4]),
      ]);
      const v = await vRes.json();
      const r = await rRes.json();
      const m = await mRes.json();
      const t = await tRes.json();
      const p = await pRes.json();
      if (v.success) cacheSet(urls[0], v);
      if (r.success) cacheSet(urls[1], r);
      if (m.success) cacheSet(urls[2], m);
      if (t.success) cacheSet(urls[3], t);
      if (p.success) cacheSet(urls[4], p);
      apply(v, r, m, t, p);
    } catch (e) {
      if (!painted) console.error("Failed to load reports data:", e);
    } finally {
      setLoading(false);
    }
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

  if (loading) return (
    <>
      <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div>
    </>
  );

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const summary = data?.summary || {};

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}/dashboard`)}
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
            <button onClick={fetchData} className="px-3 py-2 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wider hover:bg-tertiary transition-all flex items-center gap-1.5">
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
                  {charts.activity_trend_30d.slice(-14).map((d, i) => {
                    const maxH = Math.max(...charts.activity_trend_30d.map((x) => x.total), 1);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full bg-emerald-500/30 rounded-t" style={{ height: `${(d.completed / maxH) * 100}%` }} />
                        <div className="w-full bg-[var(--brand-orange)]/30 rounded-t" style={{ height: `${(d.created / maxH) * 100}%` }} />
                        <span className="text-[10px] text-[var(--text-secondary)] mt-0.5">{d.date?.slice(5)}</span>
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
                {milestones.map((m) => (
                  <div key={m.id} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)]">{m.title}</span>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          m.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                          m.status === "in_progress" ? "bg-amber-500/10 text-amber-400" :
                          m.status === "delayed" ? "bg-rose-500/10 text-rose-400" :
                          "bg-slate-500/10 text-slate-500"
                        }`}>{m.status?.replace(/_/g, " ")}</span>
                      </div>
                      <span className="text-[9px] font-bold">{m.completion_percentage || 0}%</span>
                    </div>
                    {progressBar(m.completion_percentage || 0)}
                    <div className="flex gap-4 mt-2 text-[10px] text-[var(--text-secondary)]">
                      <span>Deliverables: {m.del_done || 0}/{m.del_total || 0}</span>
                      <span>Tasks: {m.task_done || 0}/{m.task_total || 0}</span>
                      {m.due_date && <span>Due: {new Date(m.due_date).toLocaleDateString()}</span>}
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
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      t.status === "done" ? "bg-emerald-500" : t.status === "blocked" ? "bg-rose-500" :
                      t.status === "in_progress" ? "bg-amber-500" : "bg-slate-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{t.title}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">{t.assigned_name || "Unassigned"} {t.milestone_title ? `· ${t.milestone_title}` : ""}</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      t.priority === "critical" ? "bg-rose-500/10 text-rose-400" :
                      t.priority === "high" ? "bg-amber-500/10 text-amber-400" :
                      "bg-slate-500/10 text-slate-500"
                    }`}>{t.priority}</span>
                    <span className="text-[10px] text-[var(--text-secondary)] capitalize">{t.status?.replace(/_/g, " ")}</span>
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
                {team.map((m, i) => (
                  <div key={i} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-[10px] font-black text-[var(--brand-orange)]">
                          {m.name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[var(--text-primary)]">{m.name || "Unnamed"}</p>
                          <p className="text-[10px] text-[var(--text-secondary)]">{m.completed}/{m.total_tasks} tasks done</p>
                        </div>
                      </div>
                      <span className="text-lg font-black text-[var(--brand-orange)]">{m.completion_rate || 0}%</span>
                    </div>
                    {progressBar(m.completion_rate || 0)}
                    <div className="flex gap-3 mt-2 text-[10px] text-[var(--text-secondary)]">
                      <span>📊 {m.total_tasks} tasks</span>
                      {m.blocked > 0 && <span className="text-rose-400">🚫 {m.blocked} blocked</span>}
                      {m.overdue > 0 && <span className="text-rose-400">⏰ {m.overdue} overdue</span>}
                      <span>⏱ {m.total_estimated || 0}h estimated</span>
                    </div>
                  </div>
                ))}
                {/* Workload distribution bar */}
                <div className="mt-4">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Workload Distribution</p>
                  {team.map((m, i) => {
                    const total = team.reduce((s, x) => s + x.total_tasks, 1);
                    const pct = (m.total_tasks / total) * 100;
                    return (
                      <div key={i} className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] w-24 truncate">{m.name}</span>
                        <div className="flex-1 bg-tertiary rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[var(--brand-orange)] to-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-[var(--text-secondary)] w-8 text-right">{m.total_tasks}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
