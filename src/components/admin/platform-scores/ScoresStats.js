"use client";

import { Users, Target, BarChart3, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The four stat cards above the respondents table.
 * Extracted verbatim from ScoresPage.
 */
export default function ScoresStats({ data, filteredStats, scoreFilterLabel }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="card p-4 text-center border-l-4 border-[var(--brand-orange)]">
        <Users className="w-4 h-4 text-[var(--brand-orange)] mx-auto mb-1" />
        <p className="text-2xl font-black tracking-tight text-[var(--brand-orange)]">
          {data.total_evaluated}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
          {t("adminMisc.platformScores.statTotalEvaluated")}
        </p>
      </div>
      <div className="card p-4 text-center border-l-4 border-emerald-500">
        <Target className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
        <p className="text-2xl font-black tracking-tight text-emerald-500">
          {filteredStats.qualifying}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
          {t("adminMisc.platformScores.statQualifying")}
        </p>
      </div>
      <div className="card p-4 text-center border-l-4 border-blue-500">
        <BarChart3 className="w-4 h-4 text-blue-500 mx-auto mb-1" />
        <p className="text-2xl font-black tracking-tight text-blue-500">
          {filteredStats.average}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
          {t("adminMisc.platformScores.statAvgScore")}
        </p>
      </div>
      <div className="card p-4 text-center border-l-4 border-amber-500">
        <Trophy className="w-4 h-4 text-amber-500 mx-auto mb-1" />
        <p className="text-2xl font-black tracking-tight text-amber-500">
          {scoreFilterLabel}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
          {t("adminMisc.platformScores.statThreshold")}
        </p>
      </div>
    </div>
  );
}
