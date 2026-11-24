import { Sparkles, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function EvaluationFrameworkPanel({
  aiEvalFramework, setAiEvalFramework, aiEvalText, setAiEvalText, aiEvalLoading,
  editingForm, canEdit, saving,
  onSaveFramework, onToggleEnabled, onGenerate, onSaveDetailed, onRemove, onClose,
}) {
  const { t } = useI18n();
  return (
    <div className="px-6 py-4 bg-secondary border-b border-[var(--border-primary)] space-y-4 shrink-0 max-h-[50vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.forms.aiEvalTitle")}</h3>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
          <button
            onClick={onSaveFramework}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-purple-500 text-white text-[10px] font-bold uppercase tracking-wide hover:bg-purple-600 transition-all"
          >
            {t("platformMisc.forms.aiEvalSaveFramework")}
          </button>
          )}
          <button onClick={onClose}><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
        </div>
      </div>

      {/* Enable AI Evaluation toggle */}
      <label className="flex items-center gap-3 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)] cursor-pointer">
        <input
          type="checkbox"
          checked={!!(editingForm?.settings?.ai_evaluation)}
          onChange={(event) => onToggleEnabled(event.target.checked)}
          className="w-4 h-4 rounded accent-purple-500"
        />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">{t("platformMisc.forms.aiEvalEnable")}</p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.forms.aiEvalEnableHint")}</p>
        </div>
      </label>

      {aiEvalFramework ? (
        <>
          {/* Weight validation */}
          {(() => {
            const total = (aiEvalFramework.dimensions || []).reduce((sum, dimension) => sum + (parseInt(dimension.weight) || 0), 0);
            return total !== 100 ? (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-400">
                {t("platformMisc.forms.aiEvalWeightsWarning", { total })}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                {t("platformMisc.forms.aiEvalWeightsReady")}
              </div>
            );
          })()}

          {/* Editable dimensions table */}
          <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
            <table className="w-full text-left">
              <thead className="bg-tertiary">
                <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  <th className="px-2 py-2">{t("platformMisc.forms.aiEvalTableDimension")}</th>
                  <th className="px-2 py-2 w-16">{t("platformMisc.forms.aiEvalTableWeight")}</th>
                  <th className="px-2 py-2">{t("platformMisc.forms.aiEvalTableCriteria")}</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {(aiEvalFramework.dimensions || []).map((dimension, index) => (
                  <tr key={index} className="text-[10px]">
                    <td className="px-2 py-1.5">
                      <input
                        value={dimension.name}
                        onChange={(event) => {
                          const dimensions = [...aiEvalFramework.dimensions];
                          dimensions[index] = { ...dimensions[index], name: event.target.value };
                          setAiEvalFramework({ ...aiEvalFramework, dimensions });
                        }}
                        className="w-full px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={dimension.weight}
                        onChange={(event) => {
                          const dimensions = [...aiEvalFramework.dimensions];
                          dimensions[index] = { ...dimensions[index], weight: parseInt(event.target.value) || 0 };
                          setAiEvalFramework({ ...aiEvalFramework, dimensions });
                        }}
                        className="w-full px-1 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={(dimension.criteria || []).join(", ")}
                        onChange={(event) => {
                          const dimensions = [...aiEvalFramework.dimensions];
                          dimensions[index] = { ...dimensions[index], criteria: event.target.value.split(",").map(criterion => criterion.trim()).filter(Boolean) };
                          setAiEvalFramework({ ...aiEvalFramework, dimensions });
                        }}
                        className="w-full px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] text-[var(--text-primary)] outline-none"
                        placeholder={t("platformMisc.forms.aiEvalCriteriaPlaceholder")}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => {
                          const dimensions = [...aiEvalFramework.dimensions];
                          dimensions.splice(index, 1);
                          setAiEvalFramework({ ...aiEvalFramework, dimensions });
                        }}
                        className="text-rose-500 hover:text-rose-400"
                      ><X className="w-3 h-3" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAiEvalFramework({
                  ...aiEvalFramework,
                  dimensions: [...(aiEvalFramework.dimensions || []), { name: "New Dimension", weight: 0, criteria: [], ai_prompt: "" }],
                });
              }}
              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wide"
            >
              {t("platformMisc.forms.aiEvalAddDimension")}
            </button>
          </div>

          {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={onSaveDetailed}
              disabled={aiEvalLoading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-[10px] font-black uppercase hover:bg-purple-600 disabled:opacity-50 transition-all"
            >
              {t("platformMisc.forms.aiEvalSaveFramework")}
            </button>
            <button
              onClick={onRemove}
              className="px-4 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-rose-500 hover:text-rose-400"
            >
              {t("platformMisc.forms.remove")}
            </button>
          </div>
          )}
        </>
      ) : (
        <>
          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
            {t("platformMisc.forms.aiEvalEmptyHint")}
          </p>
          <textarea
            value={aiEvalText}
            onChange={(event) => setAiEvalText(event.target.value)}
            rows={6}
            placeholder={t("platformMisc.forms.aiEvalTextPlaceholder")}
            className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)] resize-none"
          />
          {canEdit && (
          <button
            onClick={onGenerate}
            disabled={aiEvalLoading || !aiEvalText.trim()}
            className="w-full px-4 py-3 rounded-xl bg-purple-500 text-white text-[10px] font-black uppercase hover:bg-purple-600 disabled:opacity-50 transition-all"
          >
            {aiEvalLoading ? t("platformMisc.forms.analyzing") : t("platformMisc.forms.aiEvalGenerate")}
          </button>
          )}
        </>
      )}
    </div>
  );
}
