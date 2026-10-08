"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, TrendingUp, User, Building2, Target, Clock } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CrmOpportunityDetailPage({ params }) {
  const { t } = useI18n();
  const router = useRouter();
  const { alert } = useDialogs();

  const [opp, setOpp]         = useState(null);
  const [history, setHistory] = useState([]);
  const [stages, setStages]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [moving, setMoving]   = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { id } = await params;
      try {
        const [oppRes, stagesRes] = await Promise.all([
          fetch(`/api/crm/opportunities/${id}`),
          fetch("/api/crm/pipelines"),  // will drill into pipeline stages on detail
        ]);
        const [oppData, stagesData] = await Promise.all([oppRes.json(), stagesRes.json()]);
        if (!alive) return;
        if (oppData.success) {
          setOpp(oppData.opportunity);
          setHistory(oppData.stageHistory ?? []);
          // Fetch stages for this opportunity's pipeline
          if (oppData.opportunity?.pipeline_id) {
            const psRes = await fetch(`/api/crm/pipelines/${oppData.opportunity.pipeline_id}`);
            const psData = await psRes.json();
            if (alive && psData.success) setStages(psData.stages ?? []);
          }
        } else {
          setError(t(oppData.error || "errors.somethingWrong"));
        }
      } catch {
        if (alive) setError(t("errors.somethingWrong"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [params, t]);

  async function handleStageMove(stageId) {
    if (!opp || moving) return;
    setMoving(true);
    try {
      const res = await fetch(`/api/crm/opportunities/${opp.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stageId }),
      });
      const data = await res.json();
      if (data.success) {
        setOpp(data.opportunity);
        // Refresh history
        const hr = await fetch(`/api/crm/opportunities/${opp.id}`);
        const hd = await hr.json();
        if (hd.success) setHistory(hd.stageHistory ?? []);
      } else {
        await alert({ message: t(data.error || "errors.somethingWrong") });
      }
    } catch {
      await alert({ message: t("errors.somethingWrong") });
    } finally {
      setMoving(false);
    }
  }

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  if (error || !opp) return (
    <div className="text-red-500">{error || t("crm.opportunities.notFound")}</div>
  );

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/crm/opportunities")}
          className="p-2 rounded-full hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
            {opp.name}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {opp.pipeline_name} · {opp.stage_name}
          </p>
        </div>
        <span className={`ml-auto inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold
          ${opp.status === "won" ? "bg-green-100 text-green-800" :
            opp.status === "lost" ? "bg-red-100 text-red-800" :
            "bg-[var(--surface-3)] text-[var(--text-primary)]"}`}>
          {t(`crm.opportunities.statuses.${opp.status}`)}
        </span>
      </div>

      {/* Stage pill navigator */}
      <div className="flex flex-wrap gap-2">
        {stages.map((s) => (
          <button
            key={s.id}
            disabled={moving || s.id === opp.stage_id}
            onClick={() => handleStageMove(s.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
              ${s.id === opp.stage_id
                ? "bg-[var(--brand-orange)] text-white"
                : "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)] border border-[var(--border-primary)]"}
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main */}
        <div className="md:col-span-2 space-y-6">
          {/* Commercial */}
          <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-4">
              {t("crm.opportunities.commercialLabel")}
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm text-[var(--text-primary)]">
              <div>
                <span className="text-[var(--text-secondary)] block text-xs">{t("crm.opportunities.valueLabel")}</span>
                <span className="font-semibold mt-1 block">
                  {opp.value != null ? `${Number(opp.value).toLocaleString()} ${opp.currency || ""}` : "—"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)] block text-xs">{t("crm.opportunities.probabilityLabel")}</span>
                <span className="font-semibold mt-1 block">
                  {opp.probability != null ? `${opp.probability}%` : "—"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)] block text-xs">{t("crm.opportunities.expectedCloseLabel")}</span>
                <span className="mt-1 block">{opp.expected_close_date || "—"}</span>
              </div>
              {opp.status === "lost" && (
                <div>
                  <span className="text-[var(--text-secondary)] block text-xs">{t("crm.opportunities.lostReasonLabel")}</span>
                  <span className="mt-1 block">{opp.lost_reason || "—"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {opp.description && (
            <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-3">
                {t("crm.leads.descriptionLabel")}
              </h2>
              <p className="text-sm text-[var(--text-primary)]">{opp.description}</p>
            </div>
          )}

          {/* Stage history */}
          <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-4">
              {t("crm.opportunities.stageHistoryLabel")}
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">{t("crm.opportunities.noHistory")}</p>
            ) : (
              <ol className="space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-[var(--text-secondary)] mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <span className="text-[var(--text-primary)]">
                        {h.from_stage_name
                          ? `${h.from_stage_name} → ${h.to_stage_name}`
                          : `${t("crm.opportunities.historyCreated")} → ${h.to_stage_name}`}
                      </span>
                      <span className="text-[var(--text-secondary)] ml-2 text-xs">
                        {h.changed_by_name || "—"} · {new Date(h.changed_at).toLocaleDateString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-4">
              {t("crm.leads.relationsLabel")}
            </h2>
            <div className="space-y-3">
              {opp.contact_name && (
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-primary)]">{opp.contact_name}</span>
                </div>
              )}
              {opp.organization_name && (
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-primary)]">{opp.organization_name}</span>
                </div>
              )}
              {opp.lead_title && (
                <div className="flex items-center gap-3">
                  <Target className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-secondary)]">
                    {t("crm.opportunities.fromLead")}: {opp.lead_title}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <TrendingUp className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-sm text-[var(--text-primary)]">
                  {t("crm.leads.ownerLabel")}: {opp.owner_name || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
