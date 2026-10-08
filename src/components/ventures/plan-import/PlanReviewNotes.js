"use client";

import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The read-only notes of the review: rows the analyst could not place, and the
 * warnings carried by the stored draft. Both come from the parent
 * (`PlanReview`); this component only renders.
 */
export default function PlanReviewNotes({ unplaced, draft }) {
  const { t } = useI18n();

  return (
    <>
      {unplaced.length > 0 && (
        <div className="rounded-xl border border-[var(--border-primary)] p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
            {t("venture.planImport.unplaced")}
          </p>
          <ul className="space-y-1">
            {unplaced.map((item, index) => (
              <li key={`${item.location}-${index}`} className="text-[10px] text-[var(--text-secondary)]">
                <span className="font-bold text-[var(--text-primary)]">{item.location}</span> — {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(draft.warnings || []).length > 0 && (
        <div className="rounded-xl border border-[var(--border-primary)] p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
            {t("venture.planImport.warnings")}
          </p>
          <ul className="space-y-1">
            {(draft.warnings || []).map((warning, index) => (
              <li key={index} className="text-[10px] text-[var(--text-secondary)] flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-slate-500" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
