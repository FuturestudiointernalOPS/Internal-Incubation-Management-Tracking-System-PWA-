"use client";

import { AlertTriangle, Calendar, Inbox, Route } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import KpiCard from "@/components/ui/KpiCard";

/**
 * The four figures a Venture Manager opens a Venture for: how far the journey
 * has got, what is waiting on their review, what is late, and what is coming up.
 *
 * Read-only. It composes the same `/journey-report` payload the Super Admin's
 * attention block reads, plus the review-queue count the page has already
 * loaded — so it asks nothing new of the server, adds no endpoint and grants
 * nothing. Every card is a filter link to the tab where that work lives.
 */
const pickReport = (payload) => (payload?.success ? payload.journey_report : null);

export default function CockpitMetrics({ ventureId, reviewCount = 0, onNavigate }) {
  const { t } = useI18n();
  const { data: report, loading } = useApi(
    ventureId ? `/api/ventures/${ventureId}/journey-report` : null,
    { defaultValue: null, transform: pickReport, deps: [ventureId] },
  );

  const pending = Boolean(loading) && !report;
  const known = Boolean(report);

  const progress = report?.journey_progression || {};
  const activeStage =
    (report?.stages || []).find((stage) => stage.status === "active")?.name ||
    (report?.stages || [])[0]?.name ||
    null;

  // The page has already asked the server for THIS person's queue, scope filter
  // included — so its length is the honest figure, and the report's own count is
  // only the fallback while that read is still in flight.
  const awaiting = reviewCount > 0 ? reviewCount : report?.tasks_by_status?.review || 0;
  const overdue = (report?.overdue || []).length;
  const upcoming = report?.sessions?.upcoming || 0;

  const figure = (value) => (known ? value : "—");
  const go = (tab) => (onNavigate ? () => onNavigate(tab) : undefined);

  return (
    <div className="stf-grid c4">
      <KpiCard
        label={t("venture.attention.journeyProgress")}
        value={known && progress.progress_pct != null ? `${progress.progress_pct}%` : "—"}
        hint={activeStage || undefined}
        icon={Route}
        loading={pending}
        onClick={go("journey")}
      />
      <KpiCard
        label={t("venture.attention.awaitingReview")}
        value={figure(awaiting)}
        icon={Inbox}
        loading={pending}
        onClick={go("tasks")}
      />
      <KpiCard
        label={t("venture.attention.overdue")}
        value={figure(overdue)}
        icon={AlertTriangle}
        loading={pending}
        onClick={go("tasks")}
      />
      <KpiCard
        label={t("venture.attention.upcomingSessions")}
        value={figure(upcoming)}
        icon={Calendar}
        loading={pending}
        onClick={go("sessions")}
      />
    </div>
  );
}
