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
  // Bumped when the reporting currency changes: the open form re-reads, so its
  // amount labels show the currency the bar now says.
  const [currencyVersion, setCurrencyVersion] = useState(0);

  return (
    <div className="space-y-5">
      <SectionHead
        title={t("venture.reporting.title") || "Venture Reporting"}
        subtitle={t("venture.reporting.subtitle") || "The studio's periodic reporting engine and milestone evidence."}
      />

      {/* ── Currency Notification & Quick Switcher Bar ── */}
      {ventureId && (
        <CurrencyNotificationBar
          ventureId={ventureId}
          onCurrencyChanged={() => setCurrencyVersion((current) => current + 1)}
        />
      )}

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
      {tab === "monthly" && <VentureMonthlyReport ventureId={ventureId} reloadKey={currencyVersion} />}
      {tab === "quarterly" && <VentureQuarterlyReport ventureId={ventureId} reloadKey={currencyVersion} />}
      {tab === "events" && <VentureEvents ventureId={ventureId} reloadKey={currencyVersion} />}
    </div>
  );
}
