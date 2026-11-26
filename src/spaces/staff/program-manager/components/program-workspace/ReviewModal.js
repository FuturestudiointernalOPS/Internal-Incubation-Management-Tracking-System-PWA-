import { useI18n } from "@/lib/i18n";
import { Calendar, ExternalLink, X } from "lucide-react";

export default function ReviewModal({
  followupDate,
  followupDuration,
  followupMeetingLink,
  followupNotes,
  followupTime,
  isSaving,
  onCloseReviewModal,
  onFollowupDateChange,
  onFollowupDurationChange,
  onFollowupMeetingLinkChange,
  onFollowupNotesChange,
  onFollowupTimeChange,
  onOpenFollowupFields,
  onRejectSubmission,
  onRequestRevision,
  onResetFollowupFields,
  onReviewFeedbackChange,
  onReviewScoreChange,
  onReviewSubmission,
  onScheduleFollowup,
  reviewFeedback,
  reviewScore,
  selectedSubmission,
  showFollowupFields,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
      onClick={() => onCloseReviewModal()}
    >
      <div
        className="card w-full max-w-md max-h-[85vh] overflow-y-auto space-y-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3
            className="text-base font-black uppercase tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {t("pmMisc.workspace.gradeSubmission")}
          </h3>
          <button onClick={() => onCloseReviewModal()}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-tertiary border border-[var(--border-primary)] rounded-xl space-y-2">
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
            {t("pmMisc.workspace.tableParticipant")}
          </p>
          <p className="text-sm font-black text-[var(--text-primary)]">
            {selectedSubmission?.participant_name ||
              t("pmMisc.workspace.groupSubmission")}
          </p>
          <a
            href={
              selectedSubmission?.file_url ||
              selectedSubmission?.submission_url ||
              selectedSubmission?.submission_link ||
              "#"
            }
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-bold text-indigo-400 uppercase flex items-center gap-1 mt-2 hover:text-white transition-colors"
          >
            <ExternalLink className="w-3 h-3" />{" "}
            {t("pmMisc.workspace.viewSourceMaterial")}
          </a>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("pmMisc.workspace.numericalGrade")}
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={reviewScore}
              onChange={(event) => onReviewScoreChange(event.target.value)}
              className="w-full rounded-lg px-4 py-3 text-2xl outline-none font-black text-center text-[var(--brand-orange)]"
              style={{
                background: "var(--bg-primary)",
                border: "2px solid var(--border-primary)",
              }}
              placeholder={t("pmMisc.workspace.gradeScorePlaceholder")}
            />
            <p className="text-[10px] font-bold text-slate-500 text-center uppercase mt-2">
              {t("pmMisc.workspace.scoreSyncNote")}
            </p>
          </div>
          <div className="space-y-1">
            <label
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              Feedback / Notes
            </label>
            <textarea
              value={reviewFeedback}
              onChange={(event) => onReviewFeedbackChange(event.target.value)}
              rows={2}
              placeholder="Optional feedback or rejection reason"
              className="w-full rounded-lg px-3 py-2 text-xs font-bold outline-none"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>
        {!showFollowupFields ? (
          <>
            <button
              onClick={() => onOpenFollowupFields()}
              className="w-full py-2.5 rounded-xl border border-dashed border-indigo-400/40 text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:bg-indigo-400/10 transition-all flex items-center justify-center gap-2"
            >
              <Calendar className="w-3.5 h-3.5" />{" "}
              {t("pmMisc.workspace.scheduleFollowup")}
            </button>
            <div className="space-y-2 pt-2">
              <button
                onClick={onReviewSubmission}
                disabled={isSaving || reviewScore === ""}
                className="w-full btn btn-primary"
              >
                {isSaving
                  ? t("pmMisc.workspace.grading")
                  : t("pmMisc.workspace.approveAndGrade")}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => onCloseReviewModal()}
                  className="flex-1 btn btn-secondary"
                >
                  {t("pmMisc.workspace.cancel")}
                </button>
                <button
                  onClick={onRequestRevision}
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-all"
                >
                  Request revision
                </button>
                <button
                  onClick={onRejectSubmission}
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-all"
                >
                  Reject
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4 pt-2 border-t border-[var(--border-primary)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
              <Calendar className="w-3 h-3 inline mr-1" />{" "}
              {t("pmMisc.workspace.scheduleFollowupMeeting")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.dateRequired")}
                </label>
                <input
                  type="date"
                  value={followupDate}
                  onChange={(event) => onFollowupDateChange(event.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-xs outline-none font-bold"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.timeRequired")}
                </label>
                <input
                  type="time"
                  value={followupTime}
                  onChange={(event) => onFollowupTimeChange(event.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-xs outline-none font-bold"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.durationMinutes")}
              </label>
              <select
                value={followupDuration}
                onChange={(event) =>
                  onFollowupDurationChange(event.target.value)
                }
                className="w-full rounded-lg px-3 py-2.5 text-xs outline-none font-bold"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.meetingLinkOptional")}
              </label>
              <input
                type="url"
                value={followupMeetingLink}
                onChange={(event) =>
                  onFollowupMeetingLinkChange(event.target.value)
                }
                placeholder="https://meet.google.com/..."
                className="w-full rounded-lg px-3 py-2.5 text-xs outline-none font-bold"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.notesOptional")}
              </label>
              <textarea
                value={followupNotes}
                onChange={(event) => onFollowupNotesChange(event.target.value)}
                placeholder={t("pmMisc.workspace.followupNotesPlaceholder")}
                rows={2}
                className="w-full rounded-lg px-3 py-2.5 text-xs outline-none font-bold resize-none"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={onResetFollowupFields}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                {t("pmMisc.workspace.back")}
              </button>
              <button
                onClick={onScheduleFollowup}
                disabled={isSaving || !followupDate || !followupTime}
                className="flex-1 py-2.5 bg-indigo-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  t("pmMisc.workspace.scheduling")
                ) : (
                  <>
                    <Calendar className="w-3 h-3" />{" "}
                    {t("pmMisc.workspace.confirmFollowup")}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
