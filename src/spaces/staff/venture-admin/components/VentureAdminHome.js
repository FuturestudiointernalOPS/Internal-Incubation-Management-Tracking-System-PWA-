"use client";

import { BarChart3, FileText, Rocket } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import KpiCard from "@/components/ui/KpiCard";
import LinkCard from "@/components/ui/LinkCard";
import PageHero from "@/components/ui/PageHero";
import SectionHead from "@/components/ui/SectionHead";

/**
 * Staff → Venture administration — the landed page of the dedicated area.
 *
 * The area is opened ONLY while the caller holds the portfolio rights; its
 * layout already refused everyone else on the server, so this screen is about
 * orientation, not about deciding access. The figures come from the same
 * directory read the server scopes by `ventures.view_all`, so a holder of the
 * profile sees every Venture, and nobody else ever reaches this page.
 */

const pickVentures = (payload) => (payload?.success ? payload.ventures || [] : []);

export default function VentureAdminHome() {
  const { t } = useI18n();
  const { data: ventures, loading } = useApi("/api/ventures", {
    defaultValue: [],
    transform: pickVentures,
  });

  const active = ventures.filter((venture) => venture.status === "active").length;
  const prospects = ventures.filter((venture) => venture.status === "prospect").length;

  return (
    <div className="stf" style={{ paddingBottom: 60 }}>
      <PageHero
        kicker={t("vadmin.adminHome.kicker")}
        title={t("vadmin.adminHome.title")}
        subtitle={t("vadmin.adminHome.subtitle")}
      />

      <SectionHead
        letter="A"
        tone="o"
        icon={BarChart3}
        title={t("vadmin.adminHome.sectionPortfolio")}
        subtitle={t("vadmin.adminHome.sectionPortfolioHint")}
      />
      <div className="stf-grid c3">
        <KpiCard
          label={t("vadmin.adminHome.kpiTotal")}
          value={ventures.length}
          icon={Rocket}
          loading={loading}
        />
        <KpiCard
          label={t("vadmin.adminHome.kpiActive")}
          value={active}
          icon={Rocket}
          loading={loading}
        />
        <KpiCard
          label={t("vadmin.adminHome.kpiProspects")}
          value={prospects}
          icon={Rocket}
          loading={loading}
        />
      </div>

      <SectionHead
        letter="B"
        tone="b"
        icon={Rocket}
        title={t("vadmin.adminHome.tools")}
        subtitle={t("vadmin.adminHome.toolsHint")}
      />
      <div className="stf-grid c3">
        <LinkCard
          icon={Rocket}
          title={t("vadmin.adminHome.allVenturesTitle")}
          text={t("vadmin.adminHome.allVenturesText")}
          href="/staff/venture-admin/ventures"
        />
        <LinkCard
          icon={BarChart3}
          title={t("vadmin.adminHome.portfolioTitle")}
          text={t("vadmin.adminHome.portfolioText")}
          href="/staff/venture-admin/portfolio"
        />
        <LinkCard
          icon={FileText}
          title={t("vadmin.adminHome.reportingTitle")}
          text={t("vadmin.adminHome.reportingText")}
          href="/staff/venture-admin/reporting-settings"
        />
      </div>
    </div>
  );
}
