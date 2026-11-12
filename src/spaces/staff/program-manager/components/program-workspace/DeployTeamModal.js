import { useI18n } from "@/lib/i18n";
import { UserPlus, X } from "lucide-react";

export default function DeployTeamModal({
  emailInput,
  isSaving,
  newTeam,
  onAddEmailsToSelection,
  onChangeNewTeamStaff,
  onCloseTeamModal,
  onDeployTeam,
  onEmailInputChange,
  onLeaderIdChange,
  onNewTeamChange,
  onSelectedExistingTeamIdChange,
  onTeamAssignmentMode,
  onTeamAssignmentModeExisting,
  oversightCandidates,
  participants,
  selectedExistingTeamId,
  selectedParticipants,
  teamAssignmentMode,
  teams,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
      onClick={() => onCloseTeamModal()}
    >
      <div
        className="card w-full max-w-sm space-y-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h3
              className="text-base font-black uppercase tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {t("pmMisc.workspace.teamModalTitle")}
            </h3>
            <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
              {t("pmMisc.workspace.teamModalDesc")}
            </p>
          </div>
          <button onClick={() => onCloseTeamModal()}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex bg-primary p-1 rounded-xl border border-[var(--border-primary)]">
            <button
              onClick={() => onTeamAssignmentMode("new")}
              className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${teamAssignmentMode === "new" ? "bg-[var(--brand-orange)] text-black shadow-lg shadow-orange-500/20" : "text-[var(--text-secondary)] opacity-50"}`}
            >
              {t("pmMisc.workspace.createNew")}
            </button>
            <button
              onClick={() => onTeamAssignmentModeExisting("existing")}
              className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${teamAssignmentMode === "existing" ? "bg-[var(--brand-orange)] text-black shadow-lg shadow-orange-500/20" : "text-[var(--text-secondary)] opacity-50"}`}
            >
              {t("pmMisc.workspace.addToExisting")}
            </button>
          </div>

          {teamAssignmentMode === "new" ? (
            <div className="space-y-1">
              <label
                className="text-[10px] font-black uppercase tracking-widest"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("pmMisc.workspace.teamInternalName")}
              </label>
              <input
                value={newTeam.name}
                onChange={(event) =>
                  onNewTeamChange((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
                placeholder={t("pmMisc.workspace.teamNamePlaceholder")}
              />
              <p className="text-[8px] font-bold text-[var(--brand-orange)] uppercase mt-1">
                {t("pmMisc.workspace.teamNoteAutoLink")}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <label
                className="text-[10px] font-black uppercase tracking-widest"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("pmMisc.workspace.selectTargetGroup")}
              </label>
              <select
                value={selectedExistingTeamId}
                onChange={(event) =>
                  onSelectedExistingTeamIdChange(event.target.value)
                }
                className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">
                  {t("pmMisc.workspace.selectExistingTeam")}
                </option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name.toUpperCase()} ({t("pmMisc.workspace.group")}:{" "}
                    {team.group_name})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("pmMisc.workspace.addByEmailLabel")}
            </label>
            <textarea
              value={emailInput}
              onChange={(event) => onEmailInputChange(event.target.value)}
              rows={3}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold resize-none"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
              placeholder={t("pmMisc.workspace.emailListPlaceholder")}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase opacity-60">
                {t("pmMisc.workspace.selection")} {selectedParticipants.length}{" "}
                {t("pmMisc.workspace.selected")}
              </p>
              <button
                onClick={onAddEmailsToSelection}
                disabled={!emailInput.trim()}
                className="btn btn-primary btn-sm"
              >
                <UserPlus className="w-3 h-3" />{" "}
                {t("pmMisc.workspace.addEmailsButton")}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("pmMisc.workspace.assignGroupLead")}
            </label>
            <select
              value={newTeam.leader_id}
              onChange={(event) =>
                onLeaderIdChange((prev) => ({
                  ...prev,
                  leader_id: event.target.value,
                }))
              }
              className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">{t("pmMisc.workspace.selectLead")}</option>
              {participants
                .filter((participant) =>
                  newTeam.member_ids.includes(participant.id),
                )
                .map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("pmMisc.workspace.assignOversight")}
            </label>
            <select
              value={newTeam.staff_id}
              onChange={onChangeNewTeamStaff}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">
                {t("pmMisc.workspace.noStaffAssignedOptional")}
              </option>
              {oversightCandidates.map((member) => (
                <option
                  key={member.cid ?? member.email ?? member.id}
                  value={member.cid}
                >
                  {/* Backward compatibility for legacy rows: an assignment
                      saved before the teacher persona was retired may still
                      carry that stored role, so label it as an instructor on
                      purpose instead of falling through to the raw value. */}
                  {member.name} (
                  {member.role === "teacher"
                    ? t("pmMisc.workspace.instructor")
                    : member.role}
                  )
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onCloseTeamModal()}
            className="flex-1 btn btn-secondary"
          >
            {t("pmMisc.workspace.cancel")}
          </button>
          <button
            onClick={onDeployTeam}
            disabled={
              isSaving ||
              (teamAssignmentMode === "new" && !newTeam.name.trim()) ||
              (teamAssignmentMode === "existing" && !selectedExistingTeamId)
            }
            className="flex-1 btn btn-primary"
          >
            {isSaving
              ? t("pmMisc.workspace.initializing")
              : t("pmMisc.workspace.initializeGroup")}
          </button>
        </div>
      </div>
    </div>
  );
}
