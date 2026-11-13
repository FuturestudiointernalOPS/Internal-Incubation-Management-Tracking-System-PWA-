"use client";

import { BarChart3 } from "lucide-react";

/**
 * QUICK STATS — the four inline counters of the sidebar (programmes, open tasks,
 * active blockers, overdue).
 *
 * Extracted verbatim from UnifiedDashboard.
 */
export default function QuickStatsCard({ t, summary }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-[var(--brand-orange)]" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
          {t("dashboard.quickStats", "Statistiques Rapides")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
          <p className="text-2xl font-black tracking-tight text-emerald-400">
            {summary.programs || 0}
          </p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">
            {t("dashboard.programs", "Programmes")}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
          <p className="text-2xl font-black tracking-tight text-blue-400">
            {summary.tasks?.open || 0}
          </p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">
            {t("dashboard.openTasks", "Tâches ouvertes")}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
          <p className="text-2xl font-black tracking-tight text-rose-400">
            {summary.blockers?.active || 0}
          </p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">
            {t("dashboard.activeBlockers", "Bloqueurs Actifs")}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
          <p className="text-2xl font-black tracking-tight text-amber-400">
            {summary.overdueTasks || 0}
          </p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">
            {t("dashboard.overdue", "En retard")}
          </p>
        </div>
      </div>
    </div>
  );
}
