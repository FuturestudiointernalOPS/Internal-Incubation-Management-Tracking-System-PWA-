"use client";

import Link from "next/link";
import { Calendar, ClipboardList } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import KpiCard from "@/components/ui/KpiCard";
import SectionHead from "@/components/ui/SectionHead";
import { formatLocaleDate } from "@/lib/constants";

/**
 * The FACILITATION section — shown only when the person actually animates a
 * program (an assignment, not a badge). The programs listed are the ones the
 * assignment resolves to.
 */
export default function FacilitatorSection({ block, t, lang }) {
  const { programs = [], upcoming = [] } = block;

  return (
    <section>
      <SectionHead
        letter="F"
        tone="o"
        title={t("member.dashboard.section.facilitator.title")}
        subtitle={t("member.dashboard.section.facilitator.subtitle")}
        action={
          <Link className="stf-link-btn" href="/member/facilitator/reviews">
            {t("member.dashboard.section.facilitator.reviews")}
          </Link>
        }
      />

      <div className="stf-grid c4">
        <KpiCard
          label={t("member.dashboard.kpi.programs")}
          value={programs.length}
          icon={ClipboardList}
        />
        <KpiCard
          label={t("member.dashboard.kpi.upcoming")}
          value={upcoming.length}
          icon={Calendar}
        />
      </div>

      <div className="stf-grid c2">
        <AppCard>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {t("member.dashboard.section.facilitator.programs")}
          </h3>
          <div className="mt-3 divide-y divide-[var(--border-primary)]">
            {programs.map((program) => (
              <Link
                key={program.id}
                href={`/member/facilitator/program/${program.id}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="min-w-0 truncate text-sm font-bold text-[var(--text-primary)]">
                  {program.name}
                </span>
                <AppStatusBadge status={program.status} />
              </Link>
            ))}
          </div>
        </AppCard>

        <AppCard>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {t("participant.template.nextSessions")}
          </h3>
          <div className="mt-3 divide-y divide-[var(--border-primary)]">
            {upcoming.length ? (
              upcoming.map((session) => (
                <Link
                  key={session.id}
                  href={`/member/facilitator/program/${session.programId}`}
                  className="block py-3"
                >
                  <p className="text-sm font-bold text-[var(--text-primary)]">{session.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {session.programName ? `${session.programName} · ` : ""}
                    {session.date
                      ? formatLocaleDate(session.date, { day: "numeric", month: "short" }, lang)
                      : ""}
                    {session.time ? ` · ${String(session.time).slice(0, 5)}` : ""}
                  </p>
                </Link>
              ))
            ) : (
              <p className="py-5 text-center text-xs text-[var(--text-secondary)]">
                {t("participant.template.noSessions")}
              </p>
            )}
          </div>
        </AppCard>
      </div>
    </section>
  );
}
