"use client";

import { Bookmark, Loader2, X, Eye, Send } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { useI18n } from "@/lib/i18n";
import VentureIdentity from "./VentureIdentity";

/**
 * The Watchlist tab: the saved ventures with their readiness/funding/interest
 * bars and their actions, plus the empty state.
 *
 * The card is the same one the discovery grid draws — identity row, tags, three
 * figures, then the actions in the shared order — so a venture looks the same
 * wherever it is met.
 */
export default function WatchlistTab({
  watchlist,
  processingId,
  onOpenDetail,
  onToggleWatchlist,
  onRequestIntro,
  onAddToPipeline,
}) {
  const { t } = useI18n();

  const openDetail = (item) =>
    onOpenDetail({
      id: item.venture_id,
      name: item.venture_name,
      industry: item.industry,
      country: item.country,
      business_stage: item.business_stage,
      description: item.description,
      funding_requirement: item.funding_requirement,
      completion_index: item.completion_index,
      investor_interest_count: item.investor_count,
    });

  return (
    <div className="space-y-4">
      {watchlist.length === 0 ? (
        <AppEmptyState
          icon={Bookmark}
          title={t("member.investor.browser.watchlist.emptyTitle")}
          description={t("member.investor.browser.watchlist.emptyBody")}
        />
      ) : (
        <div className="space-y-4">
          <p className="stf-k">{t("member.investor.browser.watchlist.tracked", { count: watchlist.length })}</p>
          {watchlist.map(item => {
            const campaignPct = item.target_raise > 0 ? Math.min(100, Math.round((parseFloat(item.current_raised || 0) / parseFloat(item.target_raise)) * 100)) : 0;
            const readinessPct = Math.round(parseFloat(item.completion_index || 0));
            const meta = [item.industry, item.country].filter(Boolean).join(" · ");
            return (
              <AppCard key={item.id} padding="md" hover>
                <div className="space-y-3">
                  {/* Identity + remove */}
                  <div className="flex items-start justify-between gap-2">
                    <VentureIdentity
                      name={item.venture_name || item.venture_id}
                      meta={meta || "—"}
                      onClick={() => openDetail(item)}
                    />
                    <div className="flex shrink-0 items-center gap-1">
                      {item.campaign_status === "active" && (
                        <span className="stf-tag w">{t("member.investor.browser.campaigns.active")}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleWatchlist(item.venture_id)}
                        disabled={processingId !== null}
                        aria-label={t("member.investor.browser.detail.removeWatchlist")}
                        title={t("member.investor.browser.detail.removeWatchlist")}
                        className="rounded-lg p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-2)] hover:text-rose-400 disabled:cursor-wait disabled:opacity-40"
                      >
                        {processingId === item.venture_id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                  </div>

                  {item.business_stage && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="stf-tag">{item.business_stage}</span>
                    </div>
                  )}

                  {/* Figures */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                      <p className="stf-k">{t("member.investor.browser.watchlist.readiness")}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all bg-[var(--progress-fill)]" style={{ width: `${readinessPct}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--text-primary)]">{readinessPct}%</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                      <p className="stf-k">{t("member.investor.browser.watchlist.funding")}</p>
                      {item.campaign_id ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="flex-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--progress-fill)] rounded-full transition-all" style={{ width: `${campaignPct}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-[var(--text-primary)]">{campaignPct}%</span>
                        </div>
                      ) : (
                        <p className="text-[10px] font-medium text-[var(--text-tertiary)] mt-1">—</p>
                      )}
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                      <p className="stf-k">{t("member.investor.browser.watchlist.interest")}</p>
                      <p className="text-xs font-bold text-[var(--text-primary)] mt-1">{t("member.investor.browser.compare.investors", { count: item.investor_count || 0 })}</p>
                    </div>
                  </div>

                  {/* Campaign detail if active */}
                  {item.campaign_id && item.target_raise > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] px-2 py-1.5 rounded-lg bg-[var(--surface-2)]">
                      <span className="text-[var(--text-secondary)]">{item.campaign_name}: <b className="text-[var(--text-primary)]">${Number(item.current_raised || 0).toLocaleString()}</b> / ${Number(item.target_raise).toLocaleString()}</span>
                      {item.closing_date && <span className="text-[var(--text-tertiary)]">{t("member.investor.browser.watchlist.closes", { date: new Date(item.closing_date).toLocaleDateString() })}</span>}
                    </div>
                  )}

                  {/* Actions, in the shared order */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--border-primary)]">
                    <button onClick={() => openDetail(item)} className="stf-link-btn flex items-center gap-1">
                      <Eye className="w-3 h-3" aria-hidden="true" /> {t("member.investor.browser.watchlist.view")}
                    </button>
                    <button onClick={() => onRequestIntro({ id: item.venture_id, name: item.venture_name })} className="stf-link-btn flex items-center gap-1">
                      <Send className="w-3 h-3" aria-hidden="true" /> {t("member.investor.browser.watchlist.requestIntro")}
                    </button>
                    <AppButton
                      variant="secondary"
                      size="sm"
                      className="ml-auto"
                      disabled={processingId !== null}
                      onClick={() => onAddToPipeline(item.venture_id, "interested")}
                    >
                      {t("member.investor.browser.watchlist.addToPipeline")}
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
