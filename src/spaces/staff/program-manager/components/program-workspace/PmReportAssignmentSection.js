import { useI18n } from "@/lib/i18n";

export default function PmReportAssignmentSection({ ctx }) {
  const { t } = useI18n();
  const { kpis, newPMReport, onAssignmentGivenSet, onAssignmentGivenUnset, onAssignmentKpiIds, onAssignmentObjectiveChange, onAssignmentOutcomeChange } = ctx;
  return (
    <>
          {/* ────────── ASSIGNMENT TRACKING ────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-violet-500/20">
              <div className="w-5 h-5 rounded-full bg-violet-500/10 flex items-center justify-center text-[10px] font-bold text-violet-500 border border-violet-500/20">
                +
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-500">
                {t("pmMisc.workspace.assignmentTracking")}
              </span>
            </div>

            <div className="space-y-3">
              {/* Was An Assignment Given? — Required */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.assignmentGiven")}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onAssignmentGivenSet((prev) => ({
                        ...prev,
                        assignment_given: true,
                      }))
                    }
                    className={`px-5 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                      newPMReport.assignment_given === true
                        ? "bg-violet-500/10 border-violet-500/30 text-violet-500"
                        : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                    }`}
                  >
                    {t("pmMisc.workspace.yes")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onAssignmentGivenUnset((prev) => ({
                        ...prev,
                        assignment_given: false,
                        assignment_kpi_ids: [],
                        assignment_objective: "",
                        assignment_outcome: "",
                      }))
                    }
                    className={`px-5 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                      newPMReport.assignment_given === false
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                        : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                    }`}
                  >
                    {t("pmMisc.workspace.no")}
                  </button>
                </div>
              </div>

              {newPMReport.assignment_given && (
                <>
                  {/* Select Related KPI(s) — Required */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("pmMisc.workspace.selectRelatedKpis")}{" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    {kpis.length === 0 ? (
                      <p className="text-sm text-slate-500 px-2">
                        {t("pmMisc.workspace.noKpisForProgram")}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-1.5 max-h-[160px] overflow-y-auto p-1 custom-scrollbar">
                        {kpis.map((kpi, kpiIndex) => {
                          const kpiShare = Math.floor(100 / kpis.length);
                          const kpiPercent =
                            kpiIndex === kpis.length - 1
                              ? 100 - kpiShare * (kpis.length - 1)
                              : kpiShare;
                          const isSelected = (
                            newPMReport.assignment_kpi_ids || []
                          ).includes(kpi.id);
                          return (
                            <button
                              key={kpi.id}
                              type="button"
                              onClick={() =>
                                onAssignmentKpiIds((prev) => ({
                                  ...prev,
                                  assignment_kpi_ids: isSelected
                                    ? prev.assignment_kpi_ids.filter(
                                        (id) => id !== kpi.id,
                                      )
                                    : [...prev.assignment_kpi_ids, kpi.id],
                                }))
                              }
                              className={`flex items-center justify-between p-2.5 rounded-lg border text-[10px] font-bold uppercase tracking-tight transition-all text-left ${
                                isSelected
                                  ? "bg-violet-500/10 border-violet-500/30 text-violet-500"
                                  : "bg-black/20 border-white/5 text-slate-400 hover:border-white/20"
                              }`}
                            >
                              <span>{kpi.title}</span>
                              <span className="text-[10px] opacity-50">
                                {kpiPercent}%
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Assignment Objective — Required */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("pmMisc.workspace.assignmentObjective")}{" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newPMReport.assignment_objective}
                      onChange={(event) =>
                        onAssignmentObjectiveChange((prev) => ({
                          ...prev,
                          assignment_objective: event.target.value,
                        }))
                      }
                      placeholder={t(
                        "pmMisc.workspace.assignmentObjectivePlaceholder",
                      )}
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-violet-500 transition-all"
                    />
                  </div>

                  {/* Expected Outcome — Optional */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("pmMisc.workspace.expectedOutcome")}
                    </label>
                    <textarea
                      value={newPMReport.assignment_outcome}
                      onChange={(event) =>
                        onAssignmentOutcomeChange((prev) => ({
                          ...prev,
                          assignment_outcome: event.target.value,
                        }))
                      }
                      rows={2}
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-violet-500 transition-all resize-none"
                      placeholder={t(
                        "pmMisc.workspace.expectedOutcomePlaceholder",
                      )}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
    </>
  );
}
