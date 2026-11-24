"use client";

import Link from "next/link";
import ProgramListing from "@/spaces/member/participant/components/ProgramListing";
import { useI18n } from "@/lib/i18n";

export default function ParticipantProgramsPage() {
  const { t } = useI18n();
  return <div className="p-6 space-y-6">
    <ProgramListing />
    <Link href="/member/participant/progress" className="inline-block text-sm font-bold text-[var(--brand-orange)]">{t("participant.template.viewProgress")}</Link>
  </div>;
}
