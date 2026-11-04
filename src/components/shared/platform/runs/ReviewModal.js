import { X, Sparkles } from "lucide-react";
import { cn } from "./helpers";

export default function ReviewModal({
  reviewing, evaluation, setEvaluation, runFormFields, reviewTimeline, reviewData,
  setReviewData, reviewIncludeResultPdf, setReviewIncludeResultPdf, canReview,
  saving, closeReview, handleReview, handleReevaluate, t,
}) {
  return (
    <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4" onClick={closeReview}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-secondary border border-[var(--border-primary)] shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)] shrink-0">
          <div>
            <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.reviewSubmission")}</h3>
            <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">{reviewing.submitter_name || t("platformMisc.runs.anonymous")}</p>
          </div>
          <button onClick={closeReview} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-tertiary transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Submitted Answers */}
          {reviewing.data && Object.keys(reviewing.data).length > 0 && (() => {
            const submissionData = reviewing.data || {};
            const entries = runFormFields
              .filter(field => {
                const rawValue = submissionData[field.label] ?? submissionData[String(field.id)] ?? submissionData[field.id];
                return rawValue !== undefined && rawValue !== null && rawValue !== "";
              })
              .map(field => {
                const rawValue = submissionData[field.label] ?? submissionData[String(field.id)] ?? submissionData[field.id];
                let display = String(rawValue);
                if (typeof rawValue === "string" && rawValue.startsWith("{") && rawValue.includes('"code"')) {
                  try {
                    const parsedPhone = JSON.parse(rawValue);
                    if (parsedPhone.code && parsedPhone.number) {
                      const phoneCode = [{ code: "+234", flag: "🇳🇬" }, { code: "+229", flag: "🇧🇯" }, { code: "+233", flag: "🇬🇭" }, { code: "+254", flag: "🇰🇪" }, { code: "+27", flag: "🇿🇦" }, { code: "+20", flag: "🇪🇬" }, { code: "+33", flag: "🇫🇷" }, { code: "+44", flag: "🇬🇧" }, { code: "+1", flag: "🇺🇸" }, { code: "+49", flag: "🇩🇪" }, { code: "+91", flag: "🇮🇳" }, { code: "+971", flag: "🇦🇪" }].find((countryCode) => countryCode.code === parsedPhone.code);
                      display = `${phoneCode?.flag || ""} ${parsedPhone.code} ${parsedPhone.number}`;
                    }
                  } catch (_) {}
                }
                return { label: field.label, value: display, type: field.field_type };
              });

            // Fallback unmatched keys
            const unmatched = Object.entries(submissionData)
              .filter(([key]) => key !== "_scores" && key !== "_evaluation")
              .filter(([key]) => !runFormFields.some(field => String(field.id) === key || field.label === key));

            const allEntries = [
              ...entries,
              ...unmatched.map(([key, value]) => ({ label: key, value: String(value), type: "text" })),
            ];

            if (allEntries.length === 0) return null;

            return (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">{t("platformMisc.runs.submittedAnswers")}</p>
                <div className="space-y-3">
                  {allEntries.map(({ label, value, type }) => (
                    <div key={label} className="rounded-xl bg-tertiary border border-[var(--border-primary)] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">{label}</p>
                      <p className={cn(
                        "text-[13px] font-semibold text-[var(--text-primary)] leading-relaxed",
                        (type === "textarea" || type === "richtext") ? "whitespace-pre-wrap" : ""
                      )}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* AI Evaluation */}
          {evaluation?.dimensions && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400">{t("platformMisc.runs.aiEvaluation")}</p>
                <div className="flex items-center gap-3">
                  {evaluation.confidence != null && (
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {t("platformMisc.runs.confidence", { percent: (evaluation.confidence * 100).toFixed(0) })}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {t("platformMisc.runs.overallLabel")} <span className="text-purple-400 font-black">{evaluation.overall_score}%</span>
                    {evaluation.ranking && <> · {evaluation.ranking}</>}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-purple-500/20 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-purple-500/5">
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      <th className="px-3 py-2">{t("platformMisc.runs.colDimension")}</th>
                      <th className="px-3 py-2 text-center">{t("platformMisc.runs.colAi")}</th>
                      <th className="px-3 py-2 text-center">{t("platformMisc.runs.colOverride")}</th>
                      <th className="px-3 py-2 text-center">{t("platformMisc.runs.colFinal")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {evaluation.dimensions.map((dimension, dimensionIndex) => (
                      <tr key={dimensionIndex} className="text-[10px]">
                        <td className="px-3 py-2">
                          <span className="font-bold text-[var(--text-primary)]">{dimension.name}</span>
                          {dimension.reasoning && (
                            <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5 leading-relaxed">{dimension.reasoning.substring(0, 120)}{dimension.reasoning.length > 120 ? "..." : ""}</p>
                          )}
                          {dimension.confidence != null && (
                            <span className="text-[10px] font-medium text-[var(--text-secondary)] opacity-50">{t("platformMisc.runs.confidence", { percent: (dimension.confidence * 100).toFixed(0) })}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="font-black text-purple-400">{dimension.score}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number" min={0} max={10} step={0.5}
                            value={dimension.human_score ?? ""}
                            placeholder={String(dimension.score)}
                            onChange={(event) => {
                              const humanScore = event.target.value === "" ? null : parseFloat(event.target.value);
                              const updated = { ...evaluation };
                              updated.dimensions[dimensionIndex].human_score = humanScore;
                              updated.dimensions[dimensionIndex].final_score = humanScore ?? dimension.score;
                              setEvaluation(updated);
                            }}
                            className="w-14 px-1 py-0.5 rounded-lg bg-primary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none text-center"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn("font-black", (dimension.final_score ?? dimension.score) >= 7 ? "text-emerald-400" : (dimension.final_score ?? dimension.score) >= 5 ? "text-amber-400" : "text-rose-400")}>
                            {dimension.final_score ?? dimension.score}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {evaluation.recommendation && (
                <div className="mt-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-1">{t("platformMisc.runs.recommendation")}</p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] leading-relaxed">{evaluation.recommendation}</p>
                </div>
              )}
            </div>
          )}

          {/* Scoring Breakdown (separate from AI eval) */}
          {reviewing.data?._scores && (
            <div className="rounded-xl bg-tertiary border border-[var(--border-primary)] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.scoreBreakdown")}</p>
                <span className={cn("text-base font-black", reviewing.data._scores.overall >= 80 ? "text-emerald-500" : reviewing.data._scores.overall >= 60 ? "text-amber-500" : "text-rose-500")}>
                  {reviewing.data._scores.overall}%
                  {reviewing.data._scores.ranking && <span className="ml-2 text-[10px] font-bold text-[var(--text-secondary)]">({reviewing.data._scores.ranking})</span>}
                </span>
              </div>
              {reviewing.data._scores.sections && Object.entries(reviewing.data._scores.sections).map(([name, section]) => (
                <div key={name} className="flex items-center justify-between text-[10px] py-1 border-t border-[var(--border-primary)]">
                  <span className="text-[var(--text-secondary)]">{name} <span className="text-[10px] opacity-60">{t("platformMisc.runs.weight", { weight: section.weight })}</span></span>
                  <span className={cn("font-black", section.score >= 80 ? "text-emerald-500" : section.score >= 60 ? "text-amber-500" : "text-rose-500")}>{section.score}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Activity Timeline */}
          {reviewTimeline.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">{t("platformMisc.runs.activityTimeline")}</p>
              <div className="space-y-2">
                {reviewTimeline.map((entry, index) => (
                  <div key={index} className="flex items-start gap-3 text-[10px]">
                    <div className={cn("w-2 h-2 mt-1 rounded-full shrink-0",
                      entry.action === "submitted" ? "bg-blue-500" :
                      entry.action === "approved" ? "bg-emerald-500" :
                      entry.action === "rejected" ? "bg-rose-500" :
                      entry.action === "revision_requested" ? "bg-amber-500" :
                      "bg-slate-500"
                    )} />
                    <div>
                      <span className="font-bold uppercase tracking-wide text-[var(--text-primary)]">{entry.action}</span>
                      {entry.actor_name && <span className="text-[var(--text-secondary)]"> {t("platformMisc.runs.by")} {entry.actor_name}</span>}
                      <span className="text-[var(--text-secondary)] ml-1">{new Date(entry.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Decision Form */}
          <div className="space-y-3 pt-2 border-t border-[var(--border-primary)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.yourDecision")}</p>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1.5 block">{t("platformMisc.runs.decision")}</label>
              <select value={reviewData.decision} onChange={(event) => setReviewData({ ...reviewData, decision: event.target.value })} className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
                <option value="approved">{t("platformMisc.runs.decisionApprove")}</option>
                <option value="rejected">{t("platformMisc.runs.decisionReject")}</option>
                <option value="revision_requested">{t("platformMisc.runs.decisionRequestRevision")}</option>
                <option value="escalated">{t("platformMisc.runs.decisionEscalate")}</option>
                <option value="reassigned">{t("platformMisc.runs.decisionReassign")}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1.5 block">{t("platformMisc.runs.publicComment")} <span className="normal-case font-bold opacity-60">{t("platformMisc.runs.visibleToSubmitter")}</span></label>
              <textarea value={reviewData.comment} onChange={(event) => setReviewData({ ...reviewData, comment: event.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none" placeholder={t("platformMisc.runs.commentPlaceholder")} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1.5 block">{t("platformMisc.runs.internalNote")} <span className="text-amber-500 font-bold">{t("platformMisc.runs.privateNote")}</span></label>
              <textarea value={reviewData.internal_note} onChange={(event) => setReviewData({ ...reviewData, internal_note: event.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none bg-amber-500/5 border border-amber-500/20 text-[var(--text-primary)] resize-none" placeholder={t("platformMisc.runs.internalNotePlaceholder")} />
            </div>
            {/* The server only honours the PDF on an approval — a rejection
                ignores it, so the opt-in must not even appear there. */}
            {reviewData.decision === "approved" && (
              <div className="rounded-xl p-3 bg-primary border border-[var(--border-primary)]">
                <label className={cn("flex items-start gap-2", evaluation ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
                  <input
                    type="checkbox"
                    checked={reviewIncludeResultPdf}
                    disabled={!evaluation}
                    onChange={(event) => setReviewIncludeResultPdf(event.target.checked)}
                    className="mt-0.5 w-3.5 h-3.5 accent-[var(--brand-orange)]"
                  />
                  <span>
                    <span className="block text-[11px] font-bold text-[var(--text-primary)]">{t("platformMisc.runs.includeResultPdf")}</span>
                    <span className="block text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">{t("platformMisc.runs.includeResultPdfDesc")}</span>
                    {!evaluation && (
                      <span className="block text-[10px] font-bold text-amber-500 mt-0.5">{t("platformMisc.runs.includeResultPdfNotEvaluated")}</span>
                    )}
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[var(--border-primary)] bg-secondary shrink-0">
          <button onClick={closeReview} className="flex-1 btn btn-secondary">{t("platformMisc.runs.cancel")}</button>
          {canReview && (
          <button
            onClick={handleReevaluate}
            disabled={saving}
            title={t("platformMisc.runs.reevaluateTitle")}
            className="flex-1 px-3 py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[10px] font-bold uppercase tracking-wide hover:bg-purple-500/20 disabled:opacity-40 flex items-center justify-center gap-1"
          >
            <Sparkles className="w-3 h-3" /> {t("platformMisc.runs.reevaluate")}
          </button>
          )}
          <button onClick={handleReview} disabled={saving} className="flex-1 btn btn-primary">{saving ? t("platformMisc.runs.saving") : t("platformMisc.runs.submitReview")}</button>
        </div>
      </div>
    </div>
  );
}
