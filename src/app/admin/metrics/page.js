"use client";

import React, { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Users, Target, Activity, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function AdminMetricsDashboard() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      const res = await fetch("/api/pm/programs?show_archived=all");
      const data = await res.json();
      if (data.success) setPrograms(data.programs || []);
    } catch (e) {
      console.error("Metrics fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatPct = (v) => (v !== null && v !== undefined ? `${Math.round(v)}%` : "—");

  const getHealthColor = (val) => {
    if (val >= 80) return "text-emerald-500";
    if (val >= 50) return "text-amber-500";
    return "text-rose-500";
  };

  const getHealthLabel = (val) => {
    if (val >= 80) return "Healthy";
    if (val >= 50) return "At Risk";
    return "Critical";
  };

  if (loading) return (
    <DashboardLayout role="super_admin">
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-t-[var(--brand-orange)] rounded-full animate-spin" />
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20">
        <header className="flex items-center gap-3 border-b border-[var(--border-primary)] pb-6">
          <BarChart3 className="w-6 h-6 text-[var(--brand-orange)]" />
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--text-primary)]">Program Health Dashboard</h1>
            <p className="text-[10px] text-[var(--text-secondary)]">Operational execution vs student performance — side by side</p>
          </div>
        </header>

        {programs.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-[10px] text-[var(--text-secondary)] italic">No programs found</p>
          </div>
        )}

        <div className="space-y-6">
          {programs.map((prog) => {
            const opPct = prog.completion_index || 0;
            const stdSubRate = prog.submission_rate || 0;
            const health = Math.round((opPct + stdSubRate) / 2);

            return (
              <div key={prog.id} className="card !p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{prog.name}</h3>
                    <p className="text-[8px] text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                      {prog.pm_name ? `PM: ${prog.pm_name}` : "No PM assigned"} · Status: {prog.status || "Active"}
                    </p>
                  </div>
                  <div className={`text-right ${getHealthColor(health)}`}>
                    <p className="text-2xl font-black">{formatPct(health)}</p>
                    <p className="text-[8px] font-black uppercase tracking-widest">{getHealthLabel(health)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-3">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-400" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Operational Execution</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-3xl font-black text-blue-400">{formatPct(opPct)}</span>
                    </div>
                    <div className="w-full h-2 bg-blue-500/10 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${opPct}%` }} />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Student Engagement</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-3xl font-black text-emerald-400">{formatPct(stdSubRate)}</span>
                    </div>
                    <div className="w-full h-2 bg-emerald-500/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${stdSubRate}%` }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--border-primary)]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3 h-3 ${health >= 80 ? 'text-emerald-500' : health >= 50 ? 'text-amber-500' : 'text-rose-500'}`} />
                    <span className="text-[8px] font-bold text-[var(--text-secondary)]">Overall Health: {formatPct(health)}</span>
                  </div>
                  <div className={`flex items-center gap-2 ${opPct >= 80 ? 'text-emerald-500' : opPct >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                    <Activity className="w-3 h-3" />
                    <span className="text-[8px] font-bold">Execution: {getHealthLabel(opPct)}</span>
                  </div>
                  <div className={`flex items-center gap-2 ${stdSubRate >= 80 ? 'text-emerald-500' : stdSubRate >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                    <Users className="w-3 h-3" />
                    <span className="text-[8px] font-bold">Engagement: {getHealthLabel(stdSubRate)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
