"use client";

import { Activity } from "lucide-react";

/**
 * The screen's header: the surface label, the signed-in person's name and the
 * effective role.
 *
 * Extracted verbatim from UnifiedDashboard.
 */
export default function DashboardHeader({ t, userName, role }) {
  return (
    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 border-b border-[var(--border-primary)] pb-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("navigation.dashboard")}
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
          {userName || t("common.loading")}
          <span className="text-[var(--text-secondary)] opacity-30 text-2xl ml-2">
            · {role?.replace(/_/g, " ") || ""}
          </span>
        </h1>
      </div>
    </header>
  );
}
