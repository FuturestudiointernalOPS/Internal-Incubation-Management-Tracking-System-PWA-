"use client";

import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";
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

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
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

const COMPONENT_LABELS = {
  app: "adminMisc.system.components.app",
  database: "adminMisc.system.components.database",
  cache: "adminMisc.system.components.cache",
  queue: "adminMisc.system.components.queue",
  email: "adminMisc.system.components.email",
  storage: "adminMisc.system.components.storage",
  search: "adminMisc.system.components.search",
  notifications: "adminMisc.system.components.notifications",
  integrations: "adminMisc.system.components.integrations",
};

const STATUS_LABELS = {
  healthy: "adminMisc.system.statuses.healthy",
  degraded: "adminMisc.system.statuses.degraded",
  unhealthy: "adminMisc.system.statuses.unhealthy",
};

const ENV_LABELS = {
  development: "adminMisc.system.environments.development",
  staging: "adminMisc.system.environments.staging",
  production: "adminMisc.system.environments.production",
};

const SEVERITY_LABELS = {
  critical: "adminMisc.system.severities.critical",
  warning: "adminMisc.system.severities.warning",
  info: "adminMisc.system.severities.info",
};

const JOB_STATUS_LABELS = {
  completed: "adminMisc.system.jobStatuses.completed",
  running: "adminMisc.system.jobStatuses.running",
  failed: "adminMisc.system.jobStatuses.failed",
  queued: "adminMisc.system.jobStatuses.queued",
};

const REPORT_TYPE_LABELS = {
  daily: "adminMisc.system.reportTypes.daily",
  weekly: "adminMisc.system.reportTypes.weekly",
  monthly: "adminMisc.system.reportTypes.monthly",
};

export default function SystemMonitoringPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState([]);
  const [status, setStatus] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [apiMonitor, setApiMonitor] = useState(null);
  const [storage, setStorage] = useState(null);
  const [dbInfo, setDbInfo] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [jobStats, setJobStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [runningHealth, setRunningHealth] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

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

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [statusRes, healthRes, alertsRes, apiRes, storageRes, dbRes, jobsRes, jobStatsRes, reportsRes] = await Promise.all([
        fetch("/api/system/status"),
        fetch("/api/system/health?type=latest"),
        fetch("/api/system/jobs?type=stats"),
        fetch("/api/system/metrics?type=recent"),
        fetch("/api/system/storage"),
        fetch("/api/system/database"),
        fetch("/api/system/jobs?limit=20"),
        fetch("/api/system/jobs?type=stats"),
        fetch("/api/system/reports?limit=10"),
      ]);
      const [statusData, healthData, alertStatsData, apiData, storageData, dbData, jobsData, jobStatsData, reportsData] =
        await Promise.all([statusRes.json(), healthRes.json(), alertsRes.json(), apiRes.json(), storageRes.json(), dbRes.json(), jobsRes.json(), jobStatsRes.json(), reportsRes.json()]);
      if (statusData.success) setStatus(statusData);
      if (healthData.success) setHealth(healthData.results || healthData.checks || []);
      if (apiData.success) setApiMonitor(apiData);
      if (storageData.success) setStorage(storageData);
      if (dbData.success) setDbInfo(dbData);
      if (jobsData.success) setJobs(jobsData.jobs || []);
      if (jobStatsData.success) setJobStats(jobStatsData);
      if (reportsData.success) setReports(reportsData.reports || []);
      setAlerts(alertStatsData);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const runHealthCheck = async () => {
    setRunningHealth(true);
    try {
      const res = await fetch("/api/system/health");
      const data = await res.json();
      if (data.success) setHealth(data.results || []);
      // Re-fetch status after health check
      const statusRes = await fetch("/api/system/status");
      const statusData = await statusRes.json();
      if (statusData.success) setStatus(statusData);
    } catch (err) { console.error(err); }
    finally { setRunningHealth(false); }
  };

  const generateReport = async (type) => {
    setGeneratingReport(true);
    try {
      await fetch(`/api/system/reports?type=generate&report_type=${type}`);
      const res = await fetch("/api/system/reports?limit=10");
      const data = await res.json();
      if (data.success) setReports(data.reports || []);
    } catch (err) { console.error(err); }
    finally { setGeneratingReport(false); }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#020617] text-white p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <HeartPulse className="text-[var(--brand-orange)]" size={24} />
              {t("adminMisc.system.title")}
            </h1>
            <p className="text-gray-400 mt-1">{t("adminMisc.system.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={runHealthCheck} disabled={runningHealth}
              className="flex items-center gap-2 px-4 py-2 bg-[#0f172a] border border-gray-800 rounded-xl hover:bg-[#1e293b] transition-colors text-sm disabled:opacity-50">
              {runningHealth ? <Loader2 className="animate-spin" size={14} /> : <Activity size={14} />}
              {runningHealth ? t("adminMisc.system.running") : t("adminMisc.system.runHealthCheck")}
            </button>
            <button onClick={fetchAll}
              className="flex items-center gap-2 px-4 py-2 bg-[#0f172a] border border-gray-800 rounded-xl hover:bg-[#1e293b] transition-colors text-sm">
              <RefreshCw size={14} /> {t("adminMisc.system.refresh")}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#0f172a] border border-gray-800 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id ? "bg-[var(--brand-orange)] text-black" : "text-gray-400 hover:text-white hover:bg-white/5"
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
                  {(Array.isArray(health) ? health : []).map((c) => {
                    const Icon = COMPONENT_ICONS[c.component] || Activity;
                    return (
                      <div key={c.id || c.component} className={`rounded-xl p-3 border ${STATUS_COLORS[c.status] || STATUS_COLORS.healthy}`}>
                        <Icon size={16} className="mb-1.5" />
                        <p className="text-xs font-medium truncate">{t(COMPONENT_LABELS[c.component] || "") || c.component}</p>
                        <p className={`text-[10px] mt-0.5 ${c.status === "healthy" ? "text-emerald-400" : c.status === "degraded" ? "text-amber-400" : "text-red-400"}`}>
                          {t(STATUS_LABELS[c.status] || "") || c.status}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-300 mb-3">{t("adminMisc.system.systemTitle")}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">{t("adminMisc.system.status")}</span>
                        <span className={`${status?.status === "healthy" ? "text-emerald-400" : status?.status === "degraded" ? "text-amber-400" : "text-red-400"}`}>
                          {t(STATUS_LABELS[status?.status] || "") || status?.status || t("adminMisc.system.unknown")}
                        </span>
                      </div>
                      <div className="flex justify-between"><span className="text-gray-500">{t("adminMisc.system.uptime")}</span><span className="text-gray-300">{Math.round(status?.uptime || 0)}s</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">{t("adminMisc.system.env")}</span><span className="text-gray-300">{t(ENV_LABELS[status?.environment] || "") || status?.environment || t("adminMisc.system.na")}</span></div>
                    </div>
                  </div>
                  <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-300 mb-3">{t("adminMisc.system.apiActivity")}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div><p className="text-xl font-bold">{apiMonitor?.total_requests || 0}</p><p className="text-xs text-gray-500">{t("adminMisc.system.requests")}</p></div>
                      <div><p className="text-xl font-bold text-red-400">{apiMonitor?.errors || 0}</p><p className="text-xs text-gray-500">{t("adminMisc.system.errors")}</p></div>
                    </div>
                  </div>
                  <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-300 mb-3">{t("adminMisc.system.storage")}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div><p className="text-xl font-bold">{storage?.database_size_mb || 0} MB</p><p className="text-xs text-gray-500">{t("adminMisc.system.database")}</p></div>
                      <div><p className="text-xl font-bold">{storage?.total_ventures || 0}</p><p className="text-xs text-gray-500">{t("adminMisc.system.ventures")}</p></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── HEALTH ────────────────────────────────────────────────── */}
            {activeTab === "health" && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(Array.isArray(health) ? health : []).map((c) => {
                    const Icon = COMPONENT_ICONS[c.component] || Activity;
                    return (
                      <div key={c.id || c.component} className={`rounded-xl p-4 border ${STATUS_COLORS[c.status] || STATUS_COLORS.healthy}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2"><Icon size={18} /><span className="font-medium">{t(COMPONENT_LABELS[c.component] || "") || c.component}</span></div>
                          {c.status === "healthy" ? <CheckCircle2 size={18} className="text-emerald-400" /> :
                           c.status === "degraded" ? <AlertTriangle size={18} className="text-amber-400" /> :
                           <XCircle size={18} className="text-red-400" />}
                        </div>
                        <p className="text-xs text-gray-400">{c.message || t("adminMisc.system.noMessage")}</p>
                        {c.response_time_ms != null && <p className="text-xs text-gray-500 mt-2">{t("adminMisc.system.responseTime", { ms: c.response_time_ms })}</p>}
                        <p className="text-[10px] text-gray-600 mt-1">{formatDate(c.checked_at)}</p>
                      </div>
                    );
                  })}
                </div>
                {(Array.isArray(health) ? health : []).length === 0 && (
                  <div className="bg-[#0f172a] border-gray-800 rounded-xl p-12 text-center">
                    <Activity className="mx-auto mb-3 text-gray-500" size={40} />
                    <p className="text-gray-400">{t("adminMisc.system.noHealthChecks")}</p>
                  </div>
                )}
              </div>
            )}

            {/* ─── ALERTS ────────────────────────────────────────────────── */}
            {activeTab === "alerts" && (
              <div className="bg-[#0f172a] border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-gray-800 text-sm text-gray-400">
                  {t("adminMisc.system.alertsOpen", { count: alerts?.open || 0 })} · {t("adminMisc.system.alertsCritical", { count: alerts?.critical || 0 })}
                </div>
                {status?.open_alerts?.length > 0 ? (
                  <div className="divide-y divide-gray-800/50">
                    {status.open_alerts.map((a) => (
                      <div key={a.id} className="flex items-start gap-3 p-4">
                        {a.severity === "critical" ? <AlertCircle size={16} className="mt-0.5 text-red-400 shrink-0" /> :
                         <AlertTriangle size={16} className="mt-0.5 text-amber-400 shrink-0" />}
                        <div>
                          <p className="text-sm font-medium">{a.title}</p>
                          {a.message && <p className="text-xs text-gray-400 mt-1">{a.message}</p>}
                          <div className="flex gap-2 mt-1.5 text-[10px] text-gray-500">
                            <span className={`px-1.5 py-0.5 rounded ${a.severity === "critical" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
                              {t(SEVERITY_LABELS[a.severity] || "") || a.severity}
                            </span>
                            <span>{a.alert_type?.replace(/_/g, " ")}</span>
                            <span>{formatDate(a.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <CheckCircle2 className="mx-auto mb-3 text-emerald-400" size={40} />
                    <p className="text-gray-400">{t("adminMisc.system.noOpenAlerts")}</p>
                  </div>
                )}
              </div>
            )}

            {/* ─── API ───────────────────────────────────────────────────── */}
            {activeTab === "api" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                  <h3 className="text-sm font-medium mb-4">{t("adminMisc.system.summary")}</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#020617] rounded-lg p-3"><p className="text-2xl font-bold">{apiMonitor?.total_requests || 0}</p><p className="text-xs text-gray-500">{t("adminMisc.system.requests")}</p></div>
                    <div className="bg-[#020617] rounded-lg p-3"><p className="text-2xl font-bold text-red-400">{apiMonitor?.errors || 0}</p><p className="text-xs text-gray-500">{t("adminMisc.system.errors")}</p></div>
                    <div className="bg-[#020617] rounded-lg p-3"><p className="text-2xl font-bold">{apiMonitor?.error_rate || 0}%</p><p className="text-xs text-gray-500">{t("adminMisc.system.errorRate")}</p></div>
                  </div>
                </div>
                {apiMonitor?.slow_endpoints?.length > 0 && (
                  <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium mb-4">{t("adminMisc.system.slowEndpoints")}</h3>
                    <div className="space-y-1.5">
                      {apiMonitor.slow_endpoints.map((e, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-400 font-mono truncate max-w-[250px]">{e.endpoint}</span>
                          <span className="text-amber-400">{Math.round(e.avg_ms)}ms</span>
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
                <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                  <h3 className="text-sm font-medium mb-4">{t("adminMisc.system.info")}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-gray-800/50"><span className="text-gray-400">{t("adminMisc.system.activeConnections")}</span><span>{dbInfo?.active_connections || 0}</span></div>
                    <div className="flex justify-between py-1 border-b border-gray-800/50"><span className="text-gray-400">{t("adminMisc.system.size")}</span><span>{dbInfo?.database_size_mb || 0} MB</span></div>
                  </div>
                </div>
                {dbInfo?.tables?.length > 0 && (
                  <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium mb-4">{t("adminMisc.system.tables")}</h3>
                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                      {dbInfo.tables.slice(0, 15).map((row, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-800/30">
                          <span className="text-gray-400">{row.tablename}</span>
                          <span className="text-gray-500">{t("adminMisc.system.rows", { count: row.approx_rows })}</span>
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
                <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                  <HardDrive size={20} className="text-blue-400 mb-2" />
                  <p className="text-2xl font-bold">{storage?.database_size_mb || 0} MB</p>
                  <p className="text-xs text-gray-500">{t("adminMisc.system.databaseSize")}</p>
                </div>
                <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                  <Server size={20} className="text-emerald-400 mb-2" />
                  <p className="text-2xl font-bold">{storage?.total_ventures || 0}</p>
                  <p className="text-xs text-gray-500">{t("adminMisc.system.ventures")}</p>
                </div>
                <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                  <Activity size={20} className="text-purple-400 mb-2" />
                  <p className="text-2xl font-bold">{storage?.total_users || 0}</p>
                  <p className="text-xs text-gray-500">{t("adminMisc.system.users")}</p>
                </div>
                <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                  <FileText size={20} className="text-amber-400 mb-2" />
                  <p className="text-2xl font-bold">{storage?.total_documents || 0}</p>
                  <p className="text-xs text-gray-500">{t("adminMisc.system.documents")}</p>
                </div>
              </div>
            )}

            {/* ─── JOBS ──────────────────────────────────────────────────── */}
            {activeTab === "jobs" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4"><p className="text-2xl font-bold text-blue-400">{jobStats?.running || 0}</p><p className="text-xs text-gray-500">{t("adminMisc.system.statsRunning")}</p></div>
                  <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4"><p className="text-2xl font-bold text-amber-400">{jobStats?.queued || 0}</p><p className="text-xs text-gray-500">{t("adminMisc.system.statsQueued")}</p></div>
                  <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4"><p className="text-2xl font-bold text-red-400">{jobStats?.failed || 0}</p><p className="text-xs text-gray-500">{t("adminMisc.system.statsFailed")}</p></div>
                  <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4"><p className="text-2xl font-bold text-emerald-400">{jobStats?.completed_24h || 0}</p><p className="text-xs text-gray-500">{t("adminMisc.system.statsCompleted")}</p></div>
                </div>
                {jobs.length > 0 ? (
                  <div className="bg-[#0f172a] border border-gray-800 rounded-xl overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="border-b border-gray-800">
                        <th className="text-left p-3 text-xs text-gray-400">{t("adminMisc.system.colJob")}</th>
                        <th className="text-left p-3 text-xs text-gray-400">{t("adminMisc.system.colType")}</th>
                        <th className="text-left p-3 text-xs text-gray-400">{t("adminMisc.system.status")}</th>
                        <th className="text-left p-3 text-xs text-gray-400">{t("adminMisc.system.duration")}</th>
                        <th className="text-left p-3 text-xs text-gray-400">{t("adminMisc.system.started")}</th>
                      </tr></thead>
                      <tbody>
                        {jobs.map((j) => (
                          <tr key={j.id} className="border-b border-gray-800/50">
                            <td className="p-3 text-sm">{j.job_name}</td>
                            <td className="p-3 text-sm text-gray-400">{j.job_type}</td>
                            <td className="p-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                j.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                                j.status === "running" ? "bg-blue-500/10 text-blue-400" :
                                j.status === "failed" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                              }`}>{t(JOB_STATUS_LABELS[j.status] || "") || j.status}</span>
                            </td>
                            <td className="p-3 text-sm text-gray-400">{j.duration_ms ? `${j.duration_ms}ms` : "-"}</td>
                            <td className="p-3 text-sm text-gray-500">{formatDate(j.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-[#0f172a] border-gray-800 rounded-xl p-12 text-center">
                    <Cpu className="mx-auto mb-3 text-gray-500" size={40} />
                    <p className="text-gray-400">{t("adminMisc.system.noJobs")}</p>
                  </div>
                )}
              </div>
            )}

            {/* ─── REPORTS ───────────────────────────────────────────────── */}
            {activeTab === "reports" && (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => generateReport("daily")} disabled={generatingReport}
                    className="px-4 py-2 bg-[#0f172a] border border-gray-800 rounded-xl text-sm hover:bg-[#1e293b] disabled:opacity-50 flex items-center gap-2">
                    {generatingReport && <Loader2 className="animate-spin" size={12} />}
                    {t("adminMisc.system.generateDailyReport")}
                  </button>
                  <button onClick={() => generateReport("weekly")} disabled={generatingReport}
                    className="px-4 py-2 bg-[#0f172a] border border-gray-800 rounded-xl text-sm hover:bg-[#1e293b] disabled:opacity-50">
                    {t("adminMisc.system.generateWeeklyReport")}
                  </button>
                  <button onClick={() => generateReport("monthly")} disabled={generatingReport}
                    className="px-4 py-2 bg-[#0f172a] border border-gray-800 rounded-xl text-sm hover:bg-[#1e293b] disabled:opacity-50">
                    {t("adminMisc.system.generateMonthlyReport")}
                  </button>
                </div>
                {reports.length > 0 ? (
                  <div className="bg-[#0f172a] border border-gray-800 rounded-xl overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="border-b border-gray-800">
                        <th className="text-left p-3 text-xs text-gray-400">{t("adminMisc.system.colTitle")}</th>
                        <th className="text-left p-3 text-xs text-gray-400">{t("adminMisc.system.colType")}</th>
                        <th className="text-left p-3 text-xs text-gray-400">{t("adminMisc.system.period")}</th>
                        <th className="text-left p-3 text-xs text-gray-400 max-w-[300px]">{t("adminMisc.system.summary")}</th>
                        <th className="text-left p-3 text-xs text-gray-400">{t("adminMisc.system.generated")}</th>
                      </tr></thead>
                      <tbody>
                        {reports.map((r) => (
                          <tr key={r.id} className="border-b border-gray-800/50">
                            <td className="p-3 text-sm font-medium">{r.title}</td>
                            <td className="p-3"><span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">{t(REPORT_TYPE_LABELS[r.report_type] || "") || r.report_type}</span></td>
                            <td className="p-3 text-sm text-gray-400">{r.period_start} → {r.period_end}</td>
                            <td className="p-3 text-sm text-gray-500 truncate max-w-[300px]">{r.summary}</td>
                            <td className="p-3 text-sm text-gray-500 whitespace-nowrap">{formatDate(r.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-12 text-center">
                    <FileText className="mx-auto mb-3 text-gray-500" size={40} />
                    <p className="text-gray-400">{t("adminMisc.system.noReports")}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
