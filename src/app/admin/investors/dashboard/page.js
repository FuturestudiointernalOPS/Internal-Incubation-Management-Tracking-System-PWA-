"use client";

import { useState, useEffect } from "react";
import { TrendingUp, DollarSign, Users, Building2, Target, BarChart3, Megaphone, Activity, Briefcase, Loader2 } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import { useI18n } from "@/lib/i18n";

const STAGE_COLORS = { interested: "bg-slate-500/10 text-slate-400", watching: "bg-blue-500/10 text-blue-400", meeting_requested: "bg-amber-500/10 text-amber-400", due_diligence: "bg-purple-500/10 text-purple-400", negotiation: "bg-orange-500/10 text-orange-400", invested: "bg-emerald-500/10 text-emerald-400", declined: "bg-rose-500/10 text-rose-400" };

export default function ExecutiveDashboardPage() {
  const { t } = useI18n();
  const STAGE_LABELS = { interested: t("investorAdmin.dashboard.stageInterested"), watching: t("investorAdmin.dashboard.stageWatching"), meeting_requested: t("investorAdmin.dashboard.stageIntroRequested"), due_diligence: t("investorAdmin.dashboard.stageDueDiligence"), negotiation: t("investorAdmin.dashboard.stageNegotiation"), invested: t("investorAdmin.dashboard.invested"), declined: t("investorAdmin.dashboard.stageDeclined") };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch("/api/investor/executive-dashboard").then(r => r.json()).then(d => { if (d.success) setData(d); setLoading(false); }); }, []);

  if (loading) return <><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></>;

  const d = data || {};
  const inv = d.investors || {};
  const ven = d.ventures || {};
  const fund = d.fundraising || {};
  const rel = d.relationships || {};

  return (
    <>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">{t("investorAdmin.dashboard.title")}</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">{t("investorAdmin.dashboard.subtitle")}</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t("investorAdmin.dashboard.verifiedInvestors"), value: inv.total_verified || 0, icon: Users, color: "text-blue-400" },
            { label: t("investorAdmin.dashboard.activeCampaigns"), value: ven.active_campaigns || 0, icon: Megaphone, color: "text-amber-400" },
            { label: t("investorAdmin.dashboard.totalCommitted"), value: `$${((fund.total_committed || 0) / 1000).toFixed(0)}K`, icon: DollarSign, color: "text-emerald-400" },
            { label: t("investorAdmin.dashboard.investedDeals"), value: rel.total_invested || 0, icon: Target, color: "text-[var(--brand-orange)]" },
          ].map((k, i) => (
            <AppCard key={i} padding="md">
              <div className="flex items-center gap-3">
                <k.icon className={`w-5 h-5 ${k.color}`} />
                <div>
                  <p className="text-2xl font-black text-[var(--text-primary)]">{k.value}</p>
                  <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{k.label}</p>
                </div>
              </div>
            </AppCard>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fundraising KPIs */}
          <AppCard padding="lg">
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" /> {t("investorAdmin.dashboard.fundraising")}</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                [t("investorAdmin.dashboard.capitalSought"), `$${((fund.total_sought || 0) / 1000).toFixed(0)}K`],
                [t("investorAdmin.dashboard.capitalRaised"), `$${((fund.total_raised || 0) / 1000).toFixed(0)}K`],
                [t("investorAdmin.dashboard.capitalCommitted"), `$${((fund.total_committed || 0) / 1000).toFixed(0)}K`],
                [t("investorAdmin.dashboard.conversionRate"), fund.total_sought > 0 ? `${Math.round((fund.total_committed / fund.total_sought) * 100)}%` : "—"],
              ].map(([l, v], i) => (
                <div key={i} className="p-3 rounded-xl bg-[var(--surface-2)]">
                  <p className="text-[7px] font-black text-[var(--text-tertiary)] uppercase tracking-widest">{l}</p>
                  <p className="text-sm font-black text-[var(--text-primary)] mt-1">{v}</p>
                </div>
              ))}
            </div>
          </AppCard>

          {/* Relationships */}
          <AppCard padding="lg">
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase mb-4 flex items-center gap-2"><Briefcase className="w-4 h-4 text-purple-400" /> {t("investorAdmin.dashboard.relationships")}</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                [t("investorAdmin.dashboard.active"), rel.active_relationships || 0],
                [t("investorAdmin.dashboard.meetingsDone"), rel.meetings_completed || 0],
                [t("investorAdmin.dashboard.invested"), rel.total_invested || 0],
                [t("investorAdmin.dashboard.pipelineTotal"), (d.pipeline || []).reduce((s, p) => s + p.count, 0)],
              ].map(([l, v], i) => (
                <div key={i} className="p-3 rounded-xl bg-[var(--surface-2)]">
                  <p className="text-[7px] font-black text-[var(--text-tertiary)] uppercase tracking-widest">{l}</p>
                  <p className="text-sm font-black text-[var(--text-primary)] mt-1">{v}</p>
                </div>
              ))}
            </div>
          </AppCard>
        </div>

        {/* Pipeline Funnel */}
        <AppCard padding="lg">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[var(--brand-orange)]" /> {t("investorAdmin.dashboard.investmentPipeline")}</h3>
          <div className="flex flex-wrap gap-2">
            {(d.pipeline || []).map(p => (
              <div key={p.stage} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--surface-2)]">
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${STAGE_COLORS[p.stage] || "bg-slate-500/10 text-slate-400"}`}>{STAGE_LABELS[p.stage] || p.stage}</span>
                <span className="text-sm font-black text-[var(--text-primary)]">{p.count}</span>
              </div>
            ))}
            {(d.pipeline || []).length === 0 && <p className="text-xs text-[var(--text-tertiary)]">{t("investorAdmin.dashboard.noPipelineActivity")}</p>}
          </div>
        </AppCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Campaign Performance */}
          <AppCard padding="lg">
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" /> {t("investorAdmin.dashboard.campaignPerformance")}</h3>
            {(d.campaignPerformance || []).length === 0 ? (
              <p className="text-xs text-[var(--text-tertiary)]">{t("investorAdmin.dashboard.noActiveCampaigns")}</p>
            ) : (
              <div className="space-y-2">
                {(d.campaignPerformance || []).map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-2)]">
                    <div className="flex-1 mr-3">
                      <p className="text-[10px] font-bold text-[var(--text-primary)]">{c.venture_name}</p>
                      <p className="text-[8px] text-[var(--text-tertiary)]">{c.industry || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, c.pct || 0)}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-[var(--text-primary)] w-8 text-right">{c.pct || 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AppCard>

          {/* Sector Demand */}
          <AppCard padding="lg">
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-400" /> {t("investorAdmin.dashboard.sectorDemand")}</h3>
            {(d.sectorDemand || []).length === 0 ? (
              <p className="text-xs text-[var(--text-tertiary)]">{t("investorAdmin.dashboard.noData")}</p>
            ) : (
              <div className="space-y-2">
                {(d.sectorDemand || []).map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-2)]">
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">{s.industry || t("investorAdmin.dashboard.unknown")}</span>
                    <span className="text-[10px] font-black text-[var(--brand-orange)]">{t("investorAdmin.dashboard.interestCount", { count: s.interest_count })}</span>
                  </div>
                ))}
              </div>
            )}
          </AppCard>
        </div>

        {/* Top Investors */}
        <AppCard padding="lg">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-amber-400" /> {t("investorAdmin.dashboard.topInvestors")}</h3>
          {(d.topInvestors || []).length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)]">{t("investorAdmin.dashboard.noInvestorActivity")}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(d.topInvestors || []).map((inv, i) => (
                <AppCard key={i} padding="md">
                  <p className="text-sm font-bold text-[var(--text-primary)]">{inv.organization_name || inv.name}</p>
                  <div className="flex gap-3 mt-2 text-[10px]">
                    <span className="text-[var(--text-secondary)]">{t("investorAdmin.dashboard.pipelineLabel")}: <b className="text-[var(--text-primary)]">{inv.pipeline_count}</b></span>
                    <span className="text-[var(--text-secondary)]">{t("investorAdmin.dashboard.invested")}: <b className="text-emerald-400">{inv.invested_count}</b></span>
                  </div>
                </AppCard>
              ))}
            </div>
          )}
        </AppCard>
      </div>
    </>
  );
}
