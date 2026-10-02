"use client";

import { Bookmark, Loader2, X, Eye, Send } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

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
}) {
  return (
    <div className="space-y-4">
      {watchlist.length === 0 ? (
        <div className="text-center py-16">
          <Bookmark className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
          <p className="text-sm font-bold text-[var(--text-secondary)]">No saved ventures</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">Bookmark ventures from the Discover tab to track their progress.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[10px] text-[var(--text-tertiary)]">{watchlist.length} venture{watchlist.length > 1 ? "s" : ""} tracked</p>
          {watchlist.map(item => {
            const campaignPct = item.target_raise > 0 ? Math.min(100, Math.round((parseFloat(item.current_raised || 0) / parseFloat(item.target_raise)) * 100)) : 0;
            const readinessPct = Math.round(parseFloat(item.completion_index || 0));
            return (
              <AppCard key={item.id} padding="md" hover>
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => onOpenDetail({ id: item.venture_id, name: item.venture_name, industry: item.industry, country: item.country, business_stage: item.business_stage, description: item.description, funding_requirement: item.funding_requirement, completion_index: item.completion_index, investor_interest_count: item.investor_count })}>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-[var(--text-primary)] hover:text-[var(--brand-orange)] transition-colors">{item.venture_name || item.venture_id}</h4>
                        {item.campaign_status === "active" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400">Active</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.industry && <span className="text-[10px] text-[var(--text-secondary)]">{item.industry}</span>}
                        {item.country && <span className="text-[10px] text-[var(--text-tertiary)]">{item.country}</span>}
                        {item.business_stage && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--surface-3)] text-[var(--text-secondary)]">{item.business_stage}</span>}
                      </div>
                    </div>
                    <button onClick={() => onToggleWatchlist(item.venture_id)} disabled={processingId !== null}
                      className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40 shrink-0"
                      title="Remove from watchlist">
                      {processingId === item.venture_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Readiness */}
                    <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Readiness</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${readinessPct >= 80 ? "bg-emerald-500" : readinessPct >= 50 ? "bg-amber-500" : "bg-slate-400"}`} style={{ width: `${readinessPct}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--text-primary)]">{readinessPct}%</span>
                      </div>
                    </div>
                    {/* Campaign funding */}
                    <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Funding</p>
                      {item.campaign_id ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="flex-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--brand-orange)] rounded-full transition-all" style={{ width: `${campaignPct}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-[var(--text-primary)]">{campaignPct}%</span>
                        </div>
                      ) : (
                        <p className="text-[10px] font-medium text-[var(--text-tertiary)] mt-0.5">—</p>
                      )}
                    </div>
                    {/* Investor interest */}
                    <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Interest</p>
                      <p className="text-xs font-bold text-[var(--text-primary)] mt-0.5">{item.investor_count || 0} investors</p>
                    </div>
                  </div>

                  {/* Campaign detail if active */}
                  {item.campaign_id && item.target_raise > 0 && (
                    <div className="flex items-center justify-between text-[10px] px-2 py-1.5 rounded-lg bg-[var(--surface-2)]">
                      <span className="text-[var(--text-secondary)]">{item.campaign_name}: <b className="text-[var(--text-primary)]">${Number(item.current_raised || 0).toLocaleString()}</b> / ${Number(item.target_raise).toLocaleString()}</span>
                      {item.closing_date && <span className="text-[var(--text-tertiary)]">Closes {new Date(item.closing_date).toLocaleDateString()}</span>}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-primary)]">
                    <button onClick={() => onOpenDetail({ id: item.venture_id, name: item.venture_name, industry: item.industry, country: item.country, business_stage: item.business_stage, description: item.description, funding_requirement: item.funding_requirement, completion_index: item.completion_index, investor_interest_count: item.investor_count })}
                      className="flex items-center gap-1 text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wide hover:underline">
                      <Eye className="w-3 h-3" /> View
                    </button>
                    <button onClick={() => onRequestIntro({ id: item.venture_id, name: item.venture_name })}
                      className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wide hover:text-[var(--brand-orange)] transition-colors">
                      <Send className="w-3 h-3" /> Request Intro
                    </button>
                    <AppButton variant="secondary" size="sm" disabled={processingId !== null}
                      onClick={() => onAddToPipeline(item.venture_id, "interested")}>
                      Add to Pipeline
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
