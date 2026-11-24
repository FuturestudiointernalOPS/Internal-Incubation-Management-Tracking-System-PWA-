import { useI18n } from "@/lib/i18n";
import {
  Check,
  FileText,
  Pencil,
  RefreshCw,
  Target,
  UserMinus,
  Users,
  X,
} from "lucide-react";

export default function TeamDetailsModal({
  canEdit,
  editingScoreFor,
  facilitatorDraftId,
  isSaving,
  onActivePDF,
  onCancelFacilitatorSelect,
  onCancelScoreEdit,
  onChangeTeamHandler,
  onCloseTeamDetails,
  onCloseTeamDetails2,
  onCloseTeamDetails3,
  onConfirmTarget,
  onEditParticipantScore,
  onFacilitatorDraftIdChange,
  onOpenFacilitatorSelect,
  onParticipantScoreKeyDown,
  onScoreDraftChange,
  onUpdateParticipantScores,
  oversightCandidates,
  participants,
  removeParticipantFromTeam,
  scoreDraft,
  selectedTeam,
  showFacilitatorSelect,
  submissions,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onCloseTeamDetails}
    >
      <div
        className="card w-full max-w-5xl max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl border-indigo-500/30"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-8 border-b border-[var(--border-primary)] bg-gradient-to-r from-[var(--bg-secondary)] to-[var(--bg-tertiary)] flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tight text-[var(--text-primary)] flex items-center gap-3">
              <Target className="w-6 h-6 text-[var(--brand-orange)]" />
              {selectedTeam.name} — {t("pmMisc.workspace.teamReview")}
            </h3>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mt-1">
              {t("pmMisc.workspace.teamReviewSubtitle")}
            </p>
          </div>
          <button
            onClick={onCloseTeamDetails2}
            className="p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {/* Facilitator management — PM can reassign the team's handler */}
          <div className="bg-primary/50 border border-[var(--border-primary)] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 mb-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.assignedStaffLabel")}
              </p>
              <p className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                {selectedTeam.handler_name || t("pmMisc.workspace.unassigned")}
              </p>
            </div>
            {canEdit &&
              (showFacilitatorSelect ? (
                <div className="flex items-center gap-2">
                  <select
                    value={facilitatorDraftId}
                    onChange={(event) =>
                      onFacilitatorDraftIdChange(event.target.value)
                    }
                    className="rounded-lg px-3 py-2 text-xs font-bold outline-none"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="">{t("pmMisc.workspace.unassigned")}</option>
                    {oversightCandidates.map((member) => (
                      <option
                        key={member.cid ?? member.email ?? member.id}
                        value={member.cid}
                      >
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      onChangeTeamHandler(selectedTeam.id, facilitatorDraftId)
                    }
                    disabled={isSaving}
                    className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
                    title={t("pmMisc.workspace.saveMarks")}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={onCancelFacilitatorSelect}
                    className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all"
                    title={t("pmMisc.workspace.cancel")}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenFacilitatorSelect}
                  className="btn btn-secondary btn-sm"
                >
                  <RefreshCw className="w-3 h-3" />{" "}
                  {t("pmMisc.workspace.changeFacilitator")}
                </button>
              ))}
          </div>

          <div className="grid grid-cols-1 gap-8">
            {/* Participant Table */}
            <div className="table-container !border-none !shadow-none">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("pmMisc.workspace.teamMember")}</th>
                    <th>{t("pmMisc.workspace.submissions")}</th>
                    <th className="w-48 text-center">
                      {t("pmMisc.workspace.marksAwarded")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {participants
                    .filter(
                      (participant) =>
                        participant.v2_team_id === selectedTeam.id,
                    )
                    .map((participant) => {
                      const participantId = String(
                        participant.cid || participant.id,
                      );
                      // Match submissions made by the participant directly
                      // OR by their team (team-level submissions carry team_id).
                      const participantSubmissions = submissions.filter(
                        (submission) =>
                          String(submission.participant_id) === participantId ||
                          (selectedTeam.id &&
                            String(submission.team_id) ===
                              String(selectedTeam.id)),
                      );
                      const scoredSubmissions = participantSubmissions.filter(
                        (submission) =>
                          (submission.score ??
                            submission.evaluation_score ??
                            null) != null,
                      );
                      const avgScore =
                        scoredSubmissions.length > 0
                          ? Math.round(
                              scoredSubmissions.reduce(
                                (acc, submission) =>
                                  acc +
                                  (submission.score ??
                                    submission.evaluation_score ??
                                    0),
                                0,
                              ) / scoredSubmissions.length,
                            )
                          : 0;
                      const isEditing = editingScoreFor === participantId;

                      return (
                        <tr
                          key={participant.id}
                          className="hover:bg-indigo-500/5 transition-colors"
                        >
                          <td className="py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black text-sm border border-indigo-500/20">
                                {participant.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                                  {participant.name}
                                </p>
                                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase opacity-60">
                                  {participant.email}
                                </p>
                              </div>
                              {canEdit && (
                                <button
                                  onClick={() =>
                                    onConfirmTarget({
                                      id: participant.id,
                                      message: t(
                                        "pmMisc.workspace.confirmRemoveMember",
                                        { name: participant.name },
                                      ),
                                      onConfirm: () =>
                                        removeParticipantFromTeam(
                                          participant.id,
                                        ),
                                    })
                                  }
                                  className="ml-auto p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all"
                                  title={t("pmMisc.workspace.removeFromGroup")}
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              {participantSubmissions.map((submission) => (
                                <div
                                  key={submission.id}
                                  className="group relative"
                                >
                                  <button
                                    onClick={() =>
                                      onActivePDF({
                                        url:
                                          submission.file_url ||
                                          submission.submission_url ||
                                          submission.submission_link ||
                                          "#",
                                        name:
                                          submission.deliverable_title ||
                                          `Submission_${submission.id}`,
                                      })
                                    }
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-tertiary rounded-lg border border-[var(--border-primary)] hover:border-emerald-500/50 transition-all"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                      {submission.deliverable_title ||
                                        t("pmMisc.workspace.artifact")}
                                    </span>
                                    <span className="text-[10px] font-black text-emerald-500">
                                      [
                                      {submission.score ??
                                        submission.evaluation_score ??
                                        "—"}
                                      ]
                                    </span>
                                  </button>
                                </div>
                              ))}
                              {participantSubmissions.length === 0 && (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500/40">
                                  {t("pmMisc.workspace.noSubmissionsFound")}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="inline-flex flex-col items-center gap-2">
                              <div
                                className={`text-2xl font-black ${avgScore >= 70 ? "text-emerald-500" : avgScore >= 40 ? "text-amber-500" : "text-rose-500"}`}
                              >
                                {avgScore}%
                              </div>
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={scoreDraft}
                                    onChange={(event) =>
                                      onScoreDraftChange(event.target.value)
                                    }
                                    onKeyDown={() =>
                                      onParticipantScoreKeyDown(participantId)
                                    }
                                    className="w-20 bg-tertiary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[11px] font-black text-center outline-none focus:border-indigo-500"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() =>
                                      onUpdateParticipantScores(
                                        participantId,
                                        scoreDraft,
                                      )
                                    }
                                    disabled={isSaving}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
                                    title={t("pmMisc.workspace.saveMarks")}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={onCancelScoreEdit}
                                    className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all"
                                    title={t("pmMisc.workspace.cancel")}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    onEditParticipantScore(
                                      participantId,
                                      avgScore,
                                    )
                                  }
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-tertiary border border-[var(--border-primary)] rounded-lg hover:border-indigo-500/50 transition-all"
                                >
                                  <Pencil className="w-3 h-3 text-indigo-400" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                    {t("pmMisc.workspace.editMarks")}
                                  </span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {participants.filter(
              (participant) => participant.v2_team_id === selectedTeam.id,
            ).length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-primary)] rounded-3xl opacity-30">
                <Users className="w-12 h-12 mb-4" />
                <p className="text-sm font-black uppercase tracking-[0.3em]">
                  {t("pmMisc.workspace.noMembersInTeam")}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-tertiary border-t border-[var(--border-primary)] flex justify-end gap-3">
          <button
            onClick={onCloseTeamDetails3}
            className="btn btn-secondary px-8"
          >
            {t("pmMisc.workspace.closeAudit")}
          </button>
        </div>
      </div>
    </div>
  );
}
