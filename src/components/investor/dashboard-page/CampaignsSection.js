"use client";

import { Megaphone, Users, Calendar } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import { useI18n } from "@/lib/i18n";

/**
 * The active fundraising campaigns block on the Discover tab.
 * Extracted verbatim from InvestorDashboard.
 */
export default function CampaignsSection({ campaigns, onOpenVenture }) {
  const { t } = useI18n();
  if (campaigns.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-[var(--brand-orange)]" />
        <h3 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wider">{t("activeCampaigns")}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {campaigns.map(campaign => {
          const progressPercent = campaign.target_raise > 0 ? Math.min(100, Math.round((parseFloat(campaign.current_raised || 0) / parseFloat(campaign.target_raise)) * 100)) : 0;
          return (
            <AppCard key={campaign.id} padding="md" hover onClick={() => onOpenVenture({ id: campaign.venture_id, name: campaign.venture_name, industry: campaign.industry, country: campaign.country, business_stage: campaign.business_stage, funding_requirement: campaign.funding_requirement, completion_index: campaign.completion_index })}>
              <div className="space-y-2 cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-black text-[var(--text-primary)]">{campaign.venture_name || campaign.name}</h4>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)]">{campaign.name}{campaign.industry ? ` · ${campaign.industry}` : ""}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400">Active</span>
                </div>
                {campaign.target_raise > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="font-bold text-[var(--text-secondary)]">${Number(campaign.current_raised || 0).toLocaleString()}</span>
                      <span className="font-black text-[var(--text-primary)]">{progressPercent}% of ${Number(campaign.target_raise).toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
                  {campaign.investor_count > 0 && <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5"/>{campaign.investor_count} interested</span>}
                  {campaign.opening_date && <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5"/>{new Date(campaign.opening_date).toLocaleDateString()}</span>}
                </div>
              </div>
            </AppCard>
          );
        })}
      </div>
    </div>
  );
}
