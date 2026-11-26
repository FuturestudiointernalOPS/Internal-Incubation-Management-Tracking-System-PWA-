"use client";

import { ArrowRight, Building2, GitCompare, Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { useI18n } from "@/lib/i18n";
import VentureIdentity from "./VentureIdentity";

/**
 * The discovery results: the "N ventures found" line and the venture cards grid,
 * with the empty state.
 *
 * Every card keeps the same anatomy — identity, tags, description, footer — and
 * the same order of actions: open the detail, compare, watchlist, request an
 * introduction. The same shape is reused by the pipeline and the watchlist.
 */
export default function VentureGrid({
  items,
  venturesTotal,
  campaigns,
  watchlist,
  compareList,
  processingId,
  pipeline,
  onOpenDetail,
  onToggleCompare,
  onToggleWatchlist,
  onRequestIntro,
}) {
  const { t } = useI18n();

  if (items.length === 0) {
    return (
      <AppEmptyState
        icon={Building2}
        title={t("noVentures")}
        description={t("noVentureDesc")}
      />
    );
  }

  return (
    <>
      {venturesTotal > 0 && (
        <p className="stf-k">{t("member.investor.browser.grid.found", { count: venturesTotal })}</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((venture) => {
          const isWatching = watchlist.some((entry) => entry.venture_id === venture.id);
          const isCompared = compareList.some((item) => item.id === venture.id);
          const activeCampaign = campaigns.find((candidate) => candidate.venture_id === venture.id);
          const inPipeline = pipeline.some((item) => item.venture_id === venture.id);
          const matchScore = Number(venture.match_score) || 0;
          const readiness = Number(venture.completion_index) || 0;
          const meta = [venture.industry, venture.country].filter(Boolean).join(" · ");

          return (
            <AppCard key={venture.id} padding="md" hover className="h-full">
              <div className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <VentureIdentity
                    name={venture.name}
                    meta={meta || "—"}
                    onClick={() => onOpenDetail(venture)}
                  />
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onToggleCompare(venture)}
                      aria-pressed={isCompared}
                      aria-label={
                        isCompared
                          ? t("member.investor.browser.grid.removeCompare")
                          : t("member.investor.browser.grid.addCompare")
                      }
                      title={
                        isCompared
                          ? t("member.investor.browser.grid.removeCompare")
                          : t("member.investor.browser.grid.addCompare")
                      }
                      className={`rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-2)] ${
                        isCompared
                          ? "text-[var(--brand-orange)]"
                          : "text-[var(--text-tertiary)] hover:text-[var(--brand-orange)]"
                      }`}
                    >
                      <GitCompare className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleWatchlist(venture.id)}
                      disabled={processingId !== null}
                      aria-label={
                        isWatching
                          ? t("member.investor.browser.detail.removeWatchlist")
                          : t("member.investor.browser.detail.addWatchlist")
                      }
                      title={
                        isWatching
                          ? t("member.investor.browser.detail.removeWatchlist")
                          : t("member.investor.browser.detail.addWatchlist")
                      }
                      className={`rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-2)] disabled:cursor-wait disabled:opacity-40 ${
                        isWatching
                          ? "text-[var(--brand-orange)]"
                          : "text-[var(--text-tertiary)] hover:text-[var(--brand-orange)]"
                      }`}
                    >
                      {processingId === venture.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : isWatching ? (
                        <BookmarkCheck className="h-4 w-4 fill-current" aria-hidden="true" />
                      ) : (
                        <Bookmark className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {(venture.business_stage || activeCampaign || matchScore > 0) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {venture.business_stage && (
                      <span className="stf-tag">{venture.business_stage}</span>
                    )}
                    {activeCampaign && (
                      <span className="stf-tag o">
                        {t("member.investor.browser.grid.campaignActive")}
                      </span>
                    )}
                    {matchScore > 0 && (
                      <span className="stf-tag g">
                        {t("member.investor.browser.grid.match", { score: matchScore })}
                      </span>
                    )}
                  </div>
                )}

                {venture.description && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {venture.description}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border-primary)] pt-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                    {readiness > 0 ? `${Math.round(readiness)}%` : ""}
                  </span>
                  {!inPipeline && (
                    <button
                      type="button"
                      onClick={() => onRequestIntro(venture)}
                      disabled={processingId !== null}
                      className="stf-link-btn flex items-center gap-1 disabled:cursor-wait disabled:opacity-40 disabled:no-underline"
                    >
                      {t("member.investor.browser.grid.requestIntro")}
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
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
