import { useI18n } from "@/lib/i18n";
import { X } from "lucide-react";

export default function PmReportModal({
  isSaving,
  kpis,
  newPMReport,
  onAdditionalIssueNoteChange,
  onAssignmentGivenSet,
  onAssignmentGivenUnset,
  onAssignmentKpiIds,
  onAssignmentObjectiveChange,
  onAssignmentOutcomeChange,
  onAttendanceLevel,
  onClosePMReportModal,
  onDeliveryChallengeNoteChange,
  onDeliveryChallenges,
  onDeliveryQuality,
  onHadIssues,
  onIssueTypes,
  onNewPMReport,
  onNewPMReportChange,
  onParticipantUnderstanding,
  onParticipantsAttentionNotesChange,
  onParticipantsNeedAttention,
  onParticipationLevel,
  onPlannedAdjustmentsChange,
  onPmReportAttachments,
  onPmReportAttachmentsChange,
  onPmReportAttachmentsFile,
  onProgramOnTrackSet,
  onProgramOnTrackUnset,
  onReportAttachmentUploadChange,
  onRequiresAdminAttention,
  onResetPmReportAttachments,
  onStandoutNotesChange,
  onStandoutParticipants,
  onStatusChange,
  onSubmitPMReport,
  onSummaryChange,
  onWeekRating,
  pmReportAttachments,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
      onClick={() => onClosePMReportModal()}
    >
      <div
        className="card w-full max-w-lg space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center sticky top-0 bg-secondary z-10 pb-4 border-b border-[var(--border-primary)]">
          <h3
            className="text-base font-black uppercase tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {t("pmMisc.workspace.reportWeeklyReport")}
          </h3>
          <button onClick={() => onClosePMReportModal()}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-8">
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

          {/* ────────── SECTION 4: ISSUES & SUPPORT ────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-rose-500/20">
              <div className="w-5 h-5 rounded-full bg-rose-500/10 flex items-center justify-center text-[10px] font-bold text-rose-500 border border-rose-500/20">
                4
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500">
                {t("pmMisc.workspace.issuesAndSupport")}
              </span>
            </div>

            <div className="space-y-3">
              {/* Had Issues — Toggle */}
              <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("pmMisc.workspace.wereThereIssues")}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      onHadIssues((prev) => ({
                        ...prev,
                        had_issues: !prev.had_issues,
                      }))
                    }
                    className={`w-10 h-5 rounded-full transition-all relative ${
                      newPMReport.had_issues ? "bg-rose-500" : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${
                        newPMReport.had_issues ? "left-5" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                {newPMReport.had_issues && (
                  <div className="mt-3 space-y-3">
                    {/* Issue Types — Multi-select chips */}
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 mb-1.5 block">
                        {t("pmMisc.workspace.issueTypes")}
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          "technical",
                          "attendance",
                          "participation",
                          "curriculum",
                          "behavioral",
                          "other",
                        ].map((type) => {
                          const isSelected =
                            newPMReport.issue_types.includes(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() =>
                                onIssueTypes((prev) => ({
                                  ...prev,
                                  issue_types: isSelected
                                    ? prev.issue_types.filter(
                                        (issueType) => issueType !== type,
                                      )
                                    : [...prev.issue_types, type],
                                }))
                              }
                              className={`px-3 py-1.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${
                                isSelected
                                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                                  : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                              }`}
                            >
                              {{
                                technical: t("pmMisc.workspace.issueTechnical"),
                                attendance: t(
                                  "pmMisc.workspace.issueAttendance",
                                ),
                                participation: t(
                                  "pmMisc.workspace.issueParticipation",
                                ),
                                curriculum: t(
                                  "pmMisc.workspace.issueCurriculum",
                                ),
                                behavioral: t(
                                  "pmMisc.workspace.issueBehavioral",
                                ),
                                other: t("pmMisc.workspace.issueOther"),
                              }[type] || type}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Requires Super Admin Attention — Toggle */}
                    <div className="flex items-center justify-between">
                      <label className="text-[8px] font-black uppercase tracking-widest text-amber-500">
                        {t("pmMisc.workspace.requiresSuperAdmin")}
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          onRequiresAdminAttention((prev) => ({
                            ...prev,
                            requires_admin_attention:
                              !prev.requires_admin_attention,
                          }))
                        }
                        className={`w-10 h-5 rounded-full transition-all relative ${
                          newPMReport.requires_admin_attention
                            ? "bg-amber-500"
                            : "bg-white/10"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${
                            newPMReport.requires_admin_attention
                              ? "left-5"
                              : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Additional Note */}
                    <textarea
                      value={newPMReport.additional_issue_note}
                      onChange={(event) =>
                        onAdditionalIssueNoteChange((prev) => ({
                          ...prev,
                          additional_issue_note: event.target.value,
                        }))
                      }
                      rows={2}
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none font-bold text-[var(--text-primary)] focus:border-rose-500 transition-all resize-none"
                      placeholder={t(
                        "pmMisc.workspace.additionalNotePlaceholder",
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

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

          {/* ────────── NOTES (free text for PM) ────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-500/20">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {t("pmMisc.workspace.strategicHealthNotes")}
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.strategicHealth")}
              </label>
              <select
                value={newPMReport.status}
                onChange={(event) =>
                  onStatusChange((prev) => ({
                    ...prev,
                    status: event.target.value,
                  }))
                }
                className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="optimal">
                  {t("pmMisc.workspace.healthOptimal")}
                </option>
                <option value="stable">
                  {t("pmMisc.workspace.healthStable")}
                </option>
                <option value="at_risk">
                  {t("pmMisc.workspace.healthAtRisk")}
                </option>
                <option value="critical">
                  {t("pmMisc.workspace.healthCritical")}
                </option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.additionalNotes")}
              </label>
              <textarea
                value={newPMReport.summary}
                onChange={(event) =>
                  onSummaryChange((prev) => ({
                    ...prev,
                    summary: event.target.value,
                  }))
                }
                rows={3}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-[var(--brand-orange)] transition-all resize-none"
                placeholder={t("pmMisc.workspace.additionalNotesPlaceholder")}
              />
            </div>

            {/* Attachment: URL link or PDF upload */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.reportAttachment")}
              </label>
              <div className="flex gap-2 flex-wrap items-center">
                <button
                  type="button"
                  onClick={() =>
                    onPmReportAttachments((prev) => ({
                      type: "link",
                      url: prev.type === "link" ? prev.url : "",
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                    pmReportAttachments.type === "link"
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                      : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                  }`}
                >
                  {t("pmMisc.workspace.attachmentLink")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onPmReportAttachmentsFile((prev) => ({
                      type: "file",
                      url: prev.type === "file" ? prev.url : "",
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                    pmReportAttachments.type === "file"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                      : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                  }`}
                >
                  {t("pmMisc.workspace.attachmentPdf")}
                </button>
                {pmReportAttachments.url && (
                  <button
                    type="button"
                    onClick={() =>
                      onResetPmReportAttachments({ type: "", url: "" })
                    }
                    className="ml-auto flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all text-[10px] font-bold uppercase tracking-widest"
                  >
                    <X className="w-3 h-3" />{" "}
                    {t("pmMisc.workspace.attachmentRemove")}
                  </button>
                )}
              </div>

              {pmReportAttachments.type === "link" && (
                <input
                  type="url"
                  value={pmReportAttachments.url}
                  onChange={(event) =>
                    onPmReportAttachmentsChange((prev) => ({
                      ...prev,
                      url: event.target.value,
                    }))
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-[var(--brand-orange)] transition-all"
                  placeholder={t("pmMisc.workspace.attachmentUrlPlaceholder")}
                />
              )}

              {pmReportAttachments.type === "file" && (
                <div className="flex items-center gap-3">
                  <label className="btn btn-secondary btn-sm cursor-pointer">
                    {isSaving && !pmReportAttachments.url
                      ? t("pmMisc.workspace.attachmentUploading")
                      : t("pmMisc.workspace.attachmentChoosePdf")}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={onReportAttachmentUploadChange}
                      disabled={isSaving}
                    />
                  </label>
                  {pmReportAttachments.url && (
                    <a
                      href={pmReportAttachments.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest truncate max-w-[220px] hover:underline"
                    >
                      {t("pmMisc.workspace.attachmentUploaded")}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 sticky bottom-0 bg-secondary pt-4 border-t border-[var(--border-primary)]">
          <button
            onClick={() => onClosePMReportModal()}
            className="flex-1 btn btn-secondary"
          >
            {t("pmMisc.workspace.cancel")}
          </button>
          <button
            onClick={onSubmitPMReport}
            disabled={isSaving}
            className="flex-1 btn btn-primary"
          >
            {isSaving
              ? t("pmMisc.workspace.submitting")
              : t("pmMisc.workspace.submitReport")}
          </button>
        </div>
      </div>
    </div>
  );
}
