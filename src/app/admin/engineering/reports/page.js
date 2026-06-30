"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Bug,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Activity,
  RefreshCw,
  Calendar,
  Users,
  ListTodo,
  Shield,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const PERIODS = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
];

export default function EngineeringReports() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/engineering/reports?period=${period}`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (e) {
      console.error("Failed to fetch reports", e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return (
    <DashboardLayout role="super_admin" activeTab="engineering">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Engineering Reports
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Reports
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              Error trends, resolution metrics, and development velocity
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-secondary rounded-xl p-1 border border-[var(--border-primary)]">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                    period === p.value
                      ? "bg-[var(--brand-orange)] text-black"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={fetchReports} className="p-2.5 rounded-xl bg-secondary border border-[var(--border-primary)] hover:bg-tertiary transition-all">
              <RefreshCw className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{ borderColor: "rgba(255,102,0,0.1)", borderTopColor: "var(--brand-orange)" }}
            />
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card bg-secondary border-[var(--border-primary)] p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Total Errors</p>
                  <Bug className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-3xl font-black text-red-400">{data.summary.total}</p>
              </div>
              <div className="card bg-secondary border-[var(--border-primary)] p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Resolved</p>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-3xl font-black text-emerald-400">{data.summary.resolved}</p>
                <p className="text-[8px] font-bold text-slate-500">{data.summary.resolutionRate}% rate</p>
              </div>
              <div className="card bg-secondary border-[var(--border-primary)] p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Open</p>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-3xl font-black text-amber-400">{data.summary.unresolved}</p>
              </div>
              <div className="card bg-secondary border-[var(--border-primary)] p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Avg Resolution</p>
                  <Clock className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-3xl font-black text-blue-400">{data.summary.avgResolutionHours}h</p>
              </div>
            </div>

            {/* Dev Tasks summary */}
            {data.devTasks && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="ios-card !p-4 border-[var(--border-primary)] flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <ListTodo className="w-5 h-5 text-[var(--brand-orange)]" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Dev Tasks Created</p>
                    <p className="text-xl font-black text-[var(--text-primary)]">{data.devTasks.total_tasks}</p>
                  </div>
                </div>
                <div className="ios-card !p-4 border-[var(--border-primary)] flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Completed</p>
                    <p className="text-xl font-black text-emerald-400">{data.devTasks.completed_tasks}</p>
                  </div>
                </div>
                <div className="ios-card !p-4 border-[var(--border-primary)] flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Critical Tasks</p>
                    <p className="text-xl font-black text-red-400">{data.devTasks.critical_tasks}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Most recurring errors */}
            {data.topErrors?.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Bug className="w-4 h-4 text-red-400" />
                  <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Most Recurring Bugs</h2>
                </div>
                <div className="space-y-1">
                  {data.topErrors.slice(0, 10).map((err, i) => (
                    <div key={i} className="ios-card !p-3 border-[var(--border-primary)] flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold text-[var(--text-primary)] truncate">{err.message}</p>
                        <p className="text-[7px] font-bold text-slate-500 mt-0.5">
                          Severity: {err.severity} · Last: {new Date(err.last_occurrence).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-xs font-black text-red-400">{err.count}x</span>
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{err.resolved_count} resolved</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors by severity */}
            {data.bySeverity?.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Errors by Severity</h2>
                  <div className="space-y-2">
                    {data.bySeverity.map((s) => {
                      const pct = data.summary.total > 0 ? Math.round((parseInt(s.count) / data.summary.total) * 100) : 0;
                      const barColor = s.severity === "critical" || s.severity === "fatal" ? "bg-red-500"
                        : s.severity === "error" ? "bg-amber-500"
                        : s.severity === "warning" ? "bg-blue-500"
                        : "bg-slate-500";
                      return (
                        <div key={s.severity} className="space-y-1">
                          <div className="flex justify-between text-[9px] font-bold">
                            <span className="text-[var(--text-primary)] uppercase tracking-wider">{(s.severity || "unknown").replace(/_/g, " ")}</span>
                            <span className="text-[var(--text-secondary)]">{s.count} ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Errors by page */}
                {data.byPage?.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Errors by Page</h2>
                    <div className="space-y-1">
                      {data.byPage.slice(0, 8).map((p, i) => {
                        const pct = data.summary.total > 0 ? Math.round((parseInt(p.count) / data.summary.total) * 100) : 0;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-[8px] font-bold text-slate-500 w-4">{i + 1}.</span>
                            <div className="flex-1">
                              <div className="flex justify-between text-[9px] font-bold mb-0.5">
                                <span className="text-[var(--text-primary)] truncate">{p.page}</span>
                                <span className="text-[var(--text-secondary)] shrink-0 ml-2">{p.count}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Weekly trend */}
            {data.weeklyTrend?.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Weekly Trend (Last 8 Weeks)</h2>
                <div className="ios-card !p-5 border-[var(--border-primary)]">
                  <div className="flex items-end gap-2 h-32">
                    {data.weeklyTrend.map((w, i) => {
                      const total = parseInt(w.total);
                      const resolved = parseInt(w.resolved);
                      const maxVal = Math.max(...data.weeklyTrend.map((x) => parseInt(x.total)), 1);
                      const heightPct = (total / maxVal) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[7px] font-bold text-slate-500">{total}</span>
                          <div className="w-full flex flex-col-reverse" style={{ height: `${heightPct}%` }}>
                            <div className="w-full bg-emerald-500/60 rounded-t transition-all" style={{ height: `${(resolved / total) * 100}%` }} />
                            <div className="w-full bg-red-500/40 rounded-t transition-all" style={{ height: `${((total - resolved) / total) * 100}%` }} />
                          </div>
                          <span className="text-[7px] font-bold text-slate-600 mt-1">
                            {new Date(w.week).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-[8px] font-bold text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-500/40" /> Unresolved</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500/60" /> Resolved</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error-prone pages */}
            {data.topPages?.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Most Error-Prone Pages</h2>
                <div className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border-primary)] bg-tertiary/30">
                        <th className="text-left px-5 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Page</th>
                        <th className="text-center px-4 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Errors</th>
                        <th className="text-center px-4 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Affected Users</th>
                        <th className="text-right px-5 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Last Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topPages.map((p, i) => (
                        <tr key={i} className="border-b border-[var(--border-primary)]/50 last:border-b-0 hover:bg-tertiary/20 transition-all">
                          <td className="px-5 py-3 text-[9px] font-bold text-[var(--text-primary)]">{p.page === "unknown" ? "—" : p.page}</td>
                          <td className="px-4 py-3 text-center"><span className="text-[9px] font-black text-red-400">{p.total_errors}</span></td>
                          <td className="px-4 py-3 text-center text-[9px] font-bold text-[var(--text-secondary)]">{p.affected_users}</td>
                          <td className="px-5 py-3 text-right text-[8px] font-bold text-slate-500">{new Date(p.last_error).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-20 text-center opacity-40">
            <BarChart3 className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <p className="text-lg font-black text-[var(--text-primary)] uppercase">No data yet</p>
            <p className="text-xs font-bold text-slate-500 mt-1">Errors will appear here once the system captures them</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
