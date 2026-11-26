"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const showValue = (value) => (value === null || value === undefined || value === "" ? "—" : String(value));

/**
 * The correction chat. Saying "MS02 starts too early" is faster than hunting
 * the field, and the analyst returns the WHOLE plan with only that changed —
 * listed, so nothing moves behind the reviewer's back.
 *
 * The instruction, the in-flight flag, the pending suggestion and the handlers
 * (ask / keep it / dismiss it) all stay in the parent (`PlanReview`); they
 * arrive here as props. This component only renders.
 */
export default function PlanCorrectionPanel({
  instruction,
  setInstruction,
  ask,
  asking,
  suggestion,
  setSuggestion,
  keepSuggestion,
  inputClass,
}) {
  const { t } = useI18n();

  return (
    <>
      <div className="rounded-xl border border-[var(--border-primary)] p-3 space-y-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("venture.planImport.correctTitle")}
        </p>
        <p className="text-[10px] text-slate-400">{t("venture.planImport.correctHint")}</p>
        <textarea
          rows={2}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder={t("venture.planImport.correctPlaceholder")}
          className={inputClass}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={ask}
            disabled={asking || !instruction.trim()}
            className="px-3 py-1.5 rounded-lg border border-brand-orange/40 text-[var(--brand-orange)] text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"
          >
            {asking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {t(asking ? "venture.planImport.correcting" : "venture.planImport.correct")}
          </button>
        </div>

        {suggestion && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-2.5 space-y-2">
            {suggestion.notes && <p className="text-[11px] text-[var(--text-primary)]">{suggestion.notes}</p>}
            {suggestion.changes.length === 0 ? (
              <p className="text-[10px] text-slate-400">{t("venture.planImport.noChanges")}</p>
            ) : (
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  {t("venture.planImport.changesCount", { n: suggestion.changes.length })}
                </p>
                <ul className="space-y-0.5 max-h-56 overflow-y-auto">
                  {suggestion.changes.map((change, index) => (
                    <li key={index} className="text-[10px] text-[var(--text-secondary)]">
                      <span className="font-bold text-[var(--text-primary)]">
                        {change.target || change.scope}
                      </span>{" "}
                      <span className="text-slate-500">{change.field}</span>: {showValue(change.from)} →{" "}
                      {showValue(change.to)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSuggestion(null)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 text-[9px] font-black uppercase tracking-widest"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={keepSuggestion}
                disabled={suggestion.changes.length === 0}
                className="px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                {t("venture.planImport.keepChanges")}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
