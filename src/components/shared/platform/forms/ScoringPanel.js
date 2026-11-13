import { BarChart3, X, MinusCircle, PlusCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ScoringPanel({ scoringConfig, setScoringConfig, sections, fields, onClose }) {
  const { t } = useI18n();
  return (
    <div className="px-6 py-4 bg-secondary border-b border-[var(--border-primary)] space-y-4 shrink-0 max-h-[50vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.forms.scoringConfigTitle")}</h3>
        </div>
        <button onClick={onClose}><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
      </div>

      {/* Enable toggle & global settings */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="flex items-center gap-3 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)] cursor-pointer">
          <input type="checkbox" checked={scoringConfig.enabled} onChange={(event) => setScoringConfig({ ...scoringConfig, enabled: event.target.checked })} className="w-4 h-4 rounded accent-indigo-500" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">{t("platformMisc.forms.scoringEnable")}</p>
            <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.forms.scoringAutoCalc")}</p>
          </div>
        </label>
        <div className="space-y-1 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.scoringMaxPerQuestion")}</label>
          <input type="number" min={0} value={scoringConfig.max_per_question ?? ""} onChange={(event) => { const nextValue = event.target.value; setScoringConfig({ ...scoringConfig, max_per_question: nextValue === "" ? 0 : parseInt(nextValue) || 0 }); }} className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none" placeholder="0" />
        </div>
        <div className="space-y-1 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.scoringTotalWeight")}</label>
          <p className={`text-xl font-black ${Object.values(scoringConfig.sections || {}).reduce((total, section) => total + (section.weight || 0), 0) === 100 ? "text-emerald-400" : "text-rose-400"}`}>
            {Object.values(scoringConfig.sections || {}).reduce((total, section) => total + (section.weight || 0), 0)}%
          </p>
        </div>
      </div>

      {/* Section weights */}
      {scoringConfig.enabled && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t("platformMisc.forms.scoringSectionWeights")}</h4>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
            <table className="w-full text-left">
              <thead className="bg-tertiary">
                <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  <th className="px-3 py-2">{t("platformMisc.forms.scoringTableSection")}</th>
                  <th className="px-3 py-2">{t("platformMisc.forms.scoringTableWeight")}</th>
                  <th className="px-3 py-2">{t("platformMisc.forms.scoringTableScoredFields")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {sections.map((section) => {
                  const sectionFields = fields.filter((field) => field.section_id === section.id);
                  const ratingFields = sectionFields.filter((field) => field.field_type === "rating");
                  const sectionKey = section.title;
                  const currentWeight = (scoringConfig.sections?.[sectionKey]?.weight) || 0;
                  const currentLabels = scoringConfig.sections?.[sectionKey]?.field_labels || [];
                  return (
                    <tr key={section.title} className="text-[10px] font-bold text-[var(--text-primary)]">
                      <td className="px-3 py-2">{section.title}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={currentWeight}
                          onChange={(event) => setScoringConfig({
                            ...scoringConfig,
                            sections: { ...scoringConfig.sections, [sectionKey]: { ...scoringConfig.sections?.[sectionKey], weight: parseInt(event.target.value) || 0, field_labels: scoringConfig.sections?.[sectionKey]?.field_labels || ratingFields.map((field) => field.label) } },
                          })}
                          className="w-16 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {ratingFields.map((field) => {
                            const isScored = currentLabels.includes(field.label);
                            return (
                              <button
                                key={field._tmpId || field.id || field.label}
                                onClick={() => {
                                  const nextLabels = isScored ? currentLabels.filter((label) => label !== field.label) : [...currentLabels, field.label];
                                  setScoringConfig({
                                    ...scoringConfig,
                                    sections: { ...scoringConfig.sections, [sectionKey]: { ...scoringConfig.sections?.[sectionKey], weight: currentWeight, field_labels: nextLabels } },
                                  });
                                }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${isScored ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "bg-tertiary text-[var(--text-secondary)] border border-[var(--border-primary)]"}`}
                              >
                                {field.label.substring(0, 30)}{field.label.length > 30 ? "..." : ""}
                              </button>
                            );
                          })}
                          {ratingFields.length === 0 && <span className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.forms.scoringNoRatingFields")}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rankings */}
          <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] pt-2">{t("platformMisc.forms.scoringRankingThresholds")}</h4>
          <div className="space-y-2">
            {(scoringConfig.rankings || []).map((rank, index) => (
              <div key={index} className="flex items-center gap-2 p-2 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: rank.color || "#64748b" }} />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={rank.min}
                  onChange={(event) => {
                    const nextRankings = [...(scoringConfig.rankings || [])];
                    nextRankings[index] = { ...nextRankings[index], min: parseInt(event.target.value) || 0 };
                    setScoringConfig({ ...scoringConfig, rankings: nextRankings });
                  }}
                  className="w-14 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none text-center"
                  placeholder={t("platformMisc.forms.rankingMin")}
                />
                <span className="text-[var(--text-secondary)] text-[10px]">–</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={rank.max}
                  onChange={(event) => {
                    const nextRankings = [...(scoringConfig.rankings || [])];
                    nextRankings[index] = { ...nextRankings[index], max: parseInt(event.target.value) || 0 };
                    setScoringConfig({ ...scoringConfig, rankings: nextRankings });
                  }}
                  className="w-14 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none text-center"
                  placeholder={t("platformMisc.forms.rankingMax")}
                />
                <input
                  type="text"
                  value={rank.label}
                  onChange={(event) => {
                    const nextRankings = [...(scoringConfig.rankings || [])];
                    nextRankings[index] = { ...nextRankings[index], label: event.target.value };
                    setScoringConfig({ ...scoringConfig, rankings: nextRankings });
                  }}
                  className="flex-1 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                  placeholder={t("platformMisc.forms.rankingLabel")}
                />
                <input
                  type="text"
                  value={rank.color || ""}
                  onChange={(event) => {
                    const nextRankings = [...(scoringConfig.rankings || [])];
                    nextRankings[index] = { ...nextRankings[index], color: event.target.value };
                    setScoringConfig({ ...scoringConfig, rankings: nextRankings });
                  }}
                  className="w-20 px-2 py-1 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none font-mono"
                  placeholder="#color"
                />
                <button onClick={() => {
                  const nextRankings = [...(scoringConfig.rankings || [])];
                  nextRankings.splice(index, 1);
                  setScoringConfig({ ...scoringConfig, rankings: nextRankings });
                }} className="text-rose-500 hover:text-rose-400 shrink-0"><MinusCircle className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button onClick={() => setScoringConfig({
              ...scoringConfig,
              rankings: [...(scoringConfig.rankings || []), { min: 0, max: 100, label: "New Tier", color: "#64748b" }],
            })} className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase"><PlusCircle className="w-3 h-3" /> {t("platformMisc.forms.scoringAddRankingTier")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
