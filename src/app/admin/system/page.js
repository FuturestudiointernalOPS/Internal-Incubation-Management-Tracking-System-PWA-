"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import {
  Activity,
  HeartPulse,
  Database,
  HardDrive,
  Cpu,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  BarChart3,
  FileText,
  Zap,
  Terminal,
  Server,
  Layers,
} from "lucide-react";

function formatDate(dateValue) {
  if (!dateValue) return "";
  return new Date(dateValue).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const STATUS_COLORS = {
  healthy: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  degraded: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  unhealthy: "text-red-400 bg-red-500/10 border-red-500/20",
};

const COMPONENT_ICONS = {
  app: Activity, database: Database, cache: Zap, queue: Layers,
  email: FileText, storage: HardDrive, search: Terminal,
  notifications: Activity, integrations: Activity,
};

const COMPONENT_KEYS = {
  app: "adminMisc.system.componentApp",
  database: "adminMisc.system.componentDatabase",
  cache: "adminMisc.system.componentCache",
  queue: "adminMisc.system.componentQueue",
  email: "adminMisc.system.componentEmail",
  storage: "adminMisc.system.componentStorage",
  search: "adminMisc.system.componentSearch",
  notifications: "adminMisc.system.componentNotifications",
  integrations: "adminMisc.system.componentIntegrations",
};

const STATUS_KEYS = {
  healthy: "adminMisc.system.statusHealthy",
  degraded: "adminMisc.system.statusDegraded",
  unhealthy: "adminMisc.system.statusUnhealthy",
};

const ENV_KEYS = {
  development: "adminMisc.system.envDevelopment",
  production: "adminMisc.system.envProduction",
  staging: "adminMisc.system.envStaging",
};

const REPORT_TYPE_KEYS = {
  daily: "adminMisc.system.reportTypeDaily",
  weekly: "adminMisc.system.reportTypeWeekly",
  monthly: "adminMisc.system.reportTypeMonthly",
};

// Module scope on purpose: the hook keys its internal callback on these
// functions, so inline arrows would give them a new identity on every render and
// refetch in a loop. A read that fails reports null, so the summary parts cannot
// be assembled out of a half-failed set.
const pickPayload = (payload) => (payload?.success ? payload : null);
const pickHealthResults = (payload) => (payload?.success ? payload.results || payload.checks || [] : []);
const pickJobs = (payload) => (payload?.success ? payload.jobs || [] : []);
const pickReports = (payload) => (payload?.success ? payload.reports || [] : []);

// The endpoints this console reads, at module scope for the same reason.
// The job statistics fed two separate states, so they are read once and shared.
const STATUS_URL = "/api/system/status";
const HEALTH_URL = "/api/system/health?type=latest";
const JOB_STATS_URL = "/api/system/jobs?type=stats";
const API_MONITOR_URL = "/api/system/metrics?type=recent";
const STORAGE_URL = "/api/system/storage";
const DATABASE_URL = "/api/system/database";
const JOBS_URL = "/api/system/jobs?limit=20";
const REPORTS_URL = "/api/system/reports?limit=10";

export default function SystemMonitoringPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("overview");
  const [runningHealth, setRunningHealth] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Every loader's work — cache-first paint, discarding a stale response, the
  // background refresh — belongs to the hook, so the screen keeps no data state
  // of its own and never sets state from an effect. The health check re-reads
  // two of them and generating a report re-reads one, writing through those
  // reads' own setters exactly as before.
  const {
    data: status,
    loading: statusLoading,
    error: statusError,
    setData: setStatus,
    refresh: refreshStatus,
  } = useApi(STATUS_URL, { transform: pickPayload });
  const {
    data: health,
    loading: healthLoading,
    error: healthError,
    setData: setHealth,
    refresh: refreshHealth,
  } = useApi(HEALTH_URL, { defaultValue: [], transform: pickHealthResults });
  const {
    data: jobStats,
    loading: jobStatsLoading,
    error: jobStatsError,
    refresh: refreshJobStats,
  } = useApi(JOB_STATS_URL, { transform: pickPayload });
  const {
    data: apiMonitor,
    loading: apiMonitorLoading,
    error: apiMonitorError,
  } = useApi(API_MONITOR_URL, { transform: pickPayload });
  const {
    data: storage,
    loading: storageLoading,
    error: storageError,
  } = useApi(STORAGE_URL, { transform: pickPayload });
  const {
    data: dbInfo,
    loading: dbLoading,
    error: dbError,
  } = useApi(DATABASE_URL, { transform: pickPayload });
  const {
    data: jobs,
    loading: jobsLoading,
    error: jobsError,
    refresh: refreshJobs,
  } = useApi(JOBS_URL, { defaultValue: [], transform: pickJobs });
  const {
    data: reports,
    loading: reportsLoading,
    error: reportsError,
    setData: setReports,
    refresh: refreshReports,
  } = useApi(REPORTS_URL, { defaultValue: [], transform: pickReports });

  // The job statistics answer both the alerts count and the jobs tab.
  const alerts = jobStats;

  const loading =
    statusLoading ||
    healthLoading ||
    jobStatsLoading ||
    apiMonitorLoading ||
    storageLoading ||
    dbLoading ||
    jobsLoading ||
    reportsLoading;

  // This loader really could throw where the others caught their own failures,
  // so the banner is kept — but it stays a fallback: it is only shown when the
  // main payload is absent, so a failed refresh cannot replace a console that is
  // already on screen. That is what the old `painted` flag guarded for.
  const loadError =
    statusError ||
    healthError ||
    jobStatsError ||
    apiMonitorError ||
    storageError ||
    dbError ||
    jobsError ||
    reportsError;
  const error =
    status === null && loadError ? t(loadError) || loadError : null;

  // The refresh button re-reads every source, as the old single loader did.
  const refreshAll = () => {
    refreshStatus();
    refreshHealth();
    refreshJobStats();
    refreshJobs();
    refreshReports();
  };

  const tabs = [
    { id: "overview", label: "adminMisc.system.tabs.overview", icon: HeartPulse },
    { id: "health", label: "adminMisc.system.tabs.health", icon: Activity },
    { id: "alerts", label: "adminMisc.system.tabs.alerts", icon: AlertTriangle },
    { id: "api", label: "adminMisc.system.tabs.api", icon: BarChart3 },
    { id: "database", label: "adminMisc.system.tabs.database", icon: Database },
    { id: "storage", label: "adminMisc.system.tabs.storage", icon: HardDrive },
    { id: "jobs", label: "adminMisc.system.tabs.jobs", icon: Cpu },
    { id: "reports", label: "adminMisc.system.tabs.reports", icon: FileText },
  ];

  const runHealthCheck = async () => {
    setRunningHealth(true);
    try {
      const response = await fetch("/api/system/health");
      const data = await response.json();
      if (data.success) setHealth(data.results || []);
      // Re-fetch status after health check
      const statusRes = await fetch("/api/system/status");
      const statusData = await statusRes.json();
      if (statusData.success) setStatus(statusData);
    } catch (error) { console.error(error); }
    finally { setRunningHealth(false); }
  };

  const generateReport = async (type) => {
    setGeneratingReport(true);
    try {
      await fetch(`/api/system/reports?type=generate&report_type=${type}`);
      const response = await fetch("/api/system/reports?limit=10");
      const data = await response.json();
      if (data.success) setReports(data.reports || []);
    } catch (error) { console.error(error); }
    finally { setGeneratingReport(false); }
  };

  return (
    <>
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter flex items-center gap-2">
              <HeartPulse className="text-[var(--brand-orange)]" size={24} />
              {t("adminMisc.system.title")}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{t("adminMisc.system.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={runHealthCheck} disabled={runningHealth}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl hover:bg-[var(--surface-2)] transition-colors text-sm disabled:opacity-50">
              {runningHealth ? <Loader2 className="animate-spin" size={14} /> : <Activity size={14} />}
              {runningHealth ? t("adminMisc.system.running") : t("adminMisc.system.runHealthCheck")}
            </button>
            <button onClick={refreshAll}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl hover:bg-[var(--surface-2)] transition-colors text-sm">
              <RefreshCw size={14} /> {t("adminMisc.system.refresh")}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
                }`}>
                <Icon size={16} /> {t(tab.label)}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[var(--brand-orange)]" size={32} /></div>
        ) : error ? (
          <div className="bg-red-500/10 border-red-500/20 rounded-xl p-8 text-center">
            <AlertCircle className="mx-auto mb-3 text-red-400" size={40} />
            <p className="text-red-400">{error}</p>
          </div>
        ) : (
          <>
            {/* ─── OVERVIEW ──────────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {(Array.isArray(health) ? health : []).map((component) => {
                    const Icon = COMPONENT_ICONS[component.component] || Activity;
                    return (
                      <div key={component.id || component.component} className={`rounded-xl p-3 border ${STATUS_COLORS[component.status] || STATUS_COLORS.healthy}`}>
                        <Icon size={16} className="mb-1.5" />
                        <p className="text-xs font-medium capitalize truncate">{t(COMPONENT_KEYS[component.component] || "") || component.component}</p>
                        <p className={`text-[10px] mt-0.5 ${component.status === "healthy" ? "text-emerald-400" : component.status === "degraded" ? "text-amber-400" : "text-red-400"}`}>
                          {t(STATUS_KEYS[component.status] || "") || component.status}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
                    <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">{t("adminMisc.system.systemTitle")}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-[var(--text-secondary)]">{t("adminMisc.system.status")}</span>
                        <span className={`${status?.status === "healthy" ? "text-emerald-400" : status?.status === "degraded" ? "text-amber-400" : "text-red-400"}`}>
                          {t(STATUS_KEYS[status?.status] || "") || status?.status || t("adminMisc.system.unknown")}
                        </span>
                      </div>
                      <div className="flex justify-between"><span className="text-[var(--text-secondary)]">{t("adminMisc.system.uptime")}</span><span className="text-[var(--text-primary)]">{Math.round(status?.uptime || 0)}s</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-secondary)]">{t("adminMisc.system.env")}</span><span className="text-[var(--text-primary)]">{t(ENV_KEYS[status?.environment] || "") || status?.environment || t("adminMisc.system.na")}</span></div>
                    </div>
                  </div>
                  <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
                    <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">{t("adminMisc.system.apiActivity")}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div><p className="text-xl font-bold">{apiMonitor?.total_requests || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.requests")}</p></div>
                      <div><p className="text-xl font-bold text-red-400">{apiMonitor?.errors || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.errors")}</p></div>
                    </div>
                  </div>
                  <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
                    <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">{t("adminMisc.system.storage")}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div><p className="text-xl font-bold">{storage?.database_size_mb || 0} MB</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.database")}</p></div>
                      <div><p className="text-xl font-bold">{storage?.total_ventures || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.ventures")}</p></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── HEALTH ────────────────────────────────────────────────── */}
            {activeTab === "health" && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(Array.isArray(health) ? health : []).map((component) => {
                    const Icon = COMPONENT_ICONS[component.component] || Activity;
                    return (
                      <div key={component.id || component.component} className={`rounded-xl p-4 border ${STATUS_COLORS[component.status] || STATUS_COLORS.healthy}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2"><Icon size={18} /><span className="font-medium capitalize">{t(COMPONENT_KEYS[component.component] || "") || component.component}</span></div>
                          {component.status === "healthy" ? <CheckCircle2 size={18} className="text-emerald-400" /> :
                           component.status === "degraded" ? <AlertTriangle size={18} className="text-amber-400" /> :
                           <XCircle size={18} className="text-red-400" />}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">{component.message || t("adminMisc.system.noMessage")}</p>
                        {component.response_time_ms != null && <p className="text-xs text-[var(--text-secondary)] mt-2">{t("adminMisc.system.responseTime", { ms: component.response_time_ms })}</p>}
                        <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{formatDate(component.checked_at)}</p>
                      </div>
                    );
                  })}
                </div>
                {(Array.isArray(health) ? health : []).length === 0 && (
                  <div className="bg-[var(--surface-1)] border-[var(--border-primary)] rounded-xl p-12 text-center">
                    <Activity className="mx-auto mb-3 text-[var(--text-secondary)]" size={40} />
                    <p className="text-[var(--text-secondary)]">{t("adminMisc.system.noHealthChecks")}</p>
                  </div>
                )}
              </div>
            )}

            {/* ─── ALERTS ────────────────────────────────────────────────── */}
            {activeTab === "alerts" && (
              <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
                <div className="p-4 border-b border-[var(--border-primary)] text-sm text-[var(--text-secondary)]">
                  {t("adminMisc.system.alertsOpen", { count: alerts?.open || 0 })} · {t("adminMisc.system.alertsCritical", { count: alerts?.critical || 0 })}
                </div>
                {status?.open_alerts?.length > 0 ? (
                  <div className="divide-y divide-[var(--border-secondary)]">
                    {status.open_alerts.map((alert) => (
                      <div key={alert.id} className="flex items-start gap-3 p-4">
                        {alert.severity === "critical" ? <AlertCircle size={16} className="mt-0.5 text-red-400 shrink-0" /> :
                         <AlertTriangle size={16} className="mt-0.5 text-amber-400 shrink-0" />}
                        <div>
                          <p className="text-sm font-medium">{alert.title}</p>
                          {alert.message && <p className="text-xs text-[var(--text-secondary)] mt-1">{alert.message}</p>}
                          <div className="flex gap-2 mt-1.5 text-[10px] text-[var(--text-secondary)]">
                            <span className={`px-1.5 py-0.5 rounded ${alert.severity === "critical" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
                              {alert.severity}
                            </span>
                            <span>{alert.alert_type?.replace(/_/g, " ")}</span>
                            <span>{formatDate(alert.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <CheckCircle2 className="mx-auto mb-3 text-emerald-400" size={40} />
                    <p className="text-[var(--text-secondary)]">{t("adminMisc.system.noOpenAlerts")}</p>
                  </div>
                )}
              </div>
            )}

            {/* ─── API ───────────────────────────────────────────────────── */}
            {activeTab === "api" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
                  <h3 className="text-sm font-medium mb-4">{t("adminMisc.system.summary")}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-[var(--bg-primary)] rounded-lg p-3"><p className="text-2xl font-bold">{apiMonitor?.total_requests || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.requests")}</p></div>
                    <div className="bg-[var(--bg-primary)] rounded-lg p-3"><p className="text-2xl font-bold text-red-400">{apiMonitor?.errors || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.errors")}</p></div>
                    <div className="bg-[var(--bg-primary)] rounded-lg p-3"><p className="text-2xl font-bold">{apiMonitor?.error_rate || 0}%</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.errorRate")}</p></div>
                  </div>
                </div>
                {apiMonitor?.slow_endpoints?.length > 0 && (
                  <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
                    <h3 className="text-sm font-medium mb-4">{t("adminMisc.system.slowEndpoints")}</h3>
                    <div className="space-y-1.5">
                      {apiMonitor.slow_endpoints.map((endpoint, index) => (
                        <div key={index} className="flex justify-between text-xs">
                          <span className="text-[var(--text-secondary)] font-mono truncate max-w-[250px]">{endpoint.endpoint}</span>
                          <span className="text-amber-400">{Math.round(endpoint.avg_ms)}ms</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── DATABASE ──────────────────────────────────────────────── */}
            {activeTab === "database" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
                  <h3 className="text-sm font-medium mb-4">{t("adminMisc.system.info")}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-[var(--border-secondary)]"><span className="text-[var(--text-secondary)]">{t("adminMisc.system.activeConnections")}</span><span>{dbInfo?.active_connections || 0}</span></div>
                    <div className="flex justify-between py-1 border-b border-[var(--border-secondary)]"><span className="text-[var(--text-secondary)]">{t("adminMisc.system.size")}</span><span>{dbInfo?.database_size_mb || 0} MB</span></div>
                  </div>
                </div>
                {dbInfo?.tables?.length > 0 && (
                  <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
                    <h3 className="text-sm font-medium mb-4">{t("adminMisc.system.tables")}</h3>
                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                      {dbInfo.tables.slice(0, 15).map((row, rowIndex) => (
                        <div key={rowIndex} className="flex justify-between text-xs py-1 border-b border-divider/30">
                          <span className="text-[var(--text-secondary)]">{row.tablename}</span>
                          <span className="text-[var(--text-secondary)]">{t("adminMisc.system.rows", { count: row.approx_rows })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── STORAGE ───────────────────────────────────────────────── */}
            {activeTab === "storage" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
                  <HardDrive size={20} className="text-blue-400 mb-2" />
                  <p className="text-2xl font-bold">{storage?.database_size_mb || 0} MB</p>
                  <p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.databaseSize")}</p>
                </div>
                <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
                  <Server size={20} className="text-emerald-400 mb-2" />
                  <p className="text-2xl font-bold">{storage?.total_ventures || 0}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.ventures")}</p>
                </div>
                <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
                  <Activity size={20} className="text-purple-400 mb-2" />
                  <p className="text-2xl font-bold">{storage?.total_users || 0}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.users")}</p>
                </div>
                <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
                  <FileText size={20} className="text-amber-400 mb-2" />
                  <p className="text-2xl font-bold">{storage?.total_documents || 0}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.documents")}</p>
                </div>
              </div>
            )}

            {/* ─── JOBS ──────────────────────────────────────────────────── */}
            {activeTab === "jobs" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4"><p className="text-2xl font-bold text-blue-400">{jobStats?.running || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.statsRunning")}</p></div>
                  <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4"><p className="text-2xl font-bold text-amber-400">{jobStats?.queued || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.statsQueued")}</p></div>
                  <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4"><p className="text-2xl font-bold text-red-400">{jobStats?.failed || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.statsFailed")}</p></div>
                  <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4"><p className="text-2xl font-bold text-emerald-400">{jobStats?.completed_24h || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.statsCompleted")}</p></div>
                </div>
                {jobs.length > 0 ? (
                  <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="border-b border-[var(--border-primary)]">
                <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.system.colJob")}</th>
                        <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.system.colType")}</th>
                        <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.system.status")}</th>
                        <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.system.duration")}</th>
                        <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.system.started")}</th>
                      </tr></thead>
                      <tbody>
                        {jobs.map((job) => (
                          <tr key={job.id} className="border-b border-[var(--border-secondary)]">
                            <td className="p-3 text-sm">{job.job_name}</td>
                            <td className="p-3 text-sm text-[var(--text-secondary)]">{job.job_type}</td>
                            <td className="p-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                job.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                                job.status === "running" ? "bg-blue-500/10 text-blue-400" :
                                job.status === "failed" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                              }`}>{job.status}</span>
                            </td>
                            <td className="p-3 text-sm text-[var(--text-secondary)]">{job.duration_ms ? `${job.duration_ms}ms` : "-"}</td>
                            <td className="p-3 text-sm text-[var(--text-secondary)]">{formatDate(job.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-[var(--surface-1)] border-[var(--border-primary)] rounded-xl p-12 text-center">
                    <Cpu className="mx-auto mb-3 text-[var(--text-secondary)]" size={40} />
                    <p className="text-[var(--text-secondary)]">{t("adminMisc.system.noJobs")}</p>
                  </div>
                )}
              </div>
            )}

            {/* ─── REPORTS ───────────────────────────────────────────────── */}
            {activeTab === "reports" && (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => generateReport("daily")} disabled={generatingReport}
                    className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl text-sm hover:bg-[var(--surface-2)] disabled:opacity-50 flex items-center gap-2">
                    {generatingReport && <Loader2 className="animate-spin" size={12} />}
                    {t("adminMisc.system.generateDailyReport")}
                  </button>
                  <button onClick={() => generateReport("weekly")} disabled={generatingReport}
                    className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl text-sm hover:bg-[var(--surface-2)] disabled:opacity-50">
                    {t("adminMisc.system.generateWeeklyReport")}
                  </button>
                  <button onClick={() => generateReport("monthly")} disabled={generatingReport}
                    className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl text-sm hover:bg-[var(--surface-2)] disabled:opacity-50">
                    {t("adminMisc.system.generateMonthlyReport")}
                  </button>
                </div>
                {reports.length > 0 ? (
                  <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="border-b border-[var(--border-primary)]">
                        <th className="text-left p-3 text-xs text-[var(--text-secondary)]">{t("adminMisc.system.colTitle")}</th>
                        <th className="text-left p-3 text-xs text-[var(--text-secondary)]">{t("adminMisc.system.colType")}</th>
                        <th className="text-left p-3 text-xs text-[var(--text-secondary)]">{t("adminMisc.system.period")}</th>
                        <th className="text-left p-3 text-xs text-[var(--text-secondary)] max-w-[300px]">{t("adminMisc.system.summary")}</th>
                        <th className="text-left p-3 text-xs text-[var(--text-secondary)]">{t("adminMisc.system.generated")}</th>
                      </tr></thead>
                      <tbody>
                        {reports.map((report) => (
                          <tr key={report.id} className="border-b border-[var(--border-secondary)]">
                            <td className="p-3 text-sm font-medium">{report.title}</td>
                            <td className="p-3"><span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">{t(REPORT_TYPE_KEYS[report.report_type] || "") || report.report_type}</span></td>
                            <td className="p-3 text-sm text-[var(--text-secondary)]">{report.period_start} → {report.period_end}</td>
                            <td className="p-3 text-sm text-[var(--text-secondary)] truncate max-w-[300px]">{report.summary}</td>
                            <td className="p-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">{formatDate(report.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-12 text-center">
                    <FileText className="mx-auto mb-3 text-[var(--text-secondary)]" size={40} />
                    <p className="text-[var(--text-secondary)]">{t("adminMisc.system.noReports")}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
