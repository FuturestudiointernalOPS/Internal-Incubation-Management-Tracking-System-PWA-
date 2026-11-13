"use client";

import { BarChart3, Target, Eye, Bookmark } from "lucide-react";
import KpiCard from "@/components/ui/KpiCard";
import { useI18n } from "@/lib/i18n";

/**
 * The four figures of the investor workspace, drawn with the product's shared
 * figure card so the browser reads like every other home screen.
 */
export default function DashboardStats({ stats }) {
  const { t } = useI18n();
  const cards = [
    { key: "pipeline", label: t("pipeline"), value: stats.total_pipeline || 0, icon: BarChart3 },
    { key: "invested", label: t("invested"), value: stats.invested_count || 0, icon: Target },
    { key: "evaluating", label: t("evaluating"), value: stats.active_evaluations || 0, icon: Eye },
    { key: "watchlist", label: t("watchlist"), value: stats.watchlist_count || 0, icon: Bookmark },
  ];

  return (
    <div className="stf-grid c4">
      {cards.map((card) => (
        <KpiCard key={card.key} label={card.label} value={card.value} icon={card.icon} />
      ))}
    </div>
  );
}
