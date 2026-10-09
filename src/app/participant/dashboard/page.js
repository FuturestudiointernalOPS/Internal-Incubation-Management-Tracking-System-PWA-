"use client";

import Link from "next/link";
import ProgramListing from "@/components/dashboard/ProgramListing";
import AppCard from "@/components/ui/AppCard";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
const EMPTY = { primaryProgram: null };

export default function ParticipantProgramsPage() {
  const { t } = useI18n();
  const { data } = useApi("/api/participant/home", { defaultValue: EMPTY });
  const program = data.primaryProgram;
  return <div className="p-6 space-y-6">
    <header><h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("navigation.programs")}</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">{t("participant.template.programsHint")}</p></header>
    {program && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[
      [t("participant.template.program"), program.name],
      [t("participant.week"), `${program.currentWeek} / ${program.durationWeeks || "?"}`],
      [t("participant.template.facilitator"), <Link key="facilitator" href={`/participant/${program.id}#facilitators`} className="text-sm text-[var(--brand-orange)]">{t("participant.details")}</Link>],
      [t("participant.programCompletion"), `${program.metrics?.programCompletion || 0}%`],
    ].map(([label, value]) => <AppCard key={label} padding="sm"><p className="text-xs text-[var(--text-secondary)]">{label}</p><div className="mt-3 text-xl font-bold text-[var(--text-primary)]">{value}</div></AppCard>)}</div>}
    <ProgramListing />
    <Link href="/participant/progress" className="inline-block text-sm font-bold text-[var(--brand-orange)]">{t("participant.template.viewProgress")}</Link>
  </div>;
}
