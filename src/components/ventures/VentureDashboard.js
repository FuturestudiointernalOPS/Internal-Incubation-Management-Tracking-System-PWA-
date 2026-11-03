"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import SkeletonCard from "./venture-dashboard/SkeletonCard";
import DashboardHeader from "./venture-dashboard/DashboardHeader";
import QuickActions from "./venture-dashboard/QuickActions";
import MetricsColumn from "./venture-dashboard/MetricsColumn";
import TeamCoachingColumn from "./venture-dashboard/TeamCoachingColumn";
import ActivityColumn from "./venture-dashboard/ActivityColumn";
import CockpitMetrics from "./cockpit/CockpitMetrics";
import CockpitDecisions from "./cockpit/CockpitDecisions";
import VentureReportingCharts from "./reporting/VentureReportingCharts";
import { useReviewQueue } from "./cockpit/useReviewQueue";

// ─── Read shapers (module scope: built once, never per render) ───────────

// The venture record.
const pickVenture = (payload) => (payload?.success ? payload.venture : null);

// The dashboard payload, with the server's own refusal folded into the value.
// That folded `failure` is what lets the screen tell the three failures apart:
// the shared hook reports a request that never answered as `error`, and a body
// that reports its own failure as data.
const EMPTY_DASHBOARD = { dashboard: null, failure: null };

const pickDashboard = (payload) =>
  payload?.success
    ? { dashboard: payload.dashboard, failure: null }
    : { dashboard: null, failure: payload?.error || null };

// A widget whose payload is not in hand yet.
const WIDGET_IDLE = { loading: true, error: null, empty: false, data: null };

// Whether one widget's slice of the payload counts as "nothing to show".
function isWidgetEmpty(data) {
  if (!data) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object") {
    if (data.recent && Array.isArray(data.recent)) return data.recent.length === 0 && !data.unread;
    if (data.items && Array.isArray(data.items)) return data.items.length === 0;
    return Object.keys(data).length === 0;
  }
  return false;
}

// ─── Main Dashboard Component ────────────────────────────────────────────

export default function VentureDashboard({ id, embedded = false }) {
  const router = useRouter();
  const { t } = useI18n();

  // Both reads go through the shared hook, which owns the cache, the cache-first
  // paint and the discarding of a stale answer, so this component keeps no copy
  // of its own and reads during render. The venture is read only by the
  // standalone route: the hub page that embeds this one has already fetched it
  // for its own header.
  const { data: venture, refresh: refreshVenture } = useApi(
    embedded ? null : `/api/ventures/${id}`,
    { defaultValue: null, transform: pickVenture },
  );

  const {
    data: dashState,
    loading,
    error: readError,
    status,
    refresh: refreshDashboard,
    setData: setDashState,
  } = useApi(`/api/ventures/${id}/dashboard`, {
    defaultValue: EMPTY_DASHBOARD,
    transform: pickDashboard,
  });
  const dashboard = dashState.dashboard;

  // The same queue the Venture Manager's cockpit shows. One hook, one endpoint,
  // one server-side scope filter — the Super Admin simply sees everything.
  const { items: reviewQueue, loading: queueLoading, decide } = useReviewQueue(id);

  // A KPI card is a filter link: on this surface the work lives in the hub's
  // own sections, so "journey" and "tasks" are routes, not query tabs.
  const goTo = (section) => {
    const base = `/admin/ventures/${id}`;
    if (section === "journey") router.push(`${base}/journey`);
    else if (section === "tasks") router.push(`${base}/tasks`);
    else if (section === "sessions") router.push(`${base}/sessions`);
  };

  // Three shapes of failure reach the screen: the server refusing (a status),
  // the payload reporting its own failure (a message), and a request that never
  // got an answer (an error).
  const loadFailed = Boolean(
    dashState.failure || readError || (status !== null && status >= 400),
  );

  // What each widget shows of the payload is DERIVED from it, during render. The
  // only state kept is the transient pair a single widget goes through while it
  // is being refreshed - spinning, then a failure message - so that a failed
  // refresh of one widget cannot erase the slice it failed to replace, and a
  // successful one cannot leave another widget's failure message standing.
  const [widgetOverlay, setWidgetOverlay] = useState({});

  const widgetBase = useMemo(() => {
    const base = {};
    for (const [key, value] of Object.entries(dashboard || {})) {
      base[key] = {
        loading: false,
        error: value === null ? t("vadmin.dashboard.loadFailed") : null,
        empty: value === null ? false : isWidgetEmpty(value),
        data: value,
      };
    }
    return base;
  }, [dashboard, t]);

  const widgetState = (key) => {
    const base = widgetBase[key] || WIDGET_IDLE;
    return widgetOverlay[key] ? { ...base, ...widgetOverlay[key] } : base;
  };

  const markWidget = (key, state) =>
    setWidgetOverlay((prev) => ({ ...prev, [key]: state }));

  const clearWidget = (key) =>
    setWidgetOverlay((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const reload = () => {
    refreshVenture();
    refreshDashboard();
    setWidgetOverlay({});
  };

  const refreshWidget = (key) => {
    markWidget(key, { loading: true, error: null });
    fetch(`/api/ventures/${id}/dashboard`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // The write's own answer is published into the read rather than
          // paying for a second read of what was just handed back.
          setDashState({ dashboard: data.dashboard, failure: null });
          clearWidget(key);
        } else {
          markWidget(key, { loading: false, error: t("vadmin.dashboard.refreshFailed") });
        }
      })
      .catch(() =>
        markWidget(key, { loading: false, error: t("vadmin.dashboard.refreshFailed") }),
      );
  };

  // Verification widget status → localized label; unknown statuses stay raw.
  const verificationStatusLabel = (status) => {
    const key =
      status === "verified" ? "verified" :
      status === "pending_review" ? "pending" :
      status === "rejected" ? "rejected" :
      status === "draft" ? "draft" : null;
    return key ? t(`vadmin.dashboard.${key}`) : (status ? status.replace(/_/g, " ") : t("vadmin.dashboard.draft"));
  };

  // When embedded in the Venture hub page, the hub provides the outer chrome
  // (venture header, tabs, back link); the standalone route keeps its own.
  const wrapperClass = embedded ? "space-y-8" : "max-w-6xl mx-auto space-y-8 pb-20";

  // ── Loading state (skeleton) ──
  if (loading && !dashboard) {
    return (
      <>
        <div className={wrapperClass}>
          {!embedded && (
            <div className="animate-pulse">
              <div className="h-8 w-64 rounded bg-[var(--surface-3)] mb-2" />
              <div className="h-4 w-96 rounded bg-[var(--surface-3)]" />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />)}
          </div>
        </div>
      </>
    );
  }

  // ── Error state (inline card — the hub header stays visible when embedded) ──
  if (loadFailed && !dashboard) {
    return (
      <>
        <div className={wrapperClass}>
          <div className="text-center py-16">
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t("vadmin.dashboard.dashboardError")}</h2>
            <p className="text-[var(--text-secondary)] mb-6">{t("vadmin.dashboard.loadFailed")}</p>
            <button onClick={reload} className="btn btn-primary gap-2">
              <RefreshCw className="w-4 h-4" /> {t("vadmin.dashboard.retry")}
            </button>
          </div>
        </div>
      </>
    );
  }

  const dashboardData = dashboard || {};
  const ventureData = venture || {};

  return (
    <>
      <div className={wrapperClass}>
        {!embedded && (
          <DashboardHeader
            venture={ventureData}
            onBack={() => router.push(`/admin/ventures/${id}`)}
            onReload={reload}
            loading={loading}
          />
        )}

        {/* Manager attention (Vinance 3 — what needs attention right now) */}
        <CockpitMetrics ventureId={id} onNavigate={goTo} />

        <CockpitDecisions items={reviewQueue} loading={queueLoading} onDecide={decide} />

        <QuickActions id={id} />

        {/* Progress & Metrics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 */}
          <MetricsColumn id={id} data={dashboardData} widgetState={widgetState} refreshWidget={refreshWidget} verificationStatusLabel={verificationStatusLabel} />

          {/* Column 2 */}
          <TeamCoachingColumn id={id} data={dashboardData} widgetState={widgetState} refreshWidget={refreshWidget} />

          {/* Column 3 */}
          <ActivityColumn data={dashboardData} widgetState={widgetState} refreshWidget={refreshWidget} />
        </div>

        {/* The same reporting charts the founder sees — the studio reads the
            Venture's numbers where the Venture reports them, not a second
            rendering of them. */}
        <VentureReportingCharts ventureId={id} />
      </div>
    </>
  );
}
