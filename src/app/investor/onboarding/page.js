"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Handshake, PiggyBank } from "lucide-react";
import PageHero from "@/components/ui/PageHero";
import AppButton from "@/components/ui/AppButton";
import LinkCard from "@/components/ui/LinkCard";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * Phase 6 — dismissible 3-step first-run checklist (Guide §13).
 */
export default function InvestorOnboardingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const complete = async () => {
    setBusy(true);
    try {
      await fetch("/api/investor/onboarding", { method: "POST" });
    } catch (_) {}
    router.push("/investor/dashboard");
    setBusy(false);
  };

  const steps = [
    {
      key: "discover",
      icon: Compass,
      title: t("dashboardV2.onboarding.stepDiscover"),
      text: t("dashboardV2.onboarding.stepDiscoverHint"),
      href: "/investor/dashboard",
    },
    {
      key: "intro",
      icon: Handshake,
      title: t("dashboardV2.onboarding.stepIntro"),
      text: t("dashboardV2.onboarding.stepIntroHint"),
      href: "/investor/dashboard",
    },
    {
      key: "invest",
      icon: PiggyBank,
      title: t("dashboardV2.onboarding.stepInvest"),
      text: t("dashboardV2.onboarding.stepInvestHint"),
      href: "/investor/dashboard",
    },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <PageHero
        kicker={t("dashboardV2.kicker")}
        title={t("dashboardV2.onboarding.title")}
        subtitle={t("dashboardV2.onboarding.subtitle")}
      />
      <div className="stf-grid c1" style={{ gap: 12 }}>
        {steps.map((step) => (
          <LinkCard
            key={step.key}
            icon={step.icon}
            title={step.title}
            text={step.text}
            href={step.href}
          />
        ))}
      </div>
      <div className="flex justify-end">
        <AppButton variant="primary" onClick={complete} loading={busy}>
          {t("dashboardV2.onboarding.dismiss")}
        </AppButton>
      </div>
    </div>
  );
}
