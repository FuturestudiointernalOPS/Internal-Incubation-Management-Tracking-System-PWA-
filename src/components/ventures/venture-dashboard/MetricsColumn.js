"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { TrendingUp, Shield, Target } from "lucide-react";
import WidgetCard from "./WidgetCard";

/**
 * Column 1 of the metrics row: Stage & Evidence and verification.
 *
 * The Profile Completion widget is GONE (WS4). It read `startup_profiles`, a
 * table no screen writes, and its only action opened a wizard route that does
 * not exist. Profile completeness is not Venture setup (which
 * the founder dashboard reports from the Venture's own records), so it is not
 * shown here at all rather than as a permanent 0%.
 */
export default function MetricsColumn({ id, data, widgetState, refreshWidget, verificationStatusLabel }) {
  const router = useRouter();
  const { t } = useI18n();
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
            <span className="text-3xl font-black text-purple-400">{data.investment_readiness?.score || 0}%</span>
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

      {/* 2. Verification Status */}
      <WidgetCard title={t("vadmin.dashboard.verification")} icon={Shield} iconColor="bg-emerald-500/10"
        loading={widgetState("verification").loading} error={widgetState("verification").error}
        empty={widgetState("verification").empty} emptyMessage={t("vadmin.dashboard.noVerificationData")}
        onRefresh={() => refreshWidget("verification")}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded ${
              data.verification?.status === "verified" ? "bg-emerald-500/10 text-emerald-400" :
              data.verification?.status === "pending_review" ? "bg-amber-500/10 text-amber-400" :
              data.verification?.status === "rejected" ? "bg-rose-500/10 text-rose-400" :
              "bg-slate-500/10 text-slate-400"
            }`}>{verificationStatusLabel(data.verification?.status)}</span>
            <span className="text-[10px] font-bold text-[var(--text-secondary)]">{t("vadmin.dashboard.verifiedCount", { verified: data.verification?.verified_count || 0, total: data.verification?.total_count || 6 })}</span>
          </div>
          <div className="space-y-1.5">
            {(data.verification?.categories || []).map((category, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-tertiary rounded-lg">
                <span className="text-[10px] font-bold text-[var(--text-secondary)]">{category.label}</span>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  category.status === "verified" ? "bg-emerald-500/10 text-emerald-400" :
                  category.status === "rejected" ? "bg-rose-500/10 text-rose-400" :
                  category.status === "under_review" ? "bg-amber-500/10 text-amber-400" :
                  "bg-slate-500/10 text-slate-500"
                }`}>{verificationStatusLabel(category.status)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => router.push(`/admin/ventures/${id}/verification`)} className="w-full py-2 bg-brand-orange/10 text-[var(--brand-orange)] rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all">
            {t("vadmin.dashboard.openVerification")}
          </button>
        </div>
      </WidgetCard>
    </div>
  );
}
