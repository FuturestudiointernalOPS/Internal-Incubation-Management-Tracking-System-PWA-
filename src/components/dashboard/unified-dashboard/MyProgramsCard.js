"use client";

import { Briefcase } from "lucide-react";
import { averageKpiProgress } from "@/lib/constants";

/**
 * MY PROGRAMMES — the rich cards: status, name, description and the programme's
 * KPI progress (the objectives' own average, falling back to the completion
 * index the programs endpoint already returned).
 *
 * Extracted verbatim from UnifiedDashboard; the read, the progress index and the
 * routes stay with the screen.
 */
export default function MyProgramsCard({
  t,
  programs,
  kpis,
  completionIndexById,
  fetching,
  onViewAll,
  onOpenProgram,
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-emerald-400" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {t("dashboard.myPrograms", "Mes Programmes")}
          </span>
          <span className="text-[10px] font-bold text-[var(--text-secondary)]">
            ({programs?.length || 0})
          </span>
        </div>
        <button
          onClick={onViewAll}
          className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wide hover:underline"
        >
          {t("common.viewAll", "Voir Tout")}
        </button>
      </div>
      {fetching ? (
        <div className="flex items-center justify-center py-8">
          <div
            className="w-5 h-5 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
            style={{
              borderColor: "rgba(255,102,0,0.1)",
              borderTopColor: "var(--brand-orange)",
            }}
          />
        </div>
      ) : programs?.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)] py-6 text-center">
          {t("dashboard.noPrograms", "Aucun programme")}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {programs?.slice(0, 4).map((program) => {
            const fallbackProgress =
              Number(program.completion_index) ||
              completionIndexById.get(String(program.id)) ||
              0;
            // Get this program's KPIs from dashboard data.
            const programKpis = (kpis || []).filter(
              (kpi) => String(kpi.program_id) === String(program.id),
            );
            // Each objective's rate is stored ready-made; every objective
            // weighs the same, so the programme figure is their plain
            // average. Objectives with no linked deliverable have no
            // cached row and are left out.
            const kpiProgress =
              programKpis.length > 0
                ? averageKpiProgress(
                    programKpis.map((kpi) => ({
                      progress: parseFloat(kpi.completion_rate) || 0,
                    })),
                  )
                : fallbackProgress;
            return (
              <div
                key={program.id}
                onClick={() => onOpenProgram(program)}
                className="p-4 rounded-xl bg-primary border border-[var(--border-primary)] hover:border-emerald-500/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">
                    {program.status || "Active"}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-[var(--text-primary)] truncate group-hover:text-emerald-400 transition-colors">
                  {program.name}
                </p>
                {program.description && (
                  <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">
                    {program.description}
                  </p>
                )}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                      {t("dashboard.kpiProgress", "KPI Progress")}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400">
                      {Number(kpiProgress).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--bg-tertiary)] rounded-full overflow-hidden border border-[var(--border-primary)]">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${kpiProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
