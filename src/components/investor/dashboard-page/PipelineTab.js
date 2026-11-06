"use client";

import { useState } from "react";
import { BarChart3, Building2 } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import { PIPELINE_STAGES, STAGE_COLORS, STAGE_LABELS } from "./constants";
import ClaimInvestmentModal from "./ClaimInvestmentModal";

/**
 * The Pipeline tab: the stage filter row and the pipeline entries.
 * Phase 5: "I have invested" opens a claim form when confirmation is flagged on.
 */
export default function PipelineTab({
  pipeline,
  filteredPipeline,
  stageFilter,
  onStageFilterChange,
  processingId,
  onAddToPipeline,
  onClaimInvestment,
  onOpenWorkspace,
  onMessage,
  onSchedule,
  investmentConfirmation = false,
  messaging = false,
  meetings = false,
}) {
  const { t, lang } = useI18n();
  const { prompt, alert } = useDialogs();
  const [claimVenture, setClaimVenture] = useState(null);
  const [claimBusy, setClaimBusy] = useState(false);

  const stagesForSelect = investmentConfirmation
    ? PIPELINE_STAGES.filter((stage) => stage !== "invested")
    : PIPELINE_STAGES;

  const handleStageChange = async (item, nextStage) => {
    if (nextStage === "declined" && investmentConfirmation) {
      const reason = await prompt({
        message: t("dashboardV2.investment.declineReason"),
        required: true,
        inputLabel: t("dashboardV2.investment.declineReasonLabel"),
        validate: (value) =>
          String(value || "").trim() ? null : t("dashboardV2.investment.declineRequired"),
      });
      if (!reason) return;
      await onAddToPipeline(item.venture_id, nextStage, { declineReason: reason, notes: reason });
      return;
    }
    await onAddToPipeline(item.venture_id, nextStage);
  };

  const submitClaim = async (payload) => {
    if (!onClaimInvestment) return;
    setClaimBusy(true);
    try {
      const result = await onClaimInvestment(payload);
      if (result?.ok === false) {
        await alert({ message: result.error || t("errors.somethingWrong") });
        return;
      }
      setClaimVenture(null);
    } finally {
      setClaimBusy(false);
    }
  };

  const statusLabel = (item) => {
    if (!investmentConfirmation || item.stage !== "invested") return null;
    if (item.confirmation_status === "pending") {
      return t("dashboardV2.investment.pendingApproval");
    }
    if (item.confirmation_status === "confirmed") {
      return t("dashboardV2.investment.confirmed");
    }
    if (item.confirmation_status === "rejected") {
      return t("dashboardV2.investment.rejected");
    }
    return t("dashboardV2.investment.claimNeeded");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => onStageFilterChange("all")}
          className={`min-h-11 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${
            stageFilter === "all" ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)]"
          }`}
        >
          {t("dashboardV2.allStages")} ({pipeline.length})
        </button>
        {PIPELINE_STAGES.map((stage) => {
          const count = pipeline.filter((item) => item.stage === stage).length;
          if (count === 0 && stageFilter !== stage) return null;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => onStageFilterChange(stage)}
              className={`min-h-11 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${
                stageFilter === stage ? "bg-[var(--brand-orange)] text-white" : STAGE_COLORS[stage]
              }`}
            >
              {t(STAGE_LABELS[stage] || "")} ({count})
            </button>
          );
        })}
      </div>

      {filteredPipeline.length === 0 ? (
        <AppEmptyState
          title={t("dashboardV2.pipelineEmpty")}
          description={t("dashboardV2.pipelineEmptyHint")}
          icon={BarChart3}
          size="lg"
        />
      ) : (
        <div className="space-y-3">
          {filteredPipeline.map((item) => (
            <AppCard key={item.id} padding="md">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="w-8 h-8 text-brand-orange/60" />
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{item.venture_name || item.venture_id}</p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">
                      {new Date(item.stage_changed_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US")}
                    </p>
                    {statusLabel(item) && (
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] mt-1">
                        {statusLabel(item)}
                        {item.confirmation_status === "rejected" && item.investment_reject_reason
                          ? ` — ${item.investment_reject_reason}`
                          : ""}
                      </p>
                    )}
                    {item.confirmation_status === "pending" && item.investment_amount != null && (
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        {item.investment_amount} {item.investment_currency}
                        {item.investment_instrument ? ` · ${item.investment_instrument}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${STAGE_COLORS[item.stage]}`}>
                    {t(STAGE_LABELS[item.stage] || "") || item.stage}
                  </span>
                  {item.stage === "due_diligence" && (
                    <button
                      onClick={() => onOpenWorkspace(item.id)}
                      type="button"
                      className="min-h-11 rounded-lg bg-[var(--surface-3)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-primary)] hover:border-[var(--brand-orange)]"
                    >
                      {t("dashboardV2.openWorkspace")}
                    </button>
                  )}
                  {messaging && item.workspace_id && (
                    <AppButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onMessage?.(item.workspace_id)}
                    >
                      {t("dashboardV2.message")}
                    </AppButton>
                  )}
                  {meetings && item.workspace_id && (
                    <AppButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onSchedule?.()}
                    >
                      {t("dashboardV2.scheduleMeeting")}
                    </AppButton>
                  )}
                  {investmentConfirmation
                    && item.stage !== "invested"
                    && item.confirmation_status !== "pending" && (
                    <AppButton
                      type="button"
                      size="sm"
                      onClick={() => setClaimVenture(item)}
                      disabled={processingId !== null}
                    >
                      {t("dashboardV2.investment.iHaveInvested")}
                    </AppButton>
                  )}
                  {investmentConfirmation
                    && item.confirmation_status === "rejected" && (
                    <AppButton
                      type="button"
                      size="sm"
                      onClick={() => setClaimVenture(item)}
                      disabled={processingId !== null}
                    >
                      {t("dashboardV2.investment.resubmit")}
                    </AppButton>
                  )}
                  <select
                    value={stagesForSelect.includes(item.stage) ? item.stage : (item.stage === "invested" ? "negotiation" : item.stage)}
                    onChange={(event) => handleStageChange(item, event.target.value)}
                    disabled={processingId !== null || (investmentConfirmation && item.confirmation_status === "pending")}
                    aria-label={t("dashboardV2.changeStage", { venture: item.venture_name || item.venture_id })}
                    className="min-h-11 bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-lg px-2 py-1 text-[10px] font-bold text-[var(--text-primary)] outline-none disabled:opacity-40 disabled:cursor-wait"
                  >
                    {item.stage === "invested" && investmentConfirmation && (
                      <option value="invested">{t(STAGE_LABELS.invested)}</option>
                    )}
                    {stagesForSelect.map((stageOption) => (
                      <option key={stageOption} value={stageOption}>{t(STAGE_LABELS[stageOption] || "")}</option>
                    ))}
                  </select>
                </div>
              </div>
            </AppCard>
          ))}
        </div>
      )}

      <ClaimInvestmentModal
        isOpen={Boolean(claimVenture)}
        venture={claimVenture}
        busy={claimBusy}
        onClose={() => (claimBusy ? null : setClaimVenture(null))}
        onSubmit={submitClaim}
      />
    </div>
  );
}
