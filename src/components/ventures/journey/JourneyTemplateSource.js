"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { Copy } from "lucide-react";

/**
 * The banner saying which operating plan / journey template this Venture's
 * journey was generated from.
 *
 * Moved verbatim out of JourneyManagerPanel: the prop carries the panel value
 * of the same name, so the markup and its behaviour are unchanged.
 */
export default function JourneyTemplateSource({ templateSource }) {
  const { t } = useI18n();
  if (!templateSource) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-brand-orange/25 bg-brand-orange/[0.04] px-4 py-2.5">
      <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
        <Copy className="w-3.5 h-3.5" /> {t("venture.manager.sourceFrom")}
      </span>
      <span className="text-xs font-bold text-[var(--text-primary)]">{templateSource.name || templateSource.id}</span>
      <span className="px-1.5 py-0.5 rounded bg-brand-orange/10 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
        {t(templateSource.type === "journey" ? "venture.manager.sourceTypeJourney" : "venture.manager.sourceTypePlan")}
      </span>
    </div>
  );
}
