"use client";

import { BarChart3, Bookmark, CalendarClock, Handshake, PiggyBank } from "lucide-react";
import KpiCard from "@/components/ui/KpiCard";
import { useI18n } from "@/lib/i18n";

/**
 * Number cards (Guide §9.3). Each card opens the matching tab.
 * Introductions / Meetings appear only when those phases are flagged on.
 */
export default function DashboardStats({
  stats = {},
  introductionCount = 0,
  meetingCount = 0,
  features = {},
  loading = false,
  onNavigate,
}) {
  const { t } = useI18n();
  const invested = Number(stats.invested_count || 0);
  const pendingInvestments = Number(stats.pending_investment_count || 0);

  const cards = [
    {
      id: "pipeline",
      label: t("dashboardV2.inPipeline"),
      value: Number(stats.total_pipeline || 0),
      hint: t("dashboardV2.pipelineHint"),
      icon: BarChart3,
    },
    {
      id: "watchlist",
      label: t("watchlist"),
      value: Number(stats.watchlist_count || 0),
      hint: t("dashboardV2.watchlistHint"),
      icon: Bookmark,
    },
    {
      id: "invested",
      label: t("dashboardV2.invested"),
      value: invested,
      hint:
        features.investmentConfirmation && pendingInvestments > 0
          ? t("dashboardV2.investedPendingHint", { count: pendingInvestments })
          : t("dashboardV2.investedHint"),
      icon: PiggyBank,
      tab: "pipeline",
    },
  ];

  if (features.introductions) {
    cards.push({
      id: "introductions",
      label: t("dashboardV2.introductions"),
      value: introductionCount,
      hint: t("dashboardV2.introductionHint"),
      icon: Handshake,
    });
  }

  if (features.meetings) {
    cards.push({
      id: "meetings",
      label: t("meetings"),
      value: meetingCount,
      hint: t("dashboardV2.meetingsHint"),
      icon: CalendarClock,
    });
  }

  return (
    <div className="stf-grid c3">
      {cards.map((stat) => (
        <KpiCard
          key={stat.id}
          label={stat.label}
          value={stat.value}
          hint={stat.hint}
          icon={stat.icon}
          loading={loading}
          onClick={() => onNavigate?.(stat.tab || stat.id)}
        />
      ))}
    </div>
  );
}
