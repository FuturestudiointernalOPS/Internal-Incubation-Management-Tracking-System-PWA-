"use client";

import Link from "next/link";
import { Rocket } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import KpiCard from "@/components/ui/KpiCard";
import SectionHead from "@/components/ui/SectionHead";

/**
 * The VENTURE section — shown to anyone holding a venture membership. A
 * FOUNDER additionally gets the founder's door (their meetings); the rest of
 * the pilotage lives in the venture workspace itself.
 */
export default function VenturesSection({ block, t }) {
  const { items = [], isFounder } = block;

  return (
    <section>
      <SectionHead
        letter="V"
        tone="o"
        title={t("member.dashboard.section.ventures.title")}
        subtitle={
          isFounder
            ? t("member.dashboard.section.ventures.founderSubtitle")
            : t("member.dashboard.section.ventures.subtitle")
        }
        action={
          <Link className="stf-link-btn" href="/member/participant/ventures">
            {t("member.dashboard.seeAll")}
          </Link>
        }
      />

      <div className="stf-grid c4">
        <KpiCard
          label={t("member.dashboard.kpi.ventures")}
          value={items.length}
          icon={Rocket}
        />
      </div>

      <AppCard padding="none">
        <div className="stf-tw">
          <table>
            <thead>
              <tr>
                <th>{t("member.dashboard.section.ventures.name")}</th>
                <th>{t("member.dashboard.section.ventures.role")}</th>
                <th>{t("member.dashboard.section.ventures.status")}</th>
                <th className="c">{t("member.dashboard.open")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((venture) => (
                <tr key={venture.id}>
                  <td>
                    <span className="font-bold text-[var(--text-primary)]">{venture.name}</span>
                  </td>
                  <td>
                    {venture.isOwner ? (
                      <span className="stf-tag g">
                        {t("member.dashboard.section.ventures.founderBadge")}
                      </span>
                    ) : (
                      <span className="stf-tag">{t("member.dashboard.section.ventures.memberBadge")}</span>
                    )}
                  </td>
                  <td>
                    <AppStatusBadge status={venture.status} />
                  </td>
                  <td className="c">
                    <Link
                      href={`/member/participant/ventures/${venture.id}`}
                      className="text-[var(--brand-orange)]"
                    >
                      {t("member.dashboard.open")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCard>

      {isFounder && (
        <AppCard>
          <Link
            href="/member/founder/meetings"
            className="flex items-center justify-between gap-3 text-sm font-bold text-[var(--brand-orange)]"
          >
            <span>{t("member.dashboard.section.ventures.meetingsLink")}</span>
            <span>{t("member.dashboard.open")}</span>
          </Link>
        </AppCard>
      )}
    </section>
  );
}
