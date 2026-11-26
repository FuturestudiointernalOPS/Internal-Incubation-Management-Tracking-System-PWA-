"use client";

import { ChevronRight, Rocket, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The standalone dashboard header (back link, title, refresh-all).
 * Extracted verbatim from VentureDashboard. The hub page that embeds the
 * dashboard supplies its own chrome, so this renders only when standalone.
 */
export default function DashboardHeader({ venture, onBack, onReload, loading }) {
  const { t, lang } = useI18n();
  return (
    <>
      {/* Header (standalone route only — the hub supplies its own) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2"
          >
            <ChevronRight className="w-3 h-3 rotate-180" /> {t("vadmin.dashboard.backToVenture", { name: venture.company_name || t("vadmin.dashboard.venture") })}
          </button>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight flex items-center gap-3">
            <Rocket className="w-7 h-7 text-[var(--brand-orange)]" />
            {t("vadmin.dashboard.startupDashboard")}
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {venture.company_name} · {venture.venture_id} · {t("vadmin.dashboard.updatedAt", { time: new Date().toLocaleTimeString(lang) })}
          </p>
        </div>
        <button
          onClick={onReload}
          className="px-4 py-2.5 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {t("vadmin.dashboard.refreshAll")}
        </button>
      </div>
    </>
  );
}
