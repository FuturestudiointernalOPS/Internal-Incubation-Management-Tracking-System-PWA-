"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppButton from "@/components/ui/AppButton";
import SectionHead from "@/components/ui/SectionHead";
import VentureMonthlyReport from "./VentureMonthlyReport";
import VentureQuarterlyReport from "./VentureQuarterlyReport";
import VentureEvents from "./VentureEvents";
import VentureGlossary from "./VentureGlossary";
import CurrencyNotificationBar from "./CurrencyNotificationBar";

/**
 * VENTURE REPORTING (Streamlined 4-Tab Cycle)
 *
 * 1. Glossary: Definitions of indicators, terms & calculations
 * 2. Monthly: 11 monthly metrics submission
 * 3. Quarterly: Stage-relevant quarterly milestones & pipeline
 * 4. Events: Important business milestones backed by evidence
 */

const TABS = ["glossary", "monthly", "quarterly", "events"];

export default function VentureReportingScreen({ ventureId }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("glossary");

  return (
    <div className="space-y-5">
      <SectionHead
        title={t("venture.reporting.title") || "Venture Reporting"}
        subtitle={t("venture.reporting.subtitle") || "The studio's periodic reporting engine and milestone evidence."}
      />

      {/* ── Currency Notification & Quick Switcher Bar ── */}
      {ventureId && <CurrencyNotificationBar ventureId={ventureId} />}

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <AppButton
            key={item}
            size="sm"
            variant={tab === item ? "primary" : "secondary"}
            onClick={() => setTab(item)}
          >
            {t(`venture.reporting.tab.${item}`)}
          </AppButton>
        ))}
      </div>

      {tab === "glossary" && <VentureGlossary ventureId={ventureId} />}
      {tab === "monthly" && <VentureMonthlyReport ventureId={ventureId} />}
      {tab === "quarterly" && <VentureQuarterlyReport ventureId={ventureId} />}
      {tab === "events" && <VentureEvents ventureId={ventureId} />}
    </div>
  );
}
