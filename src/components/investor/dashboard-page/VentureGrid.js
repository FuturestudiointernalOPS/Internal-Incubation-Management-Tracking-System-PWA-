"use client";

import { Building2, ArrowRight, Loader2, Bookmark, BookmarkCheck, GitCompare } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import { useI18n } from "@/lib/i18n";

/**
 * The discovery results: the "N ventures found" line and the venture cards grid,
 * with the empty state.
 * Extracted verbatim from InvestorDashboard.
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
  return items.length === 0 ? (
    <div className="text-center py-16">
      <Building2 className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
      <p className="text-sm font-bold text-[var(--text-secondary)]">{t("noVentures")}</p>
      <p className="text-xs text-[var(--text-tertiary)] mt-1">{t("noVentureDesc")}</p>
    </div>
  ) : (
    <>
      {venturesTotal > 0 && <p className="text-[10px] text-[var(--text-tertiary)]">{venturesTotal} ventures found</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(venture => {
          const isWatching = watchlist.some(entry => entry.venture_id === venture.id);
          const isCompared = compareList.some(item => item.id === venture.id);
          const activeCampaign = campaigns.find(candidate => candidate.venture_id === venture.id);
          return (
            <AppCard key={venture.id} padding="md" hover>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <button onClick={() => onOpenDetail(venture)} className="text-left flex-1">
                    <h4 className="text-sm font-black text-[var(--text-primary)] hover:text-[var(--brand-orange)] transition-colors">{venture.name}</h4>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{venture.industry || "—"}{venture.country ? ` · ${venture.country}` : ""}</p>
                    {activeCampaign && (
                      <span className="inline-block mt-1 mr-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400">
                        Campaign Active
                      </span>
                    )}
                    {venture.match_score > 0 && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400">
                        {venture.match_score}% match
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onToggleCompare(venture)}
                      className={`p-1 rounded transition-colors ${isCompared ? "text-[var(--brand-orange)]" : "text-[var(--text-tertiary)] hover:text-[var(--brand-orange)]"}`}
                      title={isCompared ? "Remove from compare" : "Add to compare"}>
                      <GitCompare className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onToggleWatchlist(venture.id)}
                      disabled={processingId !== null}
                      className={`p-1 rounded transition-colors ${isWatching ? "text-[var(--brand-orange)]" : "text-[var(--text-tertiary)] hover:text-[var(--brand-orange)]"} disabled:opacity-40 disabled:cursor-wait`}>
                      {processingId === venture.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isWatching ? <BookmarkCheck className="w-4 h-4 fill-current" /> : <Bookmark className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {venture.description && (
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{venture.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-tertiary)]">{venture.country || ""}{venture.completion_index ? ` · ${Number(venture.completion_index).toFixed(0)}%` : ""}</span>
                  {!pipeline.some(item => item.venture_id === venture.id) && (
                    <button
                      onClick={() => onRequestIntro(venture)}
                      disabled={processingId !== null}
                      className="flex items-center gap-1 text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider hover:underline disabled:opacity-40 disabled:cursor-wait disabled:no-underline"
                    >
                      Request Introduction <ArrowRight className="w-3 h-3" />
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
