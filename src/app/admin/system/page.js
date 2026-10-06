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
  Loader2,
  RefreshCw,
  BarChart3,
  FileText,
} from "lucide-react";
import SystemOverviewTab from "@/components/admin/system/SystemOverviewTab";
import SystemHealthTab from "@/components/admin/system/SystemHealthTab";
import SystemAlertsTab from "@/components/admin/system/SystemAlertsTab";
import SystemApiTab from "@/components/admin/system/SystemApiTab";
import SystemDatabaseTab from "@/components/admin/system/SystemDatabaseTab";
import SystemStorageTab from "@/components/admin/system/SystemStorageTab";
import SystemJobsTab from "@/components/admin/system/SystemJobsTab";
import SystemReportsTab from "@/components/admin/system/SystemReportsTab";

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
              <SystemOverviewTab
                health={health}
                status={status}
                apiMonitor={apiMonitor}
                storage={storage}
              />
            )}

            {/* ─── HEALTH ────────────────────────────────────────────────── */}
            {activeTab === "health" && <SystemHealthTab health={health} />}

            {/* ─── ALERTS ────────────────────────────────────────────────── */}
            {activeTab === "alerts" && (
              <SystemAlertsTab alerts={alerts} status={status} />
            )}

            {/* ─── API ───────────────────────────────────────────────────── */}
            {activeTab === "api" && <SystemApiTab apiMonitor={apiMonitor} />}

            {/* ─── DATABASE ──────────────────────────────────────────────── */}
            {activeTab === "database" && <SystemDatabaseTab dbInfo={dbInfo} />}

            {/* ─── STORAGE ───────────────────────────────────────────────── */}
            {activeTab === "storage" && <SystemStorageTab storage={storage} />}

            {/* ─── JOBS ──────────────────────────────────────────────────── */}
            {activeTab === "jobs" && (
              <SystemJobsTab jobStats={jobStats} jobs={jobs} />
            )}

            {/* ─── REPORTS ───────────────────────────────────────────────── */}
            {activeTab === "reports" && (
              <SystemReportsTab
                reports={reports}
                generatingReport={generatingReport}
                onGenerateReport={generateReport}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
