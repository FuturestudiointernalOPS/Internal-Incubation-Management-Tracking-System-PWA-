"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart3,
  Search,
  Filter,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeft,
  ListTodo,
  Shield,
  RefreshCw,
  TrendingUp,
  Users,
  Target,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";

/**
 * SUPER ADMIN PROJECTS DASHBOARD
 *
 * Full visibility into all projects with task/blocker aggregation.
 * Shows: project progress, task completion rate, blocker count, timeline health.
 */

const STATUS_COLORS = {
  Active: "text-emerald-500",
  Completed: "text-purple-500",
  Paused: "text-amber-500",
};

const STATUS_BG = {
  Active: "bg-emerald-500/10",
  Completed: "bg-purple-500/10",
  Paused: "bg-amber-500/10",
};

export default function AdminProjects() {
  const router = useRouter();
  const { t } = useI18n();
  const [projects, setProjects] = useState([]);
  const [totals, setTotals] = useState({ totalTasks: 0, completedTasks: 0, totalBlockers: 0, activeBlockers: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [analytics, setAnalytics] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, analyticsRes] = await Promise.all([
        fetch("/api/admin/projects"),
        fetch("/api/admin/analytics/overview"),
      ]);
      const projData = await projRes.json();
      const analyticsData = await analyticsRes.json();
      if (projData.success) {
        setProjects(projData.projects || []);
        setTotals(projData.totals || {});
      }
      if (analyticsData.success) setAnalytics(analyticsData.analytics);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === "all" || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, filterStatus]);

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20 text-left">
        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <button onClick={() => router.push("/admin")} className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest">
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> {t('navigation.dashboard')}
            </button>
            <div className="flex items-center gap-2 mt-2">
              <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">Internal Operations</span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Projects</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-xs font-black">{projects.length} Projects</span>
            </div>
            <button onClick={fetchData} className="p-2 rounded-xl hover:bg-white/5 transition-all" title={t('common.refresh')}>
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </header>

        {/* ANALYTICS ROW */}
        {analytics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="card flex items-center gap-3 p-3">
              <div className="p-2 rounded-xl bg-white/5"><ListTodo className="w-3.5 h-3.5 text-[var(--text-primary)]" /></div>
              <div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">{t('reports.tasks')}</p>
                <p className="text-base font-black">{analytics.tasks.total}</p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-3">
              <div className="p-2 rounded-xl bg-emerald-500/10"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /></div>
              <div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">{t('reports.completed')}</p>
                <p className="text-base font-black text-emerald-500">{analytics.completionRate}%</p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-3">
              <div className="p-2 rounded-xl bg-amber-500/10"><TrendingUp className="w-3.5 h-3.5 text-amber-500" /></div>
              <div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">{t('reports.carriedOver')}</p>
                <p className="text-base font-black text-amber-500">{analytics.carryoverRate}%</p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-3">
              <div className="p-2 rounded-xl bg-rose-500/10"><Shield className="w-3.5 h-3.5 text-rose-500" /></div>
              <div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">{t('reports.active')}</p>
                <p className="text-base font-black text-rose-500">{analytics.blockers.active}</p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-3">
              <div className="p-2 rounded-xl bg-blue-500/10"><Users className="w-3.5 h-3.5 text-blue-500" /></div>
              <div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">{t('reports.teamMembers')}</p>
                <p className="text-base font-black text-blue-500">{analytics.activeUsers}</p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-3">
              <div className="p-2 rounded-xl bg-indigo-500/10"><Briefcase className="w-3.5 h-3.5 text-indigo-500" /></div>
              <div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">{t('admin.activePrograms')}</p>
                <p className="text-base font-black text-indigo-500">{analytics.projects}</p>
              </div>
            </div>
          </div>
        )}

        {/* FILTERS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all" />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]">
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Paused">Paused</option>
            </select>
          </div>
        </div>

        {/* PROJECTS TABLE */}
        {loading ? <TableSkeleton rows={6} /> : filteredProjects.length === 0 ? (
          <div className="card py-32 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
            <Briefcase className="w-16 h-16 mb-4" />
            <p className="text-[10px] font-bold uppercase tracking-widest">No projects found</p>
            <p className="text-[9px] text-slate-500 mt-2">Projects appear here once tasks are linked to them.</p>
          </div>
        ) : (
          <div className="card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="text-left p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">Project</th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">Tasks</th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">Completed</th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">Blockers</th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => (
                    <tr key={project.id} className="border-b border-[var(--border-primary)]/50 hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)]">
                            <Briefcase className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-tight text-[var(--text-primary)]">{project.name}</p>
                            <p className="text-[9px] text-slate-500">{project.type || 'Incubation'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-center p-4">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${STATUS_BG[project.status] || 'bg-slate-500/10'} ${STATUS_COLORS[project.status] || 'text-slate-400'}`}>
                          {project.status}
                        </span>
                      </td>
                      <td className="text-center p-4">
                        <span className="text-sm font-black">{project.taskStats?.total || 0}</span>
                      </td>
                      <td className="text-center p-4">
                        <span className="text-sm font-black text-emerald-500">{project.completionRate || 0}%</span>
                      </td>
                      <td className="text-center p-4">
                        <div className="flex items-center justify-center gap-1">
                          <Shield className={`w-3 h-3 ${project.blockerStats?.active > 0 ? 'text-rose-500' : 'text-slate-600'}`} />
                          <span className={`text-sm font-black ${project.blockerStats?.active > 0 ? 'text-rose-500' : 'text-slate-600'}`}>
                            {project.blockerStats?.active || 0}
                          </span>
                          {project.blockerStats?.total > 0 && (
                            <span className="text-[8px] text-slate-500">/ {project.blockerStats.total}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${project.completionRate || 0}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 w-8 text-right">{project.completionRate || 0}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
