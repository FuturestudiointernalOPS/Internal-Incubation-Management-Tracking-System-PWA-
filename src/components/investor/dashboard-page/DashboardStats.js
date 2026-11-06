"use client";

import { BarChart3, Bookmark, Handshake } from "lucide-react";
import KpiCard from "@/components/ui/KpiCard";
import { useI18n } from "@/lib/i18n";

export default function DashboardStats({ stats, introductionCount = 0, introductions = false, loading = false, onNavigate }) {
  const { t } = useI18n();
  return (
    <div className="stf-grid c3">
      {[
        { id: "pipeline", label: t("dashboardV2.inPipeline"), value: stats.total_pipeline || 0, hint: t("dashboardV2.pipelineHint"), icon: BarChart3 },
        { id: "watchlist", label: t("watchlist"), value: stats.watchlist_count || 0, hint: t("dashboardV2.watchlistHint"), icon: Bookmark },
        ...(introductions
          ? [{ id: "introductions", label: t("dashboardV2.introductions"), value: introductionCount, hint: t("dashboardV2.introductionHint"), icon: Handshake }]
          : []),
      ].map((stat) => (
        <KpiCard
          key={stat.id}
          label={stat.label}
          value={stat.value}
          hint={stat.hint}
          icon={stat.icon}
          loading={loading}
          onClick={() => onNavigate?.(stat.id)}
        />
      ))}
    </div>
  );
}
