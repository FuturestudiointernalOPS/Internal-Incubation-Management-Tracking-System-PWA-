"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Blocks,
  FileText,
  BarChart3,
  FolderKanban,
  GitBranch,
  Settings,
  CheckCircle2,
  Clock,
  Activity,
  Loader2,
} from "lucide-react";
import { getRegisteredModules } from "@/lib/platform/registry";
import { listServices } from "@/lib/platform/services";

/**
 * PLATFORM DASHBOARD
 * Landing page for the Platform workspace.
 * Shows installed modules, system status, and key metrics.
 */

const ICON_MAP = {
  LayoutDashboard: Blocks,
  FolderKanban,
  FileText,
  BarChart3,
  GitBranch,
  Settings,
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function PlatformDashboard() {
  const [user, setUser] = useState({ role: "super_admin" });
  const [services, setServices] = useState([]);
  const [modules, setModules] = useState([]);
  const [operationalStats, setOperationalStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    if (u.role) setUser(u);
    setServices(listServices());
    setModules(getRegisteredModules(u.role || "super_admin"));
    loadOperationalData();
  }, []);

  const loadOperationalData = async () => {
    try {
      const resp = await fetch("/api/platform/form-runs?dashboard=true");
      const data = await resp.json();
      if (data.success) setOperationalStats(data.stats);
    } catch (_) {}
    try {
      const resp = await fetch("/api/platform/form-runs?activity=true");
      const data = await resp.json();
      if (data.success) setRecentActivity(data.activity || []);
    } catch (_) {}
    setLoading(false);
  };

  const activeModules = modules.filter((m) => m.visible && !m.future);
  const futureModules = modules.filter((m) => m.future);
  const loadedServices = services.filter((s) => s.loaded);

  const stats = [
    {
      label: "Active Modules",
      value: activeModules.length,
      icon: Blocks,
      color: "text-[var(--brand-orange)]",
    },
    {
      label: "Coming Soon",
      value: futureModules.length,
      icon: Clock,
      color: "text-amber-500",
    },
    {
      label: "Services",
      value: services.length,
      icon: Activity,
      color: "text-indigo-500",
    },
    {
      label: "Services Loaded",
      value: loadedServices.length,
      icon: CheckCircle2,
      color: "text-emerald-500",
    },
  ];

  return (
    <div className="p-6 space-y-8 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black uppercase tracking-tight text-[var(--text-primary)]">
          Platform Dashboard
        </h1>
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
          Central workspace for platform capabilities — modules automatically
          register themselves here.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="p-5 rounded-2xl bg-secondary border border-[var(--border-primary)] space-y-2"
          >
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
            <p className="text-2xl font-black text-[var(--text-primary)]">
              {stat.value}
            </p>
            <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Operational Stats */}
      <div className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--brand-orange)]" /> Operational Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Active Runs", value: operationalStats?.active_runs ?? 0, icon: FileText, color: "text-emerald-500" },
            { label: "Total Assigned", value: operationalStats?.total_assignments ?? 0, icon: FolderKanban, color: "text-blue-500" },
            { label: "Submissions", value: operationalStats?.total_submissions ?? 0, icon: CheckCircle2, color: "text-indigo-500" },
            { label: "Pending Review", value: operationalStats?.pending_reviews ?? 0, icon: Clock, color: "text-amber-500" },
            { label: "Approval Rate", value: (operationalStats?.approval_rate != null ? Math.round(operationalStats.approval_rate) + "%" : "—"), icon: BarChart3, color: (operationalStats?.approval_rate || 0) > 50 ? "text-emerald-500" : "text-rose-500" },
            { label: "Overdue", value: operationalStats?.overdue ?? 0, icon: Clock, color: (operationalStats?.overdue ?? 0) > 0 ? "text-rose-500" : "text-slate-500" },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-2xl bg-secondary border border-[var(--border-primary)] text-center">
              <p className={cn("text-xl font-black", s.color)}>{s.value}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <s.icon className={cn("w-2.5 h-2.5", s.color)} />
                <p className="text-[8px] font-bold uppercase text-[var(--text-secondary)]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--brand-orange)]" /> Recent Activity
        </h2>
        {recentActivity.length > 0 ? (
          <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl overflow-hidden">
            {recentActivity.slice(0, 10).map((entry, idx) => (
              <div key={idx} className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border-primary)] last:border-0 text-[11px]">
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                  entry.action === "submitted" ? "bg-blue-500" :
                  entry.action === "approved" ? "bg-emerald-500" :
                  entry.action === "rejected" ? "bg-rose-500" :
                  entry.action === "launched" ? "bg-emerald-500" :
                  "bg-[var(--brand-orange)]"
                )} />
                <span className="font-bold text-[var(--text-primary)] flex-1">{entry.details || entry.action}</span>
                <span className="text-[9px] text-[var(--text-secondary)]">{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : ""}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-center">
            <p className="text-[10px] text-[var(--text-secondary)] font-bold">No activity yet — launch a form run to get started</p>
          </div>
        )}
      </div>

      {/* Active modules grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
          Installed Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeModules.map((mod) => {
            const Icon = ICON_MAP[mod.icon] || Blocks;
            return (
              <a
                key={mod.id}
                href={mod.href}
                className="p-5 rounded-2xl bg-secondary border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/50 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center mb-4 group-hover:bg-[var(--brand-orange)]/20 transition-all">
                  <Icon className="w-5 h-5 text-[var(--brand-orange)]" />
                </div>
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                  {mod.name}
                </h3>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                  {mod.description}
                </p>
              </a>
            );
          })}
        </div>
      </div>

      {/* Future modules */}
      {futureModules.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
            Upcoming Modules
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {futureModules.map((mod) => {
              const Icon = ICON_MAP[mod.icon] || Blocks;
              return (
                <div
                  key={mod.id}
                  className="p-5 rounded-2xl bg-secondary/50 border border-dashed border-[var(--border-primary)] opacity-60"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-amber-500" />
                  </div>
                  <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                    {mod.name}
                  </h3>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                    {mod.description}
                  </p>
                  <span className="inline-block mt-3 px-2 py-1 rounded bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-wider">
                    Coming Soon
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Services status */}
      <div className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
          Platform Services
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
          <table className="w-full text-left">
            <thead className="bg-tertiary">
              <tr className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {services.map((svc) => (
                <tr
                  key={svc.id}
                  className="text-[11px] font-bold text-[var(--text-primary)] hover:bg-tertiary/50 transition-colors"
                >
                  <td className="px-4 py-3">{svc.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-[9px] font-black uppercase",
                        svc.loaded
                          ? "text-emerald-500"
                          : "text-amber-500",
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          svc.loaded
                            ? "bg-emerald-500"
                            : "bg-amber-500",
                        )}
                      />
                      {svc.loaded ? "Ready" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-[var(--text-secondary)]">
                    {svc.singleton ? "Singleton" : "Instance"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
