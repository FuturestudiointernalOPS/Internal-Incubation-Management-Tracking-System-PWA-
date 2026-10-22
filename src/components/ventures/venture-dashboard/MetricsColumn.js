"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Shield } from "lucide-react";
import WidgetCard from "./WidgetCard";

/**
 * Column 1 of the metrics row: the Data bank (document verification) status.
 *
 * The Stage & Evidence Score is not drawn here: its figure and its breakdown sit
 * in the health row above (HealthSummary), where the percentage opens its working.
 */
export default function MetricsColumn({ id, data, widgetState, refreshWidget, verificationStatusLabel }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      {/* Data bank — verification status */}
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
