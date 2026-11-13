"use client";

import { Search, BarChart3, Bookmark } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppTabs from "@/components/ui/AppTabs";

/**
 * The Discover | Pipeline | Watchlist strip, drawn with the shared tabs so it
 * keeps the same look, the same counts and the same keyboard behaviour as every
 * other tabbed screen.
 */
export default function DashboardTabs({ activeTab, onTabChange }) {
  const { t } = useI18n();
  const tabs = [
    { id: "discover", label: t("discover"), icon: Search },
    { id: "pipeline", label: t("pipeline"), icon: BarChart3 },
    { id: "watchlist", label: t("watchlist"), icon: Bookmark },
  ];

  return <AppTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />;
}
