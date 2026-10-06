"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { Archive, Route } from "lucide-react";

/**
 * What the journey list shows when there is nothing to show: the archived view
 * empty, or the active view empty.
 *
 * Moved verbatim out of JourneyManagerPanel: the prop carries the panel value
 * of the same name, so the markup and its behaviour are unchanged.
 */
export default function JourneyEmptyState({ viewArchived }) {
  const { t } = useI18n();
  return viewArchived ? (
    <div className="rounded-xl border border-dashed border-[var(--border-primary)] p-6 text-center">
      <Archive className="w-6 h-6 mx-auto text-slate-500 mb-2" />
      <p className="text-xs font-bold text-[var(--text-primary)]">{t("venture.manager.emptyArchivedJourneys")}</p>
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-[var(--border-primary)] p-8 text-center">
      <Route className="w-6 h-6 mx-auto text-slate-500 mb-2" />
      <p className="text-xs font-bold text-[var(--text-primary)]">{t("venture.manager.noStages")}</p>
      <p className="text-[10px] text-slate-500 mt-1 max-w-md mx-auto">{t("venture.manager.noStagesDesc")}</p>
    </div>
  );
}
