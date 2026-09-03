"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  Users,
  Bug,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Activity,
  ArrowRight,
  ListTodo,
  UserPlus,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  Calendar,
  BarChart3,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

// Lookup map: raw severity/priority value → i18n key (keep raw value as fallback)
const SEV_KEYS = {
  critical: "engineering.overview.severityValues.critical",
  fatal: "engineering.overview.severityValues.fatal",
  warning: "engineering.overview.severityValues.warning",
  high: "engineering.overview.severityValues.high",
  medium: "engineering.overview.severityValues.medium",
  low: "engineering.overview.severityValues.low",
};

export default function EngineeringOperations() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchDashboard = useCallback(async (bypassCache = false) => {
    const url = "/api/engineering/dashboard";
    const apply = (json) => {
      if (json.success) {
        setData(json);
      }
    };
    setLoading(true);
    try {
      // Cache-first paint: returning to this page renders instantly from a fresh
      // snapshot; the refresh button passes bypassCache=true so the view always
      // reflects the last action.
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
      console.error("Failed to fetch engineering dashboard", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const statsCards = data
    ? [
        {
          label: t("engineering.overview.activeDevelopers"),
          value:
            data.developers?.filter((d) => d.role === "developer").length || 0,
          icon: Users,
          color: "var(--brand-orange)",
          bg: "rgba(255,102,0,0.1)",
          onClick: () => setActiveTab("developers"),
        },
        {
          label: t("engineering.overview.interns"),
          value:
            data.developers?.filter((d) => d.role === "intern").length || 0,
          icon: UserPlus,
          color: "var(--chart-info, #3b82f6)",
          bg: "rgba(59,130,246,0.1)",
          onClick: () => setActiveTab("developers"),
        },
        {
          label: t("engineering.overview.activeTasks"),
          value: data.activeTasks?.length || 0,
          icon: ListTodo,
          color: "var(--chart-warning, #f59e0b)",
          bg: "rgba(245,158,11,0.1)",
          onClick: () => {},
        },
        {
          label: t("engineering.overview.unresolvedErrors"),
          value: data.unresolvedErrors?.length || 0,
          icon: Bug,
          color: "var(--chart-danger, #ef4444)",
          bg: "rgba(239,68,68,0.1)",
          onClick: () => router.push("/admin/engineering/error-logs"),
        },
        {
          label: t("engineering.overview.overdueTasks"),
          value: data.overdueTasks?.length || 0,
          icon: Clock,
          color:
            data.overdueTasks?.length > 0 ? "#ef4444" : "var(--text-secondary)",
          bg:
            data.overdueTasks?.length > 0
              ? "rgba(239,68,68,0.1)"
              : "rgba(100,100,100,0.05)",
          onClick: () => {},
        },
        {
          label: t("engineering.overview.activeBlockers"),
          value: data.activeBlockers?.length || 0,
          icon: AlertTriangle,
          color:
            data.activeBlockers?.length > 0
              ? "#ef4444"
              : "var(--text-secondary)",
          bg:
            data.activeBlockers?.length > 0
              ? "rgba(239,68,68,0.1)"
              : "rgba(100,100,100,0.05)",
          onClick: () => {},
        },
      ]
    : [];

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("engineering.overview.eyebrow")}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
              {t("engineering.overview.title")}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {t("engineering.overview.subtitle")}
            </p>
          </div>
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[10px] font-bold uppercase tracking-wide hover:bg-tertiary transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t("engineering.overview.refresh")}
          </button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{
                borderColor: "rgba(255,102,0,0.1)",
                borderTopColor: "var(--brand-orange)",
              }}
            />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {statsCards.map((stat) => (
                <button
                  key={stat.label}
                  onClick={stat.onClick}
                  className="card bg-secondary border-[var(--border-primary)] p-5 space-y-2 hover:border-[var(--brand-orange)]/30 transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {stat.label}
                    </p>
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: stat.bg }}
                    >
                      <stat.icon
                        className="w-4 h-4"
                        style={{ color: stat.color }}
                      />
                    </div>
                  </div>
                  <p
                    className="text-2xl font-black tracking-tight"
                    style={{ color: stat.color }}
                  >
                    {stat.value}
                  </p>
                </button>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => router.push("/admin/engineering/error-logs")}
                className="ios-card !p-6 flex items-center gap-4 hover:border-red-500/30 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-500/10">
                  <Bug className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                    {t("engineering.overview.errorLogs")}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                    {t("engineering.overview.unresolvedCount", { count: data?.unresolvedErrors?.length || 0 })}
                  </p>
                </div>
              </button>
              <button
                onClick={() => router.push("/admin/engineering/developers")}
                className="ios-card !p-6 flex items-center gap-4 hover:border-[var(--brand-orange)]/30 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-500/10">
                  <Users className="w-6 h-6 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                    {t("engineering.overview.developers")}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                    {t("engineering.overview.teamMembersCount", { count: data?.developers?.length || 0 })}
                  </p>
                </div>
              </button>
              <button
                onClick={() => router.push("/admin/engineering/tasks")}
                className="ios-card !p-6 flex items-center gap-4 hover:border-amber-500/30 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-500/10">
                  <ListTodo className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                    {t("engineering.overview.devTasks")}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                    {t("engineering.overview.activeTasksCount", { count: data?.activeTasks?.length || 0 })}
                  </p>
                </div>
              </button>
              <button
                onClick={() => router.push("/admin/engineering/reports")}
                className="ios-card !p-6 flex items-center gap-4 hover:border-emerald-500/30 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500/10">
                  <BarChart3 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                    {t("engineering.overview.reports")}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                    {t("engineering.overview.reportsSubtitle")}
                  </p>
                </div>
              </button>
            </div>

            {/* Recent Unresolved Errors */}
            {data?.unresolvedErrors?.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bug className="w-4 h-4 text-red-400" />
                    <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                      {t("engineering.overview.recentUnresolvedErrors")}
                    </h2>
                  </div>
                  <button
                    onClick={() => router.push("/admin/engineering/error-logs")}
                    className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wide hover:underline"
                  >
                    {t("engineering.overview.viewAll")}
                  </button>
                </div>
                <div className="space-y-2">
                  {data.unresolvedErrors.slice(0, 5).map((err) => (
                    <div
                      key={err.id}
                      className="ios-card !p-4 border-l-4 border-l-red-500 hover:border-[var(--brand-orange)]/30 transition-all cursor-pointer"
                      onClick={() =>
                        router.push("/admin/engineering/error-logs")
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                err.severity === "critical"
                                  ? "bg-red-500/10 text-red-400"
                                  : err.severity === "fatal"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-amber-500/10 text-amber-400"
                              }`}
                            >
                              {t(SEV_KEYS[err.severity] || "") || err.severity}
                            </span>
                            {err.task_id && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase">
                                {t("engineering.overview.taskNumber", { taskId: err.task_id })}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                            {t(err.message || "") || err.message}
                          </p>
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                            {err.page && `${err.page}`}
                            {err.user_name && ` — ${err.user_name}`}
                            {err.created_at &&
                              ` — ${new Date(err.created_at).toLocaleString()}`}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0 ml-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Overdue Tasks */}
            {data?.overdueTasks?.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-400" />
                  <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                    {t("engineering.overview.overdueTasks")}
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 uppercase">
                    {data.overdueTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {data.overdueTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="ios-card !p-4 border-l-4 border-l-red-400"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                            {task.title}
                          </p>
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                            {task.assignee_name &&
                              t("engineering.overview.assignedTo", { name: task.assignee_name })}
                            {task.end_date &&
                              ` — ${t("engineering.overview.due", { date: new Date(task.end_date).toLocaleDateString() })}`}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ml-2 ${
                            task.priority === "critical"
                              ? "bg-red-500/10 text-red-400"
                              : task.priority === "high"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-slate-500/10 text-[var(--text-secondary)]"
                          }`}
                        >
                          {t(SEV_KEYS[task.priority] || "") || task.priority || t("engineering.overview.severityValues.medium")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Blockers */}
            {data?.activeBlockers?.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                    {t("engineering.overview.activeBlockers")}
                  </h2>
                </div>
                <div className="space-y-2">
                  {data.activeBlockers.slice(0, 5).map((blocker) => (
                    <div
                      key={blocker.id}
                      className="ios-card !p-4 border-l-4 border-l-amber-400"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                            {blocker.title}
                          </p>
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                            {t("engineering.overview.taskTitle", { title: blocker.task_title })}
                            {blocker.reported_by_name &&
                              ` — ${t("engineering.overview.reportedBy", { name: blocker.reported_by_name })}`}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ml-2 ${
                            blocker.severity === "critical"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {t(SEV_KEYS[blocker.severity] || "") || blocker.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
