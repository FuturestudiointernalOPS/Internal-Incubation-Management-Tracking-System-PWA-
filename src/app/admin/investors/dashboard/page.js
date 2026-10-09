"use client";

import { useRouter } from "next/navigation";
import { Activity, BarChart3, Briefcase, DollarSign, Loader2, Megaphone, Shield, TrendingUp, UserCheck, Users } from "lucide-react";
import AppLinkCard from "@/components/ui/AppLinkCard";
import KpiCard from "@/components/ui/KpiCard";
import SectionHead from "@/components/ui/SectionHead";
import InvestorActivity from "@/components/admin/investors/InvestorActivity";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

const STAGE_TONE = { interested: "", watching: "b", meeting_requested: "w", due_diligence: "b", negotiation: "o", invested: "g", declined: "r" };

// Module scope on purpose: the hook keys its internal callback on these
// functions and values, so inline ones would get a new identity on every render
// and refetch in a loop.
const pickExecutiveDashboard = (payload) => (payload?.success ? payload : null);
const EMPTY_ACTIVITY = { workspaces: [], pipelines: [], stats: {}, requests: [] };
const pickActivity = (payload) =>
  payload?.success
    ? { workspaces: payload.workspaces || [], pipelines: payload.pipelines || [], stats: payload.stats || {}, requests: payload.requests || [] }
    : EMPTY_ACTIVITY;

// Where each card of this dashboard leads. A card navigates only when
// `isDeveloped` is true; otherwise it nudges on click and stays put. Flip the
// flag (and set `redirectTo`) the day the target page ships.
const CARD_LINKS = {
  verifiedInvestors: { isDeveloped: true, redirectTo: "/admin/investors?status=approved" },
  pendingInvestors: { isDeveloped: true, redirectTo: "/admin/investors?status=pending" },
  activeCampaigns: { isDeveloped: true, redirectTo: "/admin/investors/campaigns?status=active" },
  fundraising: { isDeveloped: true, redirectTo: "/admin/investors/campaigns" },
  relationships: { isDeveloped: true, redirectTo: "/admin/investors/relationships" },
  pipeline: { isDeveloped: true, redirectTo: "/admin/investors/relationships" },
  campaignPerformance: { isDeveloped: true, redirectTo: "/admin/investors/campaigns" },
  sectorDemand: { isDeveloped: false, redirectTo: null }, // no sector analytics page yet
  topInvestors: { isDeveloped: true, redirectTo: "/admin/investors" },
};

const thousands = (value) => `$${((value || 0) / 1000).toFixed(0)}K`;

/**
 * INVESTORS — the one dashboard: what investors are doing now (due diligence,
 * introduction requests, live pipelines, information requests — the former
 * Overview) above the executive picture (investors, fundraising, relationships,
 * pipeline funnel, campaigns, sectors — the former Dashboard).
 *
 * Reads:   GET /api/investor/executive-dashboard
 *          GET /api/investor/admin-overview
 * Read-only.
 */
export default function InvestorsDashboardPage() {
  const { t } = useI18n();
  const router = useRouter();
  const stageLabels = {
    interested: t("investorAdmin.dashboard.stageInterested"),
    watching: t("investorAdmin.dashboard.stageWatching"),
    meeting_requested: t("investorAdmin.dashboard.stageIntroRequested"),
    due_diligence: t("investorAdmin.dashboard.stageDueDiligence"),
    negotiation: t("investorAdmin.dashboard.stageNegotiation"),
    invested: t("investorAdmin.dashboard.invested"),
    declined: t("investorAdmin.dashboard.stageDeclined"),
  };

  const executive = useApi("/api/investor/executive-dashboard", { transform: pickExecutiveDashboard });
  const activity = useApi("/api/investor/admin-overview", { defaultValue: EMPTY_ACTIVITY, transform: pickActivity });

  if (executive.loading && activity.loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  const dashboard = executive.data || {};
  const investorStats = dashboard.investors || {};
  const ventureStats = dashboard.ventures || {};
  const fundraisingStats = dashboard.fundraising || {};
  const relationshipStats = dashboard.relationships || {};
  const pipeline = dashboard.pipeline || [];
  const pipelineMax = Math.max(1, ...pipeline.map((stage) => stage.count));
  const pipelineTotal = pipeline.reduce((sum, stage) => sum + stage.count, 0);
  const stats = activity.data.stats;
  const go = (key) => (CARD_LINKS[key].isDeveloped ? () => router.push(CARD_LINKS[key].redirectTo) : undefined);

  const stat = (label, value) => (
    <div className="stf-card" style={{ padding: 12, background: "var(--surface-2)" }}>
      <div className="stf-k">{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );

  return (
    <div className="stf" style={{ paddingBottom: 60 }}>
      <div className="stf-head">
        <div>
          <h1 className="stf-title">{t("investorAdmin.dashboard.title")}</h1>
          <p className="stf-sub">{t("investorAdmin.dashboard.subtitle")}</p>
        </div>
      </div>

      {/* Figures */}
      <div className="stf-grid">
        <KpiCard label={t("investorAdmin.dashboard.verifiedInvestors")} value={investorStats.total_verified || 0} icon={Users} onClick={go("verifiedInvestors")} />
        <KpiCard label={t("investorAdmin.overview.pending")} value={stats.pending_investors || 0} icon={UserCheck} onClick={go("pendingInvestors")} />
        <KpiCard label={t("investorAdmin.overview.activeDd")} value={stats.active_dd || 0} icon={Shield} />
        <KpiCard label={t("investorAdmin.dashboard.activeCampaigns")} value={ventureStats.active_campaigns || 0} icon={Megaphone} onClick={go("activeCampaigns")} />
        <KpiCard label={t("investorAdmin.dashboard.totalCommitted")} value={thousands(fundraisingStats.total_committed)} icon={DollarSign} />
      </div>

      {/* A — what investors are doing now */}
      <section className="stf-sec">
        <SectionHead letter="A" tone="o" icon={Activity} title={t("investorAdmin.overview.investorActivity")} />
        <InvestorActivity workspaces={activity.data.workspaces} pipelines={activity.data.pipelines} requests={activity.data.requests} />
      </section>

      {/* B — the executive picture */}
      <section className="stf-sec">
        <SectionHead letter="B" tone="b" icon={BarChart3} title={t("investorAdmin.dashboard.executiveSection")} subtitle={t("investorAdmin.dashboard.subtitle")} />

        <div className="stf-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <AppLinkCard padding="md" {...CARD_LINKS.fundraising}>
            <h3 className="stf-card-title"><DollarSign size={15} /> {t("investorAdmin.dashboard.fundraising")}</h3>
            <div className="stf-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 0 }}>
              {stat(t("investorAdmin.dashboard.capitalSought"), thousands(fundraisingStats.total_sought))}
              {stat(t("investorAdmin.dashboard.capitalRaised"), thousands(fundraisingStats.total_raised))}
              {stat(t("investorAdmin.dashboard.capitalCommitted"), thousands(fundraisingStats.total_committed))}
              {stat(t("investorAdmin.dashboard.conversionRate"), fundraisingStats.total_sought > 0 ? `${Math.round((fundraisingStats.total_committed / fundraisingStats.total_sought) * 100)}%` : "—")}
            </div>
          </AppLinkCard>

          <AppLinkCard padding="md" {...CARD_LINKS.relationships}>
            <h3 className="stf-card-title"><Briefcase size={15} /> {t("investorAdmin.dashboard.relationships")}</h3>
            <div className="stf-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 0 }}>
              {stat(t("investorAdmin.dashboard.active"), relationshipStats.active_relationships || 0)}
              {stat(t("investorAdmin.dashboard.meetingsDone"), relationshipStats.meetings_completed || 0)}
              {stat(t("investorAdmin.dashboard.invested"), relationshipStats.total_invested || 0)}
              {stat(t("investorAdmin.dashboard.pipelineTotal"), pipelineTotal)}
            </div>
          </AppLinkCard>
        </div>

        <AppLinkCard padding="md" {...CARD_LINKS.pipeline}>
          <h3 className="stf-card-title"><BarChart3 size={15} /> {t("investorAdmin.dashboard.investmentPipeline")}</h3>
          {pipeline.length === 0 ? (
            <p className="stf-small">{t("investorAdmin.dashboard.noPipelineActivity")}</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {pipeline.map((stage) => (
                <div key={stage.stage} style={{ display: "grid", gridTemplateColumns: "150px 1fr 36px", alignItems: "center", gap: 12 }}>
                  <span className={`stf-tag ${STAGE_TONE[stage.stage] || ""}`} style={{ justifySelf: "start" }}>{stageLabels[stage.stage] || stage.stage}</span>
                  <div className="stf-bar-prog" style={{ margin: 0 }}><i style={{ width: `${(stage.count / pipelineMax) * 100}%` }} /></div>
                  <b style={{ textAlign: "right", fontSize: 13 }}>{stage.count}</b>
                </div>
              ))}
            </div>
          )}
        </AppLinkCard>

        <div className="stf-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", marginTop: 16 }}>
          <AppLinkCard padding="md" {...CARD_LINKS.campaignPerformance}>
            <h3 className="stf-card-title"><TrendingUp size={15} /> {t("investorAdmin.dashboard.campaignPerformance")}</h3>
            {(dashboard.campaignPerformance || []).length === 0 ? (
              <p className="stf-small">{t("investorAdmin.dashboard.noActiveCampaigns")}</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {dashboard.campaignPerformance.map((campaign, index) => (
                  <div key={index}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <b>{campaign.venture_name}</b>
                      <b>{campaign.pct || 0}%</b>
                    </div>
                    <div className="stf-small" style={{ marginTop: 0 }}>{campaign.industry || "—"}</div>
                    <div className="stf-bar-prog"><i style={{ width: `${Math.min(100, campaign.pct || 0)}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </AppLinkCard>

          <AppLinkCard padding="md" {...CARD_LINKS.sectorDemand}>
            <h3 className="stf-card-title"><Activity size={15} /> {t("investorAdmin.dashboard.sectorDemand")}</h3>
            {(dashboard.sectorDemand || []).length === 0 ? (
              <p className="stf-small">{t("investorAdmin.dashboard.noData")}</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {dashboard.sectorDemand.map((sector, index) => (
                  <div key={index} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <b>{sector.industry || t("investorAdmin.dashboard.unknown")}</b>
                    <span className="stf-tag o">{t("investorAdmin.dashboard.interestCount", { count: sector.interest_count })}</span>
                  </div>
                ))}
              </div>
            )}
          </AppLinkCard>
        </div>

        <AppLinkCard padding="md" {...CARD_LINKS.topInvestors} className="mt-4">
          <h3 className="stf-card-title"><Users size={15} /> {t("investorAdmin.dashboard.topInvestors")}</h3>
          {(dashboard.topInvestors || []).length === 0 ? (
            <p className="stf-small">{t("investorAdmin.dashboard.noInvestorActivity")}</p>
          ) : (
            <div className="stf-grid" style={{ marginBottom: 0 }}>
              {dashboard.topInvestors.map((investor, index) => (
                <div key={index} className="stf-card" style={{ padding: 12, background: "var(--surface-2)" }}>
                  <b style={{ fontSize: 13 }}>{investor.organization_name || investor.name}</b>
                  <div className="stf-small">
                    {t("investorAdmin.dashboard.pipelineLabel")}: <b>{investor.pipeline_count}</b> · {t("investorAdmin.dashboard.invested")}: <b style={{ color: "var(--stf-done)" }}>{investor.invested_count}</b>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AppLinkCard>
      </section>
    </div>
  );
}
