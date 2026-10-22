"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { TrendingUp, Target } from "lucide-react";
import WidgetCard from "./WidgetCard";
import EvidenceBreakdown from "./EvidenceBreakdown";

/**
 * Column 1 of the metrics row: Stage & Evidence. The Data bank (verification)
 * widget was removed from this dashboard; its screen is still reached from the
 * Data bank tab of the Venture.
 *
 * The Profile Completion widget is GONE (WS4). It read `startup_profiles`, a
 * table no screen writes, and its only action opened a wizard route that does
 * not exist. Profile completeness is not Venture setup (which
 * the founder dashboard reports from the Venture's own records), so it is not
 * shown here at all rather than as a permanent 0%.
 */
export default function MetricsColumn({ data, widgetState, refreshWidget }) {
  const { t } = useI18n();
  const [showEvidence, setShowEvidence] = useState(false);
  return (
    <div className="space-y-6">
      {/* 1. Stage & Evidence Score — NOT the Data Room's Investment Readiness. */}
      <WidgetCard title={t("vadmin.dashboard.stageEvidenceScore")} icon={TrendingUp} iconColor="bg-purple-500/10"
        loading={widgetState("investment_readiness").loading} error={widgetState("investment_readiness").error}
        empty={widgetState("investment_readiness").empty} emptyMessage={t("vadmin.dashboard.completeProfileForScore")}
        onRefresh={() => refreshWidget("investment_readiness")}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {/* The percentage opens its working: required documents, approved or awaiting. */}
            <button
              type="button"
              onClick={() => setShowEvidence(true)}
              title={t("vadmin.dashboard.evidence.title")}
              aria-label={t("vadmin.dashboard.evidence.title")}
              className="text-3xl font-black text-purple-400 underline decoration-dotted underline-offset-4 hover:brightness-125"
            >
              {data.investment_readiness?.score || 0}%
            </button>
            <span className="text-[10px] font-bold text-[var(--text-secondary)] capitalize">{data.investment_readiness?.stage?.replace(/_/g, " ") || t("vadmin.dashboard.unknown")}</span>
          </div>
          <div className="w-full bg-tertiary rounded-full h-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all" style={{ width: `${data.investment_readiness?.score || 0}%` }} />
          </div>
          {(data.investment_readiness?.next_milestones || []).length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t("vadmin.dashboard.nextMilestones")}</p>
              {data.investment_readiness.next_milestones.map((milestone, index) => (
                <div key={index} className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                  <Target className="w-3 h-3 text-[var(--brand-orange)] shrink-0" />
                  {t(milestone.key, milestone.params)}
                </div>
              ))}
            </div>
          )}
        </div>
      </WidgetCard>
      <EvidenceBreakdown readiness={data.investment_readiness} isOpen={showEvidence} onClose={() => setShowEvidence(false)} />
    </div>
  );
}
