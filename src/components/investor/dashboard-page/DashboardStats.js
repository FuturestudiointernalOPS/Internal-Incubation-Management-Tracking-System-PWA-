"use client";

import { BarChart3, Target, Eye, Bookmark } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import { useI18n } from "@/lib/i18n";

/**
 * The four summary stat cards.
 * Extracted verbatim from InvestorDashboard.
 */
export default function DashboardStats({ stats }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: t("pipeline"), value: stats.total_pipeline || 0, icon: BarChart3, color: "text-[var(--brand-orange)]" },
        { label: t("invested"), value: stats.invested_count || 0, icon: Target, color: "text-emerald-400" },
        { label: t("evaluating"), value: stats.active_evaluations || 0, icon: Eye, color: "text-purple-400" },
        { label: t("watchlist"), value: stats.watchlist_count || 0, icon: Bookmark, color: "text-blue-400" },
      ].map((stat, index) => (
        <AppCard key={index} padding="md">
          <div className="flex items-center gap-3">
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
            <div>
              <p className="text-2xl font-black text-[var(--text-primary)]">{stat.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{stat.label}</p>
            </div>
          </div>
        </AppCard>
      ))}
    </div>
  );
}
