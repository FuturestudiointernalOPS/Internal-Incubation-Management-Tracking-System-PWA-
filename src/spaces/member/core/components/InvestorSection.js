"use client";

import Link from "next/link";
import { Eye, Filter, TrendingUp } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import KpiCard from "@/components/ui/KpiCard";
import SectionHead from "@/components/ui/SectionHead";

/**
 * The INVESTOR section — shown only to a person holding an APPROVED investor
 * profile. The figures come from the investor pipeline; the browsing (deal
 * flow, portfolio, diligence) stays on the investor workspace's own screens.
 */
export default function InvestorSection({ block, t }) {
  const { stats = {}, recommendations = [] } = block;

  return (
    <section>
      <SectionHead
        letter="I"
        tone="o"
        title={t("member.dashboard.section.investor.title")}
        subtitle={t("member.dashboard.section.investor.subtitle")}
        action={
          <Link className="stf-link-btn" href="/member/investor/deal-flow">
            {t("member.dashboard.section.investor.dealFlow")}
          </Link>
        }
      />

      <div className="stf-grid c4">
        <KpiCard
          label={t("member.dashboard.kpi.pipeline")}
          value={Number(stats.total_pipeline || 0)}
          icon={Filter}
        />
        <KpiCard
          label={t("member.dashboard.kpi.watchlist")}
          value={Number(stats.watchlist_count || 0)}
          icon={Eye}
        />
        <KpiCard
          label={t("member.dashboard.kpi.invested")}
          value={Number(stats.invested_count || 0)}
          icon={TrendingUp}
        />
      </div>

      {recommendations.length > 0 && (
        <>
          <div className="mt-6 mb-3">
            <h3 className="text-sm font-black uppercase tracking-wide text-[var(--text-primary)]">
              {t("member.dashboard.section.investor.suggestions")}
            </h3>
          </div>
          <div className="stf-grid c2">
            {recommendations.map((venture) => (
              <AppCard key={venture.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-[var(--text-primary)]">
                      {venture.name}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {[venture.industry, venture.country].filter(Boolean).join(" · ") ||
                        t("member.dashboard.section.investor.noDetail")}
                    </p>
                  </div>
                </div>
                {venture.description && (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {venture.description}
                  </p>
                )}
                <Link className="stf-link-btn mt-3 inline-block" href="/member/investor/deal-flow">
                  {t("member.dashboard.open")}
                </Link>
              </AppCard>
            ))}
          </div>
        </>
      )}

      <AppCard>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-[var(--brand-orange)]">
          <Link href="/member/investor/portfolio">{t("member.dashboard.section.investor.portfolio")}</Link>
          <Link href="/member/investor/diligence">{t("member.dashboard.section.investor.diligence")}</Link>
          <Link href="/member/investor/profile">{t("member.dashboard.section.investor.profile")}</Link>
        </div>
      </AppCard>
    </section>
  );
}
