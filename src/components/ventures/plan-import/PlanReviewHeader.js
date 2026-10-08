"use client";

import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The review header: the "nothing is created yet" notice, the derived refs
 * notice, the error / success banners, the stored-draft stats, the already
 * covered panel and the "nothing new" empty state.
 *
 * Nothing is computed here — every value comes from the parent (`PlanReview`),
 * which owns the state and the writes. This component only renders.
 */
export default function PlanReviewHeader({ draft, error, notice, stats, alreadyCovered, proposal }) {
  const { t } = useI18n();

  return (
    <>
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
        <span className="text-[11px] font-bold text-amber-300">{t("venture.planImport.nothingCreated")}</span>
      </div>

      <p className="text-[10px] text-slate-400">{t("venture.planImport.reviewIntro")}</p>

      {/* The analyst had to infer the task references, and references are what
          dependencies point at — so this is said plainly, once. */}
      {draft.proposal?.refs_derived && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <span className="text-[11px] font-bold text-amber-300">{t("venture.planImport.refsDerived")}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-widest">
        <span className="px-2 py-1 rounded-lg bg-brand-orange/10 text-[var(--brand-orange)]">
          {t("venture.planImport.statJourneys", { n: stats.journeys || 0 })}
        </span>
        <span className="px-2 py-1 rounded-lg bg-white/5 text-[var(--text-secondary)]">
          {t("venture.planImport.statMilestones", { n: stats.milestones || 0 })}
        </span>
        <span className="px-2 py-1 rounded-lg bg-white/5 text-[var(--text-secondary)]">
          {t("venture.planImport.statTasks", { n: stats.tasks || 0 })}
        </span>
        <span className="px-2 py-1 rounded-lg bg-white/5 text-[var(--text-secondary)]">
          {t("venture.planImport.statDeliverables", { n: stats.deliverables || 0 })}
        </span>
        <span className="px-2 py-1 rounded-lg bg-white/5 text-slate-400 normal-case tracking-normal">
          {t("venture.planImport.sheetsRead", {
            n: (draft.sheets || []).length,
            names: (draft.sheets || []).map((sheet) => sheet.name).join(", "),
          })}
        </span>
        {/* Which sheet the analyst TOOK the work from. The choice is made in the
            route, not by the model, so the reviewer can see it and check it. */}
        {(draft.sheets || [])
          .filter((sheet) => sheet.plan)
          .map((sheet) => (
            <span
              key={sheet.name}
              className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 normal-case tracking-normal"
            >
              {t("venture.planImport.planSheet", { name: sheet.name })}
            </span>
          ))}
      </div>

      {alreadyCovered.length > 0 && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-sky-400 mb-1.5">
            {t("venture.planImport.alreadyCovered", { n: alreadyCovered.length })}
          </p>
          <ul className="space-y-0.5 mb-1.5">
            {alreadyCovered.map((item, index) => (
              <li key={index} className="text-[10px] text-[var(--text-secondary)]">
                <span className="text-[var(--text-primary)]">{item.sheet_item}</span> → {item.existing}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-slate-400">{t("venture.planImport.alreadyCoveredHint")}</p>
        </div>
      )}

      {(proposal.journeys || []).length === 0 && (
        <div className="rounded-xl border border-[var(--border-primary)] p-3">
          <p className="text-[11px] font-bold text-[var(--text-primary)]">{t("venture.planImport.nothingNew")}</p>
        </div>
      )}
    </>
  );
}
