"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DataSourceSelector from "@/components/finance/DataSourceSelector";
import SummaryCard from "@/components/finance/SummaryCard";
import BudgetExecutionGauge from "@/components/finance/BudgetExecutionGauge";
import MonthlyTrendChart from "@/components/finance/MonthlyTrendChart";
import LastSyncedDisplay from "@/components/finance/LastSyncedDisplay";
import { t } from "@/lib/i18n";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatXOF(val) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(val || 0);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function FinanceDashboard() {
  // Data sources
  const [dataSources, setDataSources] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [sourcesLoading, setSourcesLoading] = useState(true);

  // Dashboard data
  const [summary, setSummary] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  // Errors
  const [authError, setAuthError] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // ── Fetch data sources on mount ──────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/finance/data-sources");
        if (res.status === 401) {
          setAuthError(true);
          setSourcesLoading(false);
          return;
        }
        const json = await res.json();
        if (json.success && json.dataSources?.length) {
          // Filter to active external sources for the selector
          const active = json.dataSources.filter(
            (ds) => ds.status === "active" && ds.sourceType !== "internal",
          );
          setDataSources(active);
          if (!selectedId && active.length) {
            setSelectedId(active[0].id);
          }
        }
      } catch {
        setFetchError(t("finance.error.networkError"));
      } finally {
        setSourcesLoading(false);
      }
    })();
  }, []);

  // ── Fetch dashboard data when selectedId changes ────────────────────────

  const fetchDashboard = useCallback(async (dataSourceId) => {
    if (!dataSourceId) return;

    setLoading(true);
    setFetchError(null);
    setAuthError(false);

    try {
      const [sumRes, monRes] = await Promise.all([
        fetch(`/api/finance/summary?dataSourceId=${dataSourceId}`),
        fetch(`/api/finance/monthly?dataSourceId=${dataSourceId}`),
      ]);

      if (sumRes.status === 401 || monRes.status === 401) {
        setAuthError(true);
        return;
      }

      if (!sumRes.ok || !monRes.ok) {
        setFetchError(t("finance.error.serverError"));
        return;
      }

      const sumJson = await sumRes.json();
      const monJson = await monRes.json();

      if (sumJson.success) setSummary(sumJson);
      if (monJson.success) setMonthlyData(monJson);
    } catch {
      setFetchError(t("finance.error.networkError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchDashboard(selectedId);
    }
  }, [selectedId, fetchDashboard]);

  // ── Handle data source change ──────────────────────────────────────────

  const handleDataSourceChange = (id) => {
    setSelectedId(id);
  };

  // ── Handle sync ─────────────────────────────────────────────────────────

  const handleSync = useCallback(async () => {
    if (!selectedId) return;

    setSyncing(true);
    setSyncError(null);

    try {
      const res = await fetch(
        `/api/finance/sync?dataSourceId=${selectedId}`,
        { method: "POST" },
      );

      if (res.status === 401) {
        setAuthError(true);
        return;
      }

      if (res.status === 429) {
        const json = await res.json();
        setSyncError(json.error || t("finance.dashboard.syncRateLimited", { seconds: 60 }));
        return;
      }

      if (res.ok) {
        // Re-fetch dashboard data after successful sync
        await fetchDashboard(selectedId);
      } else {
        setSyncError(t("finance.dashboard.syncError"));
      }
    } catch {
      setSyncError(t("finance.error.networkError"));
    } finally {
      setSyncing(false);
    }
  }, [selectedId, fetchDashboard]);

  // ── Compute card statuses ──────────────────────────────────────────────

  const consumedStatus =
    !summary
      ? "blue"
      : summary.executionRate < 80
        ? "green"
        : summary.executionRate <= 100
          ? "amber"
          : "red";

  const remainingStatus =
    !summary
      ? "blue"
      : summary.remainingBudget >= 0
        ? "green"
        : "red";

  // ── Render ─────────────────────────────────────────────────────────────

  // Auth error — show message instead of dashboard
  if (authError) {
    return (
      <DashboardLayout role="super_admin">
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
          <p
            className="text-sm font-bold"
            style={{ color: "var(--red)" }}
          >
            {t("finance.error.notAuth")}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-6 pb-20">
        {/* ═══ Header ═══ */}
        <header
          className="flex flex-wrap items-center justify-between gap-4 border-b pb-5"
          style={{ borderColor: "var(--border-primary)" }}
        >
          <div className="flex items-center gap-3">
            <BarChart3
              className="w-6 h-6"
              style={{ color: "var(--brand-orange)" }}
            />
            <div>
              <h1
                className="text-2xl font-black uppercase tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {t("finance.dashboard.title")}
              </h1>
              <p
                className="text-[10px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("finance.dashboard.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <DataSourceSelector
              sources={dataSources}
              selectedId={selectedId}
              onSelect={handleDataSourceChange}
              loading={sourcesLoading}
            />
            <LastSyncedDisplay
              lastSyncAt={summary?.lastSyncAt}
              syncing={syncing}
              onSync={handleSync}
              syncError={syncError}
            />
          </div>
        </header>

        {/* ═══ Fetch Error Banner ═══ */}
        {fetchError && !loading && (
          <div
            className="rounded-xl p-4 flex items-center justify-between"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <span
              className="text-xs font-bold"
              style={{ color: "var(--red)" }}
            >
              {fetchError}
            </span>
            <button
              onClick={() => fetchDashboard(selectedId)}
              className="rounded-lg px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: "var(--red)",
                color: "#fff",
              }}
            >
              {t("finance.dashboard.retry")}
            </button>
          </div>
        )}

        {/* ═══ Loading: Skeleton ═══ */}
        {loading && !summary && (
          <div className="space-y-6">
            {/* Card skeletons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="card !p-5 animate-pulse"
                >
                  <div
                    className="h-3 w-20 rounded mb-3"
                    style={{ background: "var(--surface-2)" }}
                  />
                  <div
                    className="h-7 w-32 rounded"
                    style={{ background: "var(--surface-2)" }}
                  />
                </div>
              ))}
            </div>
            {/* Gauge skeleton */}
            <div
              className="card !p-6 animate-pulse flex items-center justify-center"
              style={{ minHeight: 260 }}
            >
              <div
                className="w-48 h-48 rounded-full"
                style={{ background: "var(--surface-2)" }}
              />
            </div>
            {/* Chart skeleton */}
            <div
              className="card !p-6 animate-pulse"
              style={{ minHeight: 300 }}
            >
              <div
                className="h-4 w-40 rounded mb-6"
                style={{ background: "var(--surface-2)" }}
              />
              <div
                className="h-52 w-full rounded"
                style={{ background: "var(--surface-2)" }}
              />
            </div>
          </div>
        )}

        {/* ═══ No Data State ═══ */}
        {!loading && !summary && !fetchError && (
          <div
            className="card !p-12 flex flex-col items-center justify-center gap-4 text-center"
            style={{ minHeight: 300 }}
          >
            <BarChart3
              className="w-12 h-12 opacity-30"
              style={{ color: "var(--text-secondary)" }}
            />
            <p
              className="text-sm font-bold"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("finance.dashboard.noData")}
            </p>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="rounded-lg px-6 py-2 text-xs font-bold uppercase tracking-wider"
              style={{
                background: "var(--brand-orange)",
                color: "#fff",
              }}
            >
              {syncing ? t("finance.dashboard.syncing") : t("finance.dashboard.syncNow")}
            </button>
          </div>
        )}

        {/* ═══ Summary Cards ═══ */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title={t("finance.summary.revenue")}
              value={formatXOF(summary.totalActualRevenue)}
              status="green"
              subtext={t("finance.summary.revenueSubtext")}
              icon="💰"
            />
            <SummaryCard
              title={t("finance.summary.budget")}
              value={formatXOF(summary.totalPlannedBudget)}
              status="blue"
              subtext={t("finance.summary.budgetSubtext", {
                year: dataSources.find((ds) => ds.id === selectedId)?.fiscalYear || "2025-2026",
              })}
              icon="📋"
            />
            <SummaryCard
              title={t("finance.summary.consumed")}
              value={formatXOF(summary.totalActualSpending)}
              status={consumedStatus}
              subtext={t("finance.summary.consumedSubtext")}
              icon="📊"
            />
            <SummaryCard
              title={t("finance.summary.remaining")}
              value={formatXOF(summary.remainingBudget)}
              status={remainingStatus}
              subtext={
                summary.remainingBudget >= 0
                  ? t("finance.summary.remainingSubtext")
                  : t("finance.summary.remainingNegative")
              }
              icon={summary.remainingBudget >= 0 ? "✅" : "⚠️"}
            />
          </div>
        )}

        {/* ═══ Gauge + Chart ═══ */}
        {summary && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Gauge — 2 cols on desktop */}
            <div className="lg:col-span-2">
              <BudgetExecutionGauge
                percentage={summary.executionRate}
                targetMin={90}
                targetMax={100}
                size={220}
              />
            </div>

            {/* Chart — 3 cols on desktop */}
            <div className="lg:col-span-3">
              <MonthlyTrendChart
                monthlyData={monthlyData?.data || []}
                totalBudget={summary.totalPlannedBudget}
              />
            </div>
          </div>
        )}

        {/* ═══ Sync success toast (auto-dismiss) ═══ */}
        {syncError && !syncing && (
          <div
            className="fixed bottom-6 right-6 rounded-xl px-5 py-3 shadow-lg z-50 text-xs font-bold animate-in slide-in-from-right"
            style={{
              background: "var(--red)",
              color: "#fff",
              opacity: 0.95,
            }}
          >
            {syncError}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
