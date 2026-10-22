"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import EvidenceBreakdown from "./EvidenceBreakdown";

// Module scope: the hook keys its callback on this function (see useApi).
const pickSetup = (payload) => (payload?.success ? payload.progress?.venture_setup ?? null : null);

/**
 * The four-tile health summary row (stage, team, venture setup, readiness).
 *
 * "Venture setup" is how much of the Venture's own record is filled in (profile
 * fields, founders, documents, business model, customer discovery) — the same
 * figure the founder sees, read from the same progress endpoint. It is NOT the
 * retired startup-profile completion: every input is a real Venture record.
 *
 * The old "Profile" tile was removed in WS4 alongside the Profile Completion
 * widget: it read `startup_profiles`, a table nothing writes, and so reported a
 * permanent 0% for every Venture.
 */
export default function HealthSummary({ data, ventureId, onOpenProfile }) {
  const { t } = useI18n();
  const [showEvidence, setShowEvidence] = useState(false);
  const { data: ventureSetup } = useApi(ventureId ? `/api/ventures/${ventureId}/progress` : null, {
    defaultValue: null,
    transform: pickSetup,
    deps: [ventureId],
  });
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      {/* The Profile figure opens the Profile tab it is calculated from. */}
      {(() => {
        const Tag = onOpenProfile ? "button" : "div";
        return (
          <Tag
            {...(onOpenProfile ? { type: "button", onClick: onOpenProfile, title: t("vadmin.dashboard.openProfile") } : {})}
            className={`${onOpenProfile ? "text-left hover:border-emerald-500/50 transition-colors " : ""}p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20`}
          >
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">{t("venture.progressOverview.ventureSetup")}</p>
            <p className="text-2xl font-black text-emerald-400">{ventureSetup === null ? "—" : `${ventureSetup}%`}</p>
            <p className="text-[10px] text-emerald-500/60 mt-0.5">{t("venture.progressOverview.ventureSetupHint")}</p>
          </Tag>
        );
      })()}
      <button
        type="button"
        onClick={() => setShowEvidence(true)}
        title={t("vadmin.dashboard.evidence.title")}
        className="text-left p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 hover:border-purple-500/50 transition-colors"
      >
        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">{t("vadmin.dashboard.stageEvidenceScore")}</p>
        <p className="text-2xl font-black text-purple-400">{data.investment_readiness?.score || 0}%</p>
        <p className="text-[10px] text-purple-500/60 mt-0.5">{t("vadmin.dashboard.stageEvidenceHint")}</p>
      </button>
      <EvidenceBreakdown readiness={data.investment_readiness} isOpen={showEvidence} onClose={() => setShowEvidence(false)} />
    </div>
  );
}
