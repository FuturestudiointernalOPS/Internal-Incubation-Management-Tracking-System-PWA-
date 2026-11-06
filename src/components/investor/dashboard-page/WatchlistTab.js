"use client";

import { Bookmark, Loader2, X, Send, FileText } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";

/**
 * The Watchlist tab: the saved ventures with their readiness/funding/interest
 * bars and their actions, plus the empty state.
 * Extracted verbatim from InvestorDashboard.
 */
export default function WatchlistTab({
  watchlist,
  processingId,
  onOpenDetail,
  onToggleWatchlist,
  onRequestIntro,
  onAddToPipeline,
  introductions = false,
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      {watchlist.length === 0 ? (
        <div className="text-center py-16">
          <Bookmark className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
          <p className="text-sm font-bold text-[var(--text-secondary)]">{t("dashboardV2.noSavedVentures")}</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">{t("dashboardV2.noSavedVenturesHint")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[10px] text-[var(--text-tertiary)]">{t("dashboardV2.watchlistCount", { count: watchlist.length })}</p>
          {watchlist.map(item => {
            return (
              <AppCard key={item.id} padding="md" hover>
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <button type="button" onClick={() => onOpenDetail({ id: item.venture_id, name: item.venture_name, industry: item.industry, country: item.country, description: item.description, founders: item.founders, founders_countries: item.founders_countries, deal_flow_id: item.deal_flow_id, deck: item.deck })} className="text-left">
                        <h4 className="text-sm font-black text-[var(--text-primary)] hover:text-[var(--brand-orange)] transition-colors">{item.venture_name || item.venture_id}</h4>
                      </button>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.industry && <span className="text-[10px] text-[var(--text-secondary)]">{item.industry}</span>}
                        {item.country && <span className="text-[10px] text-[var(--text-tertiary)]">{item.country}</span>}
                      </div>
                    </div>
                    <button type="button" onClick={() => onToggleWatchlist(item.venture_id)} disabled={processingId !== null}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40 shrink-0"
                      aria-label={t("removeFromWatchlist")}>
                      {processingId === item.venture_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {item.personal_notes && <p className="stf-small">{item.personal_notes}</p>}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-primary)]">
                    {item.deck?.id && (
                      <a className="stf-btn" href={`/investor/deck/${item.deck.id}`}>
                        <FileText size={14} /> {t("investorMisc.dealFlow.openDeck")}
                      </a>
                    )}
                    {introductions && item.deal_flow_id && <button type="button" onClick={() => onRequestIntro({ id: item.venture_id, name: item.venture_name, deal_flow_id: item.deal_flow_id })}
                      className="flex min-h-11 items-center gap-1 text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wide hover:text-[var(--brand-orange)] transition-colors">
                      <Send className="w-3 h-3" /> {t("requestIntroduction")}
                    </button>}
                    <AppButton variant="secondary" size="sm" disabled={processingId !== null}
                      onClick={() => onAddToPipeline(item.venture_id, "interested")}>
                      {t("dashboardV2.iAmInterested")}
                    </AppButton>
                  </div>
                </div>
              </AppCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
