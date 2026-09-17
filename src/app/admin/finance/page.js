"use client";

import React, { useState, useCallback } from "react";
import { BarChart3 } from "lucide-react";
import DataSourceSelector from "@/components/finance/DataSourceSelector";
import SummaryCard from "@/components/finance/SummaryCard";
import BudgetExecutionGauge from "@/components/finance/BudgetExecutionGauge";
import MonthlyTrendChart from "@/components/finance/MonthlyTrendChart";
import LastSyncedDisplay from "@/components/finance/LastSyncedDisplay";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatXOF(val) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(val || 0);
}

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they must not be rebuilt
// every render: written inline they would be a new identity each time and would
// put a request on the wire per render.

const DATA_SOURCES_URL = "/api/admin/finance/data-sources";

/** The sources the selector offers: the active ones, internal ledger excluded. */
const pickActiveDataSources = (d) =>
  d?.success
    ? (d.dataSources || []).filter(
        (ds) => ds.status === "active" && ds.sourceType !== "internal",
      )
    : [];

/**
 * A summary or a month series. A refusal carries no figures, and a dashboard
 * that drew its cards from one would show noughts where it has no numbers, so
 * absence is reported as absence.
 */
const pickFinancePayload = (d) => (d?.success ? d : null);

// ─── Main Component ──────────────────────────────────────────────────────────

export default function FinanceDashboard() {
  const { t } = useI18n();

  // What the person picked in the selector. The first available source is the
  // default, and a default is derived rather than stored, so the choice and the
  // read can never disagree about which source is on screen.
  const [chosenId, setChosenId] = useState(null);

  const {
    data: dataSources,
    loading: sourcesLoading,
    error: sourcesError,
    status: sourcesStatus,
  } = useApi(DATA_SOURCES_URL, {
    defaultValue: [],
    transform: pickActiveDataSources,
  });

  const selectedId = chosenId || dataSources[0]?.id || null;

  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
    status: summaryStatus,
    refresh: refreshSummary,
  } = useApi(
    selectedId ? `/api/finance/summary?dataSourceId=${selectedId}` : null,
    { defaultValue: null, transform: pickFinancePayload, deps: [selectedId] },
  );

  const {
    data: monthlyData,
    loading: monthlyLoading,
    error: monthlyError,
    status: monthlyStatus,
    refresh: refreshMonthly,
  } = useApi(
    selectedId ? `/api/finance/monthly?dataSourceId=${selectedId}` : null,
    { defaultValue: null, transform: pickFinancePayload, deps: [selectedId] },
  );

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  // The sync is a WRITE, so its own 401 exists nowhere among the reads' statuses
  // and has to be remembered here.
  const [syncExpired, setSyncExpired] = useState(false);

  // ── The reads' verdicts, derived ─────────────────────────────────────────
  // A 401 is an expired session, any other refusal is the server refusing, and
  // a read that produced no response at all is the network. The three are told
  // apart because they need three different things from the person reading them.
  const statuses = [sourcesStatus, summaryStatus, monthlyStatus];
  const authError = statuses.includes(401) || syncExpired;
  const refused =
    statuses.find((s) => s !== null && s >= 400 && s !== 401) ?? null;
  const lost = sourcesError || summaryError || monthlyError;
  const fetchError = authError
    ? null
    : refused !== null
      ? t("finance.error.serverError")
      : lost
        ? t("finance.error.networkError")
        : null;

  // Every read spends exactly one render with its address chosen and its answer
  // not yet asked for - the hook's own flag rises in the effect, which is after
  // that render. Counting those renders as loading is what stops the empty state
  // from flashing between the source list arriving and its figures being asked
  // for.
  const summaryPending =
    Boolean(selectedId) &&
    summary === null &&
    summaryStatus === null &&
    !summaryError;
  const monthlyPending =
    Boolean(selectedId) &&
    monthlyData === null &&
    monthlyStatus === null &&
    !monthlyError;
  const loading =
    sourcesLoading ||
    summaryLoading ||
    monthlyLoading ||
    summaryPending ||
    monthlyPending;

  const refreshDashboard = useCallback(
    () => Promise.all([refreshSummary(), refreshMonthly()]),
    [refreshSummary, refreshMonthly],
  );

  // ── Handle data source change ──────────────────────────────────────────

  const handleDataSourceChange = (id) => {
    setChosenId(id);
  };

  // ── Handle sync ─────────────────────────────────────────────────────────

  const handleSync = useCallback(async () => {
    if (!selectedId) return;

    setSyncing(true);
    setSyncError(null);
    setSyncExpired(false);

    try {
      const res = await fetch(
        `/api/finance/sync?dataSourceId=${selectedId}`,
        { method: "POST" },
      );

      if (res.status === 401) {
        setSyncExpired(true);
        return;
      }

      if (res.status === 429) {
        const json = await res.json();
        setSyncError(t((json.error || t("finance.dashboard.syncRateLimited", { seconds: 60 })) || "") || (json.error || t("finance.dashboard.syncRateLimited", { seconds: 60 })));
        return;
      }

      if (res.ok) {
        // Re-read the dashboard after a successful sync, from the network rather
        // than from the cache, so the cards reflect what was just synchronised.
        await refreshDashboard();
      } else {
        setSyncError(t("finance.dashboard.syncError"));
      }
    } catch {
      setSyncError(t("finance.error.networkError"));
    } finally {
      setSyncing(false);
    }
  }, [selectedId, refreshDashboard, t]);

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
      <>
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
          <p
            className="text-sm font-bold"
            style={{ color: "var(--red)" }}
          >
            {t("finance.error.notAuth")}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
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
              onClick={() => refreshDashboard()}
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
    </>
  );
}
