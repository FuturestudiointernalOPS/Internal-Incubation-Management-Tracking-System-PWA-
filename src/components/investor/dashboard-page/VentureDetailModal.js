"use client";

import { GitCompare, X, ArrowRight, FileText } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import { PIPELINE_STAGES, STAGE_COLORS, STAGE_LABELS } from "./constants";
import PrivateVentureNotes from "./PrivateVentureNotes";

/**
 * The venture detail modal (campaign summary, metrics, pipeline status, watchlist
 * toggle).
 * Extracted verbatim from InvestorDashboard.
 */
export default function VentureDetailModal({
  detailVenture,
  detailPipeline,
  watchlist,
  processingId,
  privateNotesEnabled = false,
  onClose,
  onToggleCompare,
  onToggleWatchlist,
  onDetailStageChange,
  onAddDetailToPipeline,
  introductions = false,
  onRequestIntro,
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="investor-venture-title">
        <div className="sticky top-0 z-10 bg-[var(--surface-1)] flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h3 id="investor-venture-title" className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">{detailVenture.name}</h3>
          <div className="flex items-center gap-2">
            <AppButton variant="secondary" size="sm" icon={GitCompare}
              onClick={() => onToggleCompare(detailVenture)}>
              {t("compare")}
            </AppButton>
            <button onClick={onClose}
              aria-label={t("common.close")}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-secondary)]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{detailVenture.description || t("dashboardV2.noDescription")}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t("industry"), value: detailVenture.industry || "—" },
              { label: t("country"), value: detailVenture.country || "—" },
              { label: t("dashboardV2.foundersLabel"), value: detailVenture.founders || 0 },
              { label: t("dashboardV2.founderCountries"), value: detailVenture.founders_countries?.join(", ") || "—" },
            ].map((metric, index) => (
              <div key={index} className="p-3 rounded-xl bg-[var(--surface-3)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{metric.label}</p>
                <p className="text-xs font-bold text-[var(--text-primary)] mt-1">{metric.value}</p>
              </div>
            ))}
          </div>
          {detailPipeline ? (
            <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">{t("dashboardV2.pipelineStatus")}</p>
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
              {t("dashboardV2.iAmInterested")}
            </AppButton>
          )}
          {detailVenture.deck?.id && (
            <a className="stf-btn" href={`/investor/deck/${detailVenture.deck.id}`}>
              <FileText size={14} /> {t("investorMisc.dealFlow.openDeck")}
            </a>
          )}
          {introductions && detailVenture.deal_flow_id && (
            <AppButton
              variant="secondary"
              size="sm"
              disabled={processingId !== null}
              onClick={() => onRequestIntro(detailVenture)}
            >
              {t("requestIntroduction")}
            </AppButton>
          )}
          <div className="flex gap-3 pt-2 border-t border-[var(--border-primary)]">
            <AppButton variant="secondary" size="sm" loading={processingId !== null} onClick={() => onToggleWatchlist(detailVenture.id)}>
              {watchlist.some(entry => entry.venture_id === detailVenture.id) ? t("removeFromWatchlist") : t("addToWatchlist")}
            </AppButton>
          </div>
          {privateNotesEnabled && <PrivateVentureNotes ventureId={String(detailVenture.id)} />}
        </div>
      </div>
    </div>
  );
}
