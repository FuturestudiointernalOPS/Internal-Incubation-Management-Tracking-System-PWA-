/**
 * The reports page's business reads, through the shared hook.
 *
 * Every endpoint here already exists and is already gated (`ventures.view`
 * scoped, or `ventures.validate`); this file adds no door, it only asks the
 * doors that are there. `refreshAll` re-reads them together for the page's
 * Refresh button.
 */

"use client";

import { useCallback } from "react";
import { useApi } from "@/lib/hooks/useApi";

const pickDashboard = (payload) => (payload?.success ? payload : null);
const pickReadiness = (payload) => (payload?.success ? payload : null);
const pickBaseline = (payload) => (payload?.success ? payload.baseline || null : null);
const pickReports = (payload) => (payload?.success ? payload.reports || [] : []);
const pickTimeline = (payload) => (payload?.success ? payload.months || [] : []);

const NO_REPORTS = [];
const NO_MONTHS = [];

export function useReportsBusiness(ventureId) {
  const dashboard = useApi(ventureId ? `/api/ventures/${ventureId}/reporting/dashboard` : null, {
    defaultValue: null,
    transform: pickDashboard,
    deps: [ventureId],
  });

  const readiness = useApi(ventureId ? `/api/ventures/${ventureId}/investment-readiness` : null, {
    defaultValue: null,
    transform: pickReadiness,
    deps: [ventureId],
  });

  const baseline = useApi(ventureId ? `/api/ventures/${ventureId}/reporting/baseline` : null, {
    defaultValue: null,
    transform: pickBaseline,
    deps: [ventureId],
  });

  const reports = useApi(ventureId ? `/api/ventures/${ventureId}/reporting/monthly` : null, {
    defaultValue: NO_REPORTS,
    transform: pickReports,
    deps: [ventureId],
  });

  const timeline = useApi(ventureId ? `/api/ventures/${ventureId}/reports?type=execution-timeline` : null, {
    defaultValue: NO_MONTHS,
    transform: pickTimeline,
    deps: [ventureId],
  });

  const refreshBusiness = useCallback(() => {
    dashboard.refresh();
    readiness.refresh();
    baseline.refresh();
    reports.refresh();
    timeline.refresh();
  }, [dashboard, readiness, baseline, reports, timeline]);

  return {
    dashboard: dashboard.data,
    dashboardLoading: dashboard.loading,
    readiness: readiness.data,
    baseline: baseline.data,
    reports: reports.data,
    timeline: timeline.data,
    businessLoading: dashboard.loading || reports.loading || timeline.loading,
    refreshBusiness,
  };
}

export default useReportsBusiness;
