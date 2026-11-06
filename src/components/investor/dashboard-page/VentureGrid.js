"use client";

import { Building2, ArrowRight, Loader2, Bookmark, BookmarkCheck, GitCompare, FileText } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { useI18n } from "@/lib/i18n";

export default function VentureGrid({
  items,
  hasSearched = false,
  venturesTotal,
  watchlist,
  compareList,
  processingId,
  pipeline,
  onOpenDetail,
  onToggleCompare,
  onToggleWatchlist,
  onRequestIntro,
  onAddToPipeline,
  onClearSearch,
  onOpenDealFlow,
  introductions = false,
}) {
  const { t } = useI18n();
  return items.length === 0 ? (
    <AppEmptyState
      title={t("noVentures")}
      description={t(hasSearched ? "dashboardV2.noMatchingVentures" : "dashboardV2.noRecommendations")}
      icon={Building2}
      size="lg"
      action={
        hasSearched ? (
          <AppButton variant="secondary" onClick={onClearSearch}>
            {t("dashboardV2.clearSearch")}
          </AppButton>
        ) : (
          <AppButton variant="secondary" onClick={onOpenDealFlow}>
            {t("dashboardV2.exploreDealFlow")}
          </AppButton>
        )
      }
    />
  ) : (
    <>
      <p className="text-[10px] text-[var(--text-tertiary)]">
        {t("dashboardV2.venturesFound", { count: venturesTotal || items.length })}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(venture => {
          const isWatching = watchlist.some(entry => entry.venture_id === venture.id);
          const isCompared = compareList.some(item => item.id === venture.id);
          const pipelineEntry = pipeline.find((item) =>
            String(item.venture_id) === String(venture.id)
            || String(item.venture_id) === String(venture.venture_id || ""),
          );
          return (
            <AppCard key={venture.id} padding="md" hover>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <button type="button" onClick={() => onOpenDetail(venture)} className="text-left flex-1">
                    <h4 className="text-sm font-black text-[var(--text-primary)] hover:text-[var(--brand-orange)] transition-colors">{venture.name}</h4>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{venture.industry || "—"}{venture.country ? ` · ${venture.country}` : ""}</p>
                    {venture.match_score > 0 && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400">
                        {t("dashboardV2.match", { score: venture.match_score })}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onToggleCompare(venture)}
                      className={`flex min-h-11 min-w-11 items-center justify-center rounded transition-colors ${isCompared ? "text-[var(--brand-orange)]" : "text-[var(--text-tertiary)] hover:text-[var(--brand-orange)]"}`}
                      aria-label={t(isCompared ? "dashboardV2.removeCompare" : "dashboardV2.addCompare")}>
                      <GitCompare className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => onToggleWatchlist(venture.id)}
                      disabled={processingId !== null}
                      className={`flex min-h-11 min-w-11 items-center justify-center rounded transition-colors ${isWatching ? "text-[var(--brand-orange)]" : "text-[var(--text-tertiary)] hover:text-[var(--brand-orange)]"} disabled:opacity-40 disabled:cursor-wait`}
                      aria-label={t(isWatching ? "removeFromWatchlist" : "addToWatchlist")}>
                      {processingId === venture.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isWatching ? <BookmarkCheck className="w-4 h-4 fill-current" /> : <Bookmark className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {venture.description && (
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{venture.description}</p>
                )}
                <p className="stf-small">
                  {t("dashboardV2.founders", { count: venture.founders || 0 })}
                  {venture.founders_countries?.length > 0 && ` · ${venture.founders_countries.join(", ")}`}
                </p>
                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-primary)] pt-3 pb-2">
                  {venture.deck?.id && (
                    <a
                      className="stf-btn relative z-10"
                      href={`/investor/deck/${encodeURIComponent(venture.deck.id)}`}
                    >
                      <FileText size={14} /> {t("investorMisc.dealFlow.openDeck")}
                    </a>
                  )}
                  {pipelineEntry ? (
                    <span className="stf-small">{t("dashboardV2.currentStage", {
                      stage: t(`status.${pipelineEntry.stage}`),
                    })}</span>
                  ) : (
                    <AppButton
                      size="sm"
                      variant="primary"
                      disabled={processingId !== null}
                      loading={processingId === venture.id}
                      onClick={() => onAddToPipeline(venture.id, "interested")}
                    >
                      {t("dashboardV2.iAmInterested")}
                    </AppButton>
                  )}
                  {introductions && venture.deal_flow_id && (
                    <button
                      type="button"
                      onClick={() => onRequestIntro(venture)}
                      disabled={processingId !== null}
                      className="relative z-10 flex min-h-11 items-center gap-1 text-xs font-bold text-[var(--brand-orange)] uppercase tracking-wide hover:underline disabled:opacity-40"
                    >
                      {t("requestIntroduction")} <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </AppCard>
          );
        })}
      </div>
    </>
  );
}
