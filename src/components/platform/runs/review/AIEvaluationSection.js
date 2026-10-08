"use client";

import { Sparkles, RefreshCw, ChevronUp, ChevronDown, Lock } from "lucide-react";
import { cn } from "@/components/admin/dashboard-page/constants";

export default function AIEvaluationSection({
  evaluation,
  computedOverall,
  expandedDims,
  setExpandedDims,
  fields,
  submissionData,
  isReviewLocked,
  onReRunAI,
  updateDimScore,
  updateDimComment,
  saving,
  canReview,
  t,
}) {
  return (
    <>
      {/* Nothing evaluated yet: said out loud, with the action that fixes it.
          The screen used to fill this in silently, by running an evaluation as
          a side effect of being opened, which is why the absence of one is now
          a state the reviewer has to be told about rather than a silence. */}
      {!evaluation?.dimensions && (
        <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] px-6 py-10 text-center">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-purple-400 opacity-40" />
          <p className="text-sm font-black uppercase text-[var(--text-primary)]">
            {t("platformMisc.runReview.notEvaluatedTitle")}
          </p>
          <p className="mt-2 max-w-lg mx-auto text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {t("platformMisc.runReview.notEvaluatedHint")}
          </p>
          {canReview && (
            <button onClick={onReRunAI} disabled={saving || isReviewLocked} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold uppercase tracking-wide hover:bg-purple-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <RefreshCw className={cn("w-3 h-3", saving && "animate-spin")} />{' '}
              {t("platformMisc.runReview.runAi")}
            </button>
          )}
        </div>
      )}

      {evaluation?.dimensions && (
        <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-primary)] flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runReview.aiEvaluation")}</h2>
            <div className="ml-auto flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runReview.overall")}</p>
                <div className="flex items-baseline gap-1.5">
                  <p className={cn("text-base font-black", (computedOverall ?? evaluation.overall_score) >= 80 ? "text-emerald-400" : (computedOverall ?? evaluation.overall_score) >= 60 ? "text-amber-400" : "text-rose-400")}>{computedOverall ?? evaluation.overall_score}%</p>
                  {computedOverall !== null && computedOverall !== evaluation.overall_score && (
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.runReview.adjusted")}</span>
                  )}
                </div>
              </div>
              {evaluation.ranking && (
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[10px] font-bold uppercase text-purple-400">{evaluation.ranking}</span>
              )}
            </div>
          </div>

          {evaluation.recommendation && (
            <div className="px-6 py-3 bg-purple-500/5 border-b border-purple-500/10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-1">{t("platformMisc.runReview.aiRecommendation")}</p>
              <p className="text-[11px] text-[var(--text-primary)] leading-relaxed">{evaluation.recommendation}</p>
            </div>
          )}

          <div className="divide-y divide-[var(--border-primary)]">
            {evaluation.dimensions.map((dimension, dimensionIndex) => {
              const isExpanded = expandedDims[dimensionIndex];
              const aiScore = dimension.score ?? dimension.ai_score;
              const finalScore = dimension.final_score ?? aiScore;
              const scoreLabel = finalScore >= 9 ? t("platformMisc.runReview.scoreExcellent") : finalScore >= 7 ? t("platformMisc.runReview.scoreStrong") : finalScore >= 5 ? t("platformMisc.runReview.scoreAdequate") : finalScore >= 3 ? t("platformMisc.runReview.scoreWeak") : t("platformMisc.runReview.scorePoor");
              const scoreColor = finalScore >= 7 ? "text-emerald-400" : finalScore >= 5 ? "text-amber-400" : "text-rose-400";
              const scoreBg = finalScore >= 7 ? "bg-emerald-500/10 border-emerald-500/20" : finalScore >= 5 ? "bg-amber-500/10 border-amber-500/20" : "bg-rose-500/10 border-rose-500/20";

              // Match evidence quotes to actual form fields
              const relevantFields = fields.filter(field => {
                const fieldValue = submissionData[field.label] ?? submissionData[String(field.id)] ?? submissionData[field.id];
                if (!fieldValue) return false;
                const normalizedValue = String(fieldValue).toLowerCase();
                // Check if any evidence quote references this field's label or content
                return (dimension.evidence || []).some(evidence =>
                  evidence.toLowerCase().includes(field.label.toLowerCase().substring(0, 15)) ||
                  normalizedValue.slice(0, 60).split(' ').filter(word => word.length > 5).some(word => evidence.toLowerCase().includes(word.toLowerCase()))
                );
              }).slice(0, 4);

              // If no matched fields, show top 3 long-form answers as fallback
              const qaFields = relevantFields.length > 0 ? relevantFields : fields.filter(field => {
                const fieldValue = submissionData[field.label] ?? submissionData[String(field.id)] ?? submissionData[field.id];
                return fieldValue && String(fieldValue).length > 30 && (field.field_type === "textarea" || field.field_type === "richtext" || field.field_type === "text");
              }).slice(0, 3);

              return (
                <div key={dimensionIndex}>
                  {/* Row header — click to expand */}
                  <div
                    onClick={() => setExpandedDims(previousExpanded => ({ ...previousExpanded, [dimensionIndex]: !previousExpanded[dimensionIndex] }))}
                    className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-tertiary/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[var(--text-primary)]">{dimension.name}</span>
                        {dimension.confidence != null && (
                          <span className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.runReview.confident", { pct: (dimension.confidence * 100).toFixed(0) })}</span>
                        )}
                      </div>
                      {!isExpanded && dimension.reasoning && (
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5 truncate max-w-xs">{dimension.reasoning}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runReview.aiShort")}</p>
                        <p className="text-sm font-black text-purple-400">{aiScore ?? "—"}</p>
                      </div>
                    <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runReview.you")}</p>
                        <input
                          type="number" min={0} max={10} step={0.5}
                          value={dimension.human_score ?? ""}
                          placeholder={String(aiScore ?? "—")}
                          disabled={isReviewLocked}
                          onClick={event => event.stopPropagation()}
                          onChange={event => updateDimScore(dimensionIndex, event.target.value === "" ? null : parseFloat(event.target.value))}
                          className={cn(
                            "w-12 px-1.5 py-1 rounded-lg border text-xs font-bold outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                            dimension.human_score != null ? "bg-brand-orange/10 border-brand-orange/40 text-[var(--brand-orange)]" : "bg-primary border-[var(--border-primary)] text-[var(--text-primary)]",
                            isReviewLocked && "opacity-50 cursor-not-allowed"
                          )}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runReview.final")}</p>
                        <p className={cn("text-sm font-black", scoreColor)}>{finalScore ?? "—"}</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
                    </div>
                  </div>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <div className="bg-tertiary/20 border-t border-[var(--border-primary)] px-6 py-5 space-y-5">

                      {/* Score verdict */}
                      <div className={cn("flex items-center gap-4 p-4 rounded-xl border", scoreBg)}>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-0.5">{t("platformMisc.runReview.scoreVerdict")}</p>
                          <div className="flex items-baseline gap-2">
                            <span className={cn("text-3xl font-black", scoreColor)}>{finalScore}</span>
                            <span className="text-sm text-[var(--text-secondary)] font-bold">/ 10</span>
                            <span className={cn("text-[10px] font-bold uppercase tracking-widest ml-1", scoreColor)}>— {scoreLabel}</span>
                          </div>
                        </div>
                        {dimension.confidence != null && (
                          <div className="ml-auto text-right">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-0.5">{t("platformMisc.runReview.confidence")}</p>
                            <p className="text-sm font-black text-[var(--text-primary)]">{(dimension.confidence * 100).toFixed(0)}%</p>
                          </div>
                        )}
                      </div>

                      {/* AI Reasoning */}
                      {dimension.reasoning && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-2">{t("platformMisc.runReview.whyThisScore")}</p>
                          <p className="text-[12px] text-[var(--text-primary)] leading-relaxed">{dimension.reasoning}</p>
                        </div>
                      )}

                      {/* Strengths & Weaknesses */}
                      {(dimension.strengths?.length > 0 || dimension.weaknesses?.length > 0) && (
                        <div className="grid grid-cols-2 gap-3">
                          {dimension.strengths?.length > 0 && (
                            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-2">{t("platformMisc.runReview.strengths")}</p>
                              <div className="space-y-1.5">
                                {dimension.strengths.map((strength, index) => (
                                  <p key={index} className="text-[11px] text-emerald-300 leading-snug">+ {strength}</p>
                                ))}
                              </div>
                            </div>
                          )}
                          {dimension.weaknesses?.length > 0 && (
                            <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400 mb-2">{t("platformMisc.runReview.areasToImprove")}</p>
                              <div className="space-y-1.5">
                                {dimension.weaknesses.map((weakness, index) => (
                                  <p key={index} className="text-[11px] text-rose-300 leading-snug">− {weakness}</p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Evidence quotes from AI */}
                      {dimension.evidence?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">{t("platformMisc.runReview.evidenceFromApplicant")}</p>
                          <div className="space-y-2">
                            {dimension.evidence.map((evidence, index) => (
                              <p key={index} className="text-[11px] text-[var(--text-secondary)] pl-4 border-l-2 border-purple-500/30 leading-relaxed">&quot;{evidence}&quot;</p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Relevant Q&A from the form */}
                      {qaFields.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">{t("platformMisc.runReview.relevantQA")}</p>
                          <div className="space-y-3">
                            {qaFields.map(field => {
                              const fieldValue = submissionData[field.label] ?? submissionData[String(field.id)] ?? submissionData[field.id];
                              if (!fieldValue) return null;
                              return (
                                <div key={field.id} className="rounded-xl bg-secondary border border-[var(--border-primary)] p-4">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">{field.label}</p>
                                  <p className="text-[12px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{String(fieldValue)}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Human override */}
                      <div className="pt-2 border-t border-[var(--border-primary)]">
                        {isReviewLocked ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-500/5 border border-slate-500/20">
                            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <p className="text-[10px] font-bold text-[var(--text-secondary)]">{t("platformMisc.runReview.scoreLockedNotice")}</p>
                          </div>
                        ) : (
                          <>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)] mb-2">{t("platformMisc.runReview.overrideScore")}</p>
                            <div className="flex items-start gap-3">
                              <input
                                type="number" min={0} max={10} step={0.5}
                                value={dimension.human_score ?? ""}
                                placeholder={String(aiScore ?? "—")}
                                onClick={event => event.stopPropagation()}
                                onChange={event => updateDimScore(dimensionIndex, event.target.value === "" ? null : parseFloat(event.target.value))}
                                className="w-20 px-3 py-2 rounded-xl bg-primary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shrink-0"
                              />
                              <textarea
                                value={dimension.human_comment || ""}
                                onChange={event => updateDimComment(dimensionIndex, event.target.value)}
                                onClick={event => event.stopPropagation()}
                                rows={2}
                                placeholder={t("platformMisc.runReview.overridePlaceholder")}
                                className="flex-1 rounded-xl px-3 py-2 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none"
                              />
                            </div>
                          </>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
