import { useI18n } from "@/lib/i18n";

export default function PmReportParticipationSection({ ctx }) {
  const { t } = useI18n();
  const { newPMReport, onAttendanceLevel, onParticipantsAttentionNotesChange, onParticipantsNeedAttention, onParticipationLevel, onStandoutNotesChange, onStandoutParticipants } = ctx;
  return (
    <>
          {/* ────────── SECTION 2: PARTICIPATION ────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-indigo-500/20">
              <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] font-bold text-indigo-500 border border-indigo-500/20">
                2
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">
                {t("pmMisc.workspace.participation")}
              </span>
            </div>

            <div className="space-y-3">
              {/* Attendance Level */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.attendanceLevel")}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {["high", "moderate", "low"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        onAttendanceLevel((prev) => ({
                          ...prev,
                          attendance_level: opt,
                        }))
                      }
                      className={`px-4 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                        newPMReport.attendance_level === opt
                          ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-500"
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

              {/* Participation Level */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.participationLevel")}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {["very_active", "active", "passive"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        onParticipationLevel((prev) => ({
                          ...prev,
                          participation_level: opt,
                        }))
                      }
                      className={`px-4 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                        newPMReport.participation_level === opt
                          ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-500"
                          : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                      }`}
                    >
                      {{
                        very_active: t(
                          "pmMisc.workspace.participationVeryActive",
                        ),
                        active: t("pmMisc.workspace.participationActive"),
                        passive: t("pmMisc.workspace.participationPassive"),
                      }[opt] || opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Participants/Groups Need Attention — Toggle + conditional note */}
              <div className="space-y-2 p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("pmMisc.workspace.participantsNeedAttention")}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      onParticipantsNeedAttention((prev) => ({
                        ...prev,
                        participants_need_attention:
                          !prev.participants_need_attention,
                      }))
                    }
                    className={`w-10 h-5 rounded-full transition-all relative ${
                      newPMReport.participants_need_attention
                        ? "bg-amber-500"
                        : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${
                        newPMReport.participants_need_attention
                          ? "left-5"
                          : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
                {newPMReport.participants_need_attention && (
                  <textarea
                    value={newPMReport.participants_attention_notes}
                    onChange={(event) =>
                      onParticipantsAttentionNotesChange((prev) => ({
                        ...prev,
                        participants_attention_notes: event.target.value,
                      }))
                    }
                    rows={2}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none font-bold text-[var(--text-primary)] focus:border-amber-500 transition-all resize-none"
                    placeholder={t("pmMisc.workspace.shortNotePlaceholder")}
                  />
                )}
              </div>

              {/* Standout Participants — Toggle + conditional note */}
              <div className="space-y-2 p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("pmMisc.workspace.standoutParticipants")}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      onStandoutParticipants((prev) => ({
                        ...prev,
                        standout_participants: !prev.standout_participants,
                      }))
                    }
                    className={`w-10 h-5 rounded-full transition-all relative ${
                      newPMReport.standout_participants
                        ? "bg-emerald-500"
                        : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${
                        newPMReport.standout_participants
                          ? "left-5"
                          : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
                {newPMReport.standout_participants && (
                  <textarea
                    value={newPMReport.standout_notes}
                    onChange={(event) =>
                      onStandoutNotesChange((prev) => ({
                        ...prev,
                        standout_notes: event.target.value,
                      }))
                    }
                    rows={2}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none font-bold text-[var(--text-primary)] focus:border-emerald-500 transition-all resize-none"
                    placeholder={t("pmMisc.workspace.shortNotePlaceholder")}
                  />
                )}
              </div>
            </div>
          </div>
    </>
  );
}
