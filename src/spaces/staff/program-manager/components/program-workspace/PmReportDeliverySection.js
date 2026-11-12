import { useI18n } from "@/lib/i18n";

export default function PmReportDeliverySection({ ctx }) {
  const { t } = useI18n();
  const { newPMReport, onDeliveryChallengeNoteChange, onDeliveryChallenges, onDeliveryQuality, onParticipantUnderstanding } = ctx;
  return (
    <>
          {/* ────────── SECTION 3: DELIVERY FEEDBACK ────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-blue-500/20">
              <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] font-bold text-blue-500 border border-blue-500/20">
                3
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">
                {t("pmMisc.workspace.deliveryFeedback")}
              </span>
            </div>

            <div className="space-y-3">
              {/* Session Delivery Quality */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.sessionDeliveryQuality")}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {["excellent", "good", "fair", "poor"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        onDeliveryQuality((prev) => ({
                          ...prev,
                          delivery_quality: opt,
                        }))
                      }
                      className={`px-4 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                        newPMReport.delivery_quality === opt
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

              {/* Participant Understanding */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.participantUnderstanding")}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {["high", "moderate", "low"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        onParticipantUnderstanding((prev) => ({
                          ...prev,
                          participant_understanding: opt,
                        }))
                      }
                      className={`px-4 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                        newPMReport.participant_understanding === opt
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                          : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                      }`}
                    >
                      {{
                        high: t("pmMisc.workspace.levelHigh"),
                        moderate: t("pmMisc.workspace.levelModerate"),
                        low: t("pmMisc.workspace.levelLow"),
                      }[opt] || opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delivery Challenges — Toggle + conditional note */}
              <div className="space-y-2 p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("pmMisc.workspace.deliveryChallenges")}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      onDeliveryChallenges((prev) => ({
                        ...prev,
                        delivery_challenges: !prev.delivery_challenges,
                      }))
                    }
                    className={`w-10 h-5 rounded-full transition-all relative ${
                      newPMReport.delivery_challenges
                        ? "bg-rose-500"
                        : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${
                        newPMReport.delivery_challenges ? "left-5" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
                {newPMReport.delivery_challenges && (
                  <textarea
                    value={newPMReport.delivery_challenge_note}
                    onChange={(event) =>
                      onDeliveryChallengeNoteChange((prev) => ({
                        ...prev,
                        delivery_challenge_note: event.target.value,
                      }))
                    }
                    rows={2}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none font-bold text-[var(--text-primary)] focus:border-rose-500 transition-all resize-none"
                    placeholder={t("pmMisc.workspace.shortNotePlaceholder")}
                  />
                )}
              </div>
            </div>
          </div>
    </>
  );
}
