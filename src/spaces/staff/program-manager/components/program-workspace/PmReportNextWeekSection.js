import { useI18n } from "@/lib/i18n";

export default function PmReportNextWeekSection({ ctx }) {
  const { t } = useI18n();
  const { newPMReport, onPlannedAdjustmentsChange, onProgramOnTrackSet, onProgramOnTrackUnset } = ctx;
  return (
    <>
          {/* ────────── SECTION 5: NEXT WEEK ────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-emerald-500/20">
              <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-[8px] font-black text-emerald-500 border border-emerald-500/20">
                5
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500">
                {t("pmMisc.workspace.nextWeek")}
              </span>
            </div>

            <div className="space-y-3">
              {/* Program On Track — Required */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.programOnTrack")}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onProgramOnTrackSet((prev) => ({
                        ...prev,
                        program_on_track: true,
                      }))
                    }
                    className={`px-5 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                      newPMReport.program_on_track === true
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                        : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                    }`}
                  >
                    {t("pmMisc.workspace.yes")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onProgramOnTrackUnset((prev) => ({
                        ...prev,
                        program_on_track: false,
                      }))
                    }
                    className={`px-5 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                      newPMReport.program_on_track === false
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                        : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                    }`}
                  >
                    {t("pmMisc.workspace.no")}
                  </button>
                </div>
              </div>

              {/* Planned Adjustments */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.plannedAdjustments")}
                </label>
                <textarea
                  value={newPMReport.planned_adjustments}
                  onChange={(event) =>
                    onPlannedAdjustmentsChange((prev) => ({
                      ...prev,
                      planned_adjustments: event.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-[var(--brand-orange)] transition-all resize-none"
                  placeholder={t(
                    "pmMisc.workspace.plannedAdjustmentsPlaceholder",
                  )}
                />
              </div>
            </div>
          </div>
    </>
  );
}
