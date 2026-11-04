"use client";

import { Calendar, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The Meetings | Due Diligence tab strip.
 * Extracted verbatim from AdminRelationshipsPage.
 */
export default function DetailTabs({ detailTab, onDetailTabChange, meetingsCount, ddCount }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-1 border-b border-[var(--border-primary)]">
      {[
        { id: "meetings", label: t("investorAdmin.relationships.meetings"), icon: Calendar, count: meetingsCount },
        { id: "diligence", label: t("investorAdmin.relationships.dueDiligence"), icon: Shield, count: ddCount },
      ].map(tab => (
        <button key={tab.id} onClick={() => onDetailTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-colors relative ${
            detailTab === tab.id ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}>
          <tab.icon className="w-3.5 h-3.5" />
          {tab.label} ({tab.count})
          {detailTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-orange)]" />}
        </button>
      ))}
    </div>
  );
}
