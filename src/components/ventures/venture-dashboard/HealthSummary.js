"use client";

import { useI18n } from "@/lib/i18n";

/**
 * The four-tile health summary row (profile, stage, team, readiness).
 * Extracted verbatim from VentureDashboard.
 */
export default function HealthSummary({ data }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">{t("vadmin.dashboard.profile")}</p>
        <p className="text-2xl font-black text-emerald-400">{data.profile_completion?.percentage || 0}%</p>
        <p className="text-[10px] text-emerald-500/60 mt-0.5">{data.profile_completion?.is_submitted ? t("vadmin.dashboard.submitted") : t("vadmin.dashboard.sectionsMissing", { count: data.profile_completion?.missing?.length || 0 })}</p>
      </div>
      <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">{t("vadmin.dashboard.stage")}</p>
        <p className="text-2xl font-black text-amber-400 capitalize">{data.venture?.business_stage?.replace(/_/g, " ") || "—"}</p>
        <p className="text-[10px] text-amber-500/60 mt-0.5">{t("vadmin.dashboard.currentMilestone")}</p>
      </div>
      <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">{t("vadmin.dashboard.team")}</p>
        <p className="text-2xl font-black text-blue-400">{data.team?.active || 0}</p>
        <p className="text-[10px] text-blue-500/60 mt-0.5">{t("vadmin.dashboard.activeMembers")}</p>
      </div>
      <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">{t("vadmin.dashboard.readiness")}</p>
        <p className="text-2xl font-black text-purple-400">{data.investment_readiness?.score || 0}%</p>
        <p className="text-[10px] text-purple-500/60 mt-0.5">{t("vadmin.dashboard.investmentScore")}</p>
      </div>
    </div>
  );
}
