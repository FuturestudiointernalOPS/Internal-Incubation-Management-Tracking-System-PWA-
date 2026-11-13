import { useI18n } from "@/lib/i18n";

export default function PmReportOverviewSection({ ctx }) {
  const { t } = useI18n();
  const { newPMReport, onNewPMReport, onNewPMReportChange, onWeekRating } = ctx;
  return (
    <>
          {/* ────────── SECTION 1: WEEKLY OVERVIEW ────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-brand-orange/20">
              <div className="w-5 h-5 rounded-full bg-brand-orange/10 flex items-center justify-center text-[8px] font-black text-[var(--brand-orange)] border border-brand-orange/20">
                1
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--brand-orange)]">
                {t("pmMisc.workspace.reportWeeklyOverview")}
              </span>
            </div>

            <div className="space-y-3">
              {/* Week Status — Required */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.weekStatus")}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {["successful", "partially_completed", "not_completed"].map(
                    (opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          onNewPMReport((prev) => ({
                            ...prev,
                            week_status: opt,
                          }))
                        }
                        className={`px-4 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                          newPMReport.week_status === opt
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                            : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                        }`}
                      >
                        {{
                          successful: t(
                            "pmMisc.workspace.weekStatusSuccessful",
                          ),
                          partially_completed: t(
                            "pmMisc.workspace.weekStatusPartiallyCompleted",
                          ),
                          not_completed: t(
                            "pmMisc.workspace.weekStatusNotCompleted",
                          ),
                        }[opt] || opt}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Overall Week Rating — Required */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.overallWeekRating")}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {["excellent", "good", "fair", "poor"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        onWeekRating((prev) => ({
                          ...prev,
                          week_rating: opt,
                        }))
                      }
                      className={`px-4 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                        newPMReport.week_rating === opt
                          ? opt === "excellent"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                            : opt === "good"
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                              : opt === "fair"
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                                : "bg-rose-500/10 border-rose-500/30 text-rose-500"
                          : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                      }`}
                    >
                      {{
                        excellent: t("pmMisc.workspace.ratingExcellent"),
                        good: t("pmMisc.workspace.ratingGood"),
                        fair: t("pmMisc.workspace.ratingFair"),
                        poor: t("pmMisc.workspace.ratingPoor"),
                      }[opt] || opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Topic — Required */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.mainTopic")}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPMReport.main_topic}
                  onChange={(event) =>
                    onNewPMReportChange((prev) => ({
                      ...prev,
                      main_topic: event.target.value,
                    }))
                  }
                  placeholder={t("pmMisc.workspace.mainTopicPlaceholder")}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-[var(--brand-orange)] transition-all"
                />
              </div>
            </div>
          </div>
    </>
  );
}
