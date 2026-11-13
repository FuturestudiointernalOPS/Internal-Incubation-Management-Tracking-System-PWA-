"use client";

import { GitCompare, Megaphone, ArrowRight } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import InvestorModal from "./InvestorModal";
import { PIPELINE_STAGES, STAGE_LABELS, STAGE_TONES } from "./constants";

/**
 * The venture detail sheet: campaign summary, the facts, the pipeline status and
 * the watchlist toggle. It opens in the workspace's one window frame.
 */
export default function VentureDetailModal({
  detailVenture,
  detailPipeline,
  campaigns,
  watchlist,
  processingId,
  onClose,
  onToggleCompare,
  onToggleWatchlist,
  onDetailStageChange,
  onAddDetailToPipeline,
}) {
  const { t } = useI18n();
  const campaign = campaigns.find((candidate) => candidate.venture_id === detailVenture.id);
  const inWatchlist = watchlist.some((entry) => entry.venture_id === detailVenture.id);
  const campaignProgress =
    campaign && campaign.target_raise > 0
      ? Math.min(
          100,
          Math.round(
            (parseFloat(campaign.current_raised || 0) / parseFloat(campaign.target_raise)) * 100,
          ),
        )
      : 0;

  return (
    <InvestorModal
      title={detailVenture.name}
      subtitle={
        [detailVenture.industry, detailVenture.country].filter(Boolean).join(" · ") || undefined
      }
      onClose={onClose}
      actions={
        <AppButton variant="secondary" size="sm" icon={GitCompare} onClick={() => onToggleCompare(detailVenture)}>
          {t("member.investor.browser.compare.action")}
        </AppButton>
      }
      footer={
        <AppButton
          variant="secondary"
          size="sm"
          loading={processingId !== null}
          onClick={() => onToggleWatchlist(detailVenture.id)}
        >
          {inWatchlist
            ? t("member.investor.browser.detail.removeWatchlist")
            : t("member.investor.browser.detail.addWatchlist")}
        </AppButton>
      }
    >
      <div className="space-y-6">
        {campaign && (
          <div className="space-y-3 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-2)] p-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-[var(--brand-orange)]" aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">
                {t("member.investor.browser.detail.activeCampaign", { name: campaign.name })}
              </span>
            </div>
            {campaign.target_raise > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="font-bold text-[var(--text-secondary)]">
                    {t("member.investor.browser.detail.raised", {
                      amount: `$${Number(campaign.current_raised || 0).toLocaleString()}`,
                    })}
                  </span>
                  <span className="font-black text-[var(--text-primary)]">
                    {campaignProgress}% of ${Number(campaign.target_raise).toLocaleString()}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
                  <div
                    className="h-full rounded-full bg-[var(--progress-fill)] transition-all"
                    style={{ width: `${campaignProgress}%` }}
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                {
                  label: t("member.investor.browser.detail.minInvestment"),
                  value: campaign.min_investment
                    ? `$${Number(campaign.min_investment).toLocaleString()}`
                    : "—",
                },
                {
                  label: t("member.investor.browser.detail.investors"),
                  value: t("member.investor.browser.campaigns.interested", {
                    count: campaign.investor_count || 0,
                  }),
                },
                {
                  label: t("member.investor.browser.detail.activeDD"),
                  value: campaign.active_dd_count || 0,
                },
              ].map((metric) => (
                <div key={metric.label} className="rounded-lg bg-[var(--surface-1)] p-2 text-center">
                  <p className="stf-k">{metric.label}</p>
                  <p className="mt-1 text-[11px] font-bold text-[var(--text-primary)]">{metric.value}</p>
                </div>
              ))}
            </div>
            {campaign.closing_date && (
              <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
                {t("member.investor.browser.detail.closing", {
                  date: new Date(campaign.closing_date).toLocaleDateString(),
                })}
              </p>
            )}
          </div>
        )}

        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          {detailVenture.description || t("member.investor.browser.detail.noDescription")}
        </p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: t("member.investor.browser.compare.industry"), value: detailVenture.industry || "—" },
            { label: t("member.investor.browser.compare.country"), value: detailVenture.country || "—" },
            { label: t("member.investor.browser.compare.status"), value: detailVenture.status || "—" },
            {
              label: t("member.investor.browser.compare.interest"),
              value: t("member.investor.browser.compare.investors", {
                count: detailVenture.investor_interest_count || 0,
              }),
            },
          ].map((metric) => (
            <div key={metric.label} className="rounded-xl bg-[var(--surface-3)] p-3">
              <p className="stf-k">{metric.label}</p>
              <p className="mt-1 text-xs font-bold text-[var(--text-primary)]">{metric.value}</p>
            </div>
          ))}
        </div>

        {detailPipeline ? (
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-2)] p-4">
            <p className="mb-2 stf-k">{t("member.investor.browser.detail.pipelineStatus")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`stf-tag ${STAGE_TONES[detailPipeline.stage] ?? ""}`}>
                {t(STAGE_LABELS[detailPipeline.stage] || "")}
              </span>
              <select
                value={detailPipeline.stage}
                onChange={(event) => onDetailStageChange(event.target.value)}
                disabled={processingId !== null}
                aria-label={t("member.investor.browser.detail.pipelineStatus")}
                className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)] outline-none disabled:cursor-wait disabled:opacity-40"
              >
                {PIPELINE_STAGES.map((stageOption) => (
                  <option key={stageOption} value={stageOption}>
                    {t(STAGE_LABELS[stageOption] || "")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <AppButton
            variant="primary"
            size="sm"
            icon={ArrowRight}
            loading={processingId !== null}
            onClick={onAddDetailToPipeline}
          >
            {t("member.investor.browser.detail.addToPipeline")}
          </AppButton>
        )}
      </div>
    </InvestorModal>
  );
}
