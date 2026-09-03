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
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

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

  const fetchReports = useCallback(async (bypassCache = false) => {
    const url = `/api/engineering/reports?period=${period}`;
    const apply = (json) => {
      if (json.success) setData(json);
    };
    setLoading(true);
    try {
      // Cache-first paint: each period caches under its own URL, so switching
      // periods / returning renders instantly from fresh snapshots; the refresh
      // button passes bypassCache=true so the view always reflects the latest.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setLoading(false);
        }
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        cacheSet(url, json);
        apply(json);
      }
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
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                Engineering Reports
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
              Reports
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Error trends, resolution metrics, and development velocity
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-secondary rounded-xl p-1 border border-[var(--border-primary)]">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
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
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Total Errors</p>
                  <Bug className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-2xl font-black tracking-tight text-red-400">{data.summary.total}</p>
              </div>
              <div className="card bg-secondary border-[var(--border-primary)] p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Resolved</p>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-black tracking-tight text-emerald-400">{data.summary.resolved}</p>
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">{data.summary.resolutionRate}% rate</p>
              </div>
              <div className="card bg-secondary border-[var(--border-primary)] p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Open</p>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-2xl font-black tracking-tight text-amber-400">{data.summary.unresolved}</p>
              </div>
              <div className="card bg-secondary border-[var(--border-primary)] p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Avg Resolution</p>
                  <Clock className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-2xl font-black tracking-tight text-blue-400">{data.summary.avgResolutionHours}h</p>
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
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Dev Tasks Created</p>
                    <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">{data.devTasks.total_tasks}</p>
                  </div>
                </div>
                <div className="ios-card !p-4 border-[var(--border-primary)] flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Completed</p>
                    <p className="text-2xl font-black tracking-tight text-emerald-400">{data.devTasks.completed_tasks}</p>
                  </div>
                </div>
                <div className="ios-card !p-4 border-[var(--border-primary)] flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Critical Tasks</p>
                    <p className="text-2xl font-black tracking-tight text-red-400">{data.devTasks.critical_tasks}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Most recurring errors */}
            {data.topErrors?.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Bug className="w-4 h-4 text-red-400" />
                  <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">Most Recurring Bugs</h2>
                </div>
                <div className="space-y-1">
                  {data.topErrors.slice(0, 10).map((err, i) => (
                    <div key={i} className="ios-card !p-3 border-[var(--border-primary)] flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">{t(err.message || "") || err.message}</p>
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                          Severity: {err.severity} · Last: {new Date(err.last_occurrence).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-sm font-bold text-red-400">{err.count}x</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase">{err.resolved_count} resolved</span>
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
                  <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">Errors by Severity</h2>
                  <div className="space-y-2">
                    {data.bySeverity.map((s) => {
                      const pct = data.summary.total > 0 ? Math.round((parseInt(s.count) / data.summary.total) * 100) : 0;
                      const barColor = s.severity === "critical" || s.severity === "fatal" ? "bg-red-500"
                        : s.severity === "error" ? "bg-amber-500"
                        : s.severity === "warning" ? "bg-blue-500"
                        : "bg-slate-500";
                      return (
                        <div key={s.severity} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold">
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
                    <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">Errors by Page</h2>
                    <div className="space-y-1">
                      {data.byPage.slice(0, 8).map((p, i) => {
                        const pct = data.summary.total > 0 ? Math.round((parseInt(p.count) / data.summary.total) * 100) : 0;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-[10px] font-medium text-[var(--text-secondary)] w-4">{i + 1}.</span>
                            <div className="flex-1">
                              <div className="flex justify-between text-[10px] font-bold mb-0.5">
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
                <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">Weekly Trend (Last 8 Weeks)</h2>
                <div className="ios-card !p-5 border-[var(--border-primary)]">
                  <div className="flex items-end gap-2 h-32">
                    {data.weeklyTrend.map((w, i) => {
                      const total = parseInt(w.total);
                      const resolved = parseInt(w.resolved);
                      const maxVal = Math.max(...data.weeklyTrend.map((x) => parseInt(x.total)), 1);
                      const heightPct = (total / maxVal) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-medium text-[var(--text-secondary)]">{total}</span>
                          <div className="w-full flex flex-col-reverse" style={{ height: `${heightPct}%` }}>
                            <div className="w-full bg-emerald-500/60 rounded-t transition-all" style={{ height: `${(resolved / total) * 100}%` }} />
                            <div className="w-full bg-red-500/40 rounded-t transition-all" style={{ height: `${((total - resolved) / total) * 100}%` }} />
                          </div>
                          <span className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                            {new Date(w.week).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-[10px] font-medium text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-500/40" /> Unresolved</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500/60" /> Resolved</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error-prone pages */}
            {data.topPages?.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{t("engineering.reports.mostErrorPronePages")}</h2>
                <div className="ios-card !p-0 border-[var(--border-primary)]">
                  <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border-primary)] bg-tertiary/30">
                        <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Page</th>
                        <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Errors</th>
                        <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Affected Users</th>
                        <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Last Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topPages.map((p, i) => (
                        <tr key={i} className="border-b border-[var(--border-primary)]/50 last:border-b-0 hover:bg-tertiary/20 transition-all">
                          <td className="px-5 py-3 text-sm font-bold text-[var(--text-primary)]">{p.page === "unknown" ? "—" : p.page}</td>
                          <td className="px-4 py-3 text-center"><span className="text-sm font-bold text-red-400">{p.total_errors}</span></td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-[var(--text-primary)]">{p.affected_users}</td>
                          <td className="px-5 py-3 text-right text-sm font-bold text-[var(--text-secondary)]">{new Date(p.last_error).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-20 text-center opacity-40">
            <BarChart3 className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <p className="text-sm text-[var(--text-secondary)]">No data yet</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Errors will appear here once the system captures them</p>
          </div>
        )}
      </div>
    </>
  );
}
