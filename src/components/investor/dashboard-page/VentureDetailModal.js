"use client";

import { GitCompare, X, Megaphone, ArrowRight } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import { PIPELINE_STAGES, STAGE_COLORS, STAGE_LABELS } from "./constants";

/**
 * The venture detail modal (campaign summary, metrics, pipeline status, watchlist
 * toggle).
 * Extracted verbatim from InvestorDashboard.
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 bg-[var(--surface-1)] flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">{detailVenture.name}</h3>
          <div className="flex items-center gap-2">
            <AppButton variant="secondary" size="sm" icon={GitCompare}
              onClick={() => onToggleCompare(detailVenture)}>
              Compare
            </AppButton>
            <button onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-secondary)]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {/* Campaign detail (if active) */}
          {(() => {
            const campaign = campaigns.find(candidate => candidate.venture_id === detailVenture.id);
            if (!campaign) return null;
            const progressPercent = campaign.target_raise > 0 ? Math.min(100, Math.round((parseFloat(campaign.current_raised || 0) / parseFloat(campaign.target_raise)) * 100)) : 0;
            return (
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 space-y-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Active Campaign: {campaign.name}</span>
                </div>
                {campaign.target_raise > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="font-bold text-[var(--text-secondary)]">${Number(campaign.current_raised || 0).toLocaleString()} raised</span>
                      <span className="font-black text-[var(--text-primary)]">{progressPercent}% of ${Number(campaign.target_raise).toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { label: "Min Investment", value: campaign.min_investment ? `$${Number(campaign.min_investment).toLocaleString()}` : "—" },
                    { label: "Investors", value: `${campaign.investor_count || 0} interested` },
                    { label: "Active DD", value: campaign.active_dd_count || 0 },
                  ].map((metric, index) => (
                    <div key={index} className="p-2 rounded-lg bg-[var(--surface-2)] text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{metric.label}</p>
                      <p className="text-[10px] font-bold text-[var(--text-primary)] mt-0.5">{metric.value}</p>
                    </div>
                  ))}
                </div>
                {campaign.closing_date && (
                  <p className="text-[10px] font-medium text-[var(--text-tertiary)]">Closing: {new Date(campaign.closing_date).toLocaleDateString()}</p>
                )}
              </div>
            );
          })()}
          <div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{detailVenture.description || "No description available."}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Industry", value: detailVenture.industry || "—" },
              { label: "Country", value: detailVenture.country || "—" },
              { label: "Status", value: detailVenture.status || "—" },
              { label: "Interest", value: `${detailVenture.investor_interest_count || 0} investors` },
            ].map((metric, index) => (
              <div key={index} className="p-3 rounded-xl bg-[var(--surface-3)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{metric.label}</p>
                <p className="text-xs font-bold text-[var(--text-primary)] mt-1">{metric.value}</p>
              </div>
            ))}
          </div>
          {detailPipeline ? (
            <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">Your Pipeline Status</p>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${STAGE_COLORS[detailPipeline.stage]}`}>
                  {t(STAGE_LABELS[detailPipeline.stage] || "")}
                </span>
                <select value={detailPipeline.stage}
                  onChange={event => onDetailStageChange(event.target.value)}
                  disabled={processingId !== null}
                  className="bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-lg px-2 py-1 text-[10px] font-bold text-[var(--text-primary)] outline-none disabled:opacity-40 disabled:cursor-wait">
                  {PIPELINE_STAGES.map(stageOption => <option key={stageOption} value={stageOption}>{t(STAGE_LABELS[stageOption] || "")}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <AppButton variant="primary" size="sm" icon={ArrowRight}
              loading={processingId !== null}
              onClick={onAddDetailToPipeline}>
              Add to Pipeline
            </AppButton>
          )}
          <div className="flex gap-3 pt-2 border-t border-[var(--border-primary)]">
            <AppButton variant="secondary" size="sm" loading={processingId !== null} onClick={() => onToggleWatchlist(detailVenture.id)}>
              {watchlist.some(entry => entry.venture_id === detailVenture.id) ? "Remove from Watchlist" : "Add to Watchlist"}
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  );
}
