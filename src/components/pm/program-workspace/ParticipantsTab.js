import { useI18n } from "@/lib/i18n";
import {
  CheckSquare,
  ChevronRight,
  Mail,
  Square,
  Target,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

export default function ParticipantsTab({
  activeSubTab,
  assignedStaff,
  canEdit,
  onActiveSubTab,
  onActiveSubTabGroups,
  onActiveSubTabStaff,
  onChangeParticipantTeam,
  onDeleteTeam,
  onDeployTeam,
  onOpenStaffModal,
  onOpenTeamDetails,
  onRemoveStaff,
  onSelectedParticipants,
  onSelectedParticipants2,
  onToggleParticipant,
  participants,
  selectedParticipants,
  teams,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-in">
      {/* SUB-TAB NAVIGATION */}
      <div className="flex gap-4 border-b border-divider/30 pb-2">
        <button
          onClick={() => onActiveSubTab("individuals")}
          className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeSubTab === "individuals" ? "border-[var(--brand-orange)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] opacity-50 hover:opacity-100"}`}
        >
          {t("pmMisc.workspace.subTabIndividuals")} (
          {
            participants.filter(
              (participant) => participant.status !== "archived",
            ).length
          }
          )
        </button>
        <button
          onClick={() => onActiveSubTabGroups("groups")}
          className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeSubTab === "groups" ? "border-[var(--brand-orange)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] opacity-50 hover:opacity-100"}`}
        >
          {t("pmMisc.workspace.subTabTeams")} ({teams.length})
        </button>
        <button
          onClick={() => onActiveSubTabStaff("staff")}
          className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeSubTab === "staff" ? "border-[var(--brand-orange)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] opacity-50 hover:opacity-100"}`}
        >
          {t("pmMisc.workspace.subTabProgramStaff")} ({assignedStaff.length})
        </button>
      </div>

      {activeSubTab === "individuals" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-tertiary p-4 rounded-xl border border-[var(--border-primary)]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.selection")}:
              </span>
              <span className="text-sm font-black text-[var(--brand-orange)]">
                {selectedParticipants.length} {t("pmMisc.workspace.selected")}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  onSelectedParticipants(
                    participants
                      .filter(
                        (participant) => participant.status !== "archived",
                      )
                      .map((participant) => participant.id),
                  )
                }
                className="text-[10px] font-bold uppercase text-blue-500 hover:underline"
              >
                {t("pmMisc.workspace.selectAll")}
              </button>
              <button
                onClick={() => onSelectedParticipants2([])}
                className="text-[10px] font-bold uppercase text-rose-500 hover:underline"
              >
                {t("pmMisc.workspace.clear")}
              </button>
              {canEdit && (
                <button
                  onClick={onDeployTeam}
                  className="btn btn-primary btn-sm py-1 px-4 gap-2"
                >
                  <Target className="w-3 h-3" />{" "}
                  {t("pmMisc.workspace.groupStudents")}
                </button>
              )}
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <div className="flex items-center justify-center">
                      <CheckSquare className="w-4 h-4 opacity-20" />
                    </div>
                  </th>
                  <th>{t("pmMisc.workspace.tableParticipant")}</th>
                  <th>{t("pmMisc.workspace.tableEmail")}</th>
                  <th>{t("pmMisc.workspace.tableGroup")}</th>
                  <th>{t("pmMisc.workspace.tableStatus")}</th>
                  <th className="text-right">
                    {t("pmMisc.workspace.tableActions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {participants
                  .filter((participant) => participant.status !== "archived")
                  .map((participant) => {
                    const isSelected = selectedParticipants.includes(
                      participant.id,
                    );
                    return (
                      <tr
                        key={participant.id}
                        className={isSelected ? "bg-orange-500/5" : ""}
                      >
                        <td className="text-center">
                          <button
                            onClick={() =>
                              onToggleParticipant(isSelected, participant)
                            }
                            className={`p-2 transition-colors ${isSelected ? "text-[var(--brand-orange)]" : "text-slate-500 opacity-20 hover:opacity-100"}`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                        <td className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-xs border border-[var(--border-primary)]">
                            {participant.name.charAt(0)}
                          </div>
                          <span className="font-bold">{participant.name}</span>
                        </td>
                        <td>{participant.email}</td>
                        <td>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase text-blue-500 tracking-widest">
                              {teams.find(
                                (team) => team.id === participant.v2_team_id,
                              )?.name || t("pmMisc.workspace.individual")}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                              {t("pmMisc.workspace.segment")}:{" "}
                              {participant.group_name ||
                                t("pmMisc.workspace.na")}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-medium">
                              {t("pmMisc.workspace.operational")}
                            </span>
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2 items-center">
                            <select
                              className="text-[10px] font-black uppercase bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1"
                              value={participant.v2_team_id || ""}
                              onChange={() =>
                                onChangeParticipantTeam(participant)
                              }
                            >
                              <option value="">
                                {t("pmMisc.workspace.teamNoTeam")}
                              </option>
                              {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name}
                                </option>
                              ))}
                            </select>
                            <button className="p-2 hover:text-[var(--brand-blue)]">
                              <Mail className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "groups" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <div
              key={team.id}
              className="card group hover:border-[var(--brand-orange)] transition-all"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)]">
                  <Target className="w-6 h-6" />
                </div>
                {canEdit && (
                  <button
                    onClick={() => onDeleteTeam(team.id)}
                    className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="mb-4">
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  {team.name}
                </h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mt-0.5">
                  {t("pmMisc.workspace.group")}:{" "}
                  {team.group_name || t("pmMisc.workspace.na")}
                </p>
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex -space-x-2">
                  {participants
                    .filter((participant) => participant.v2_team_id === team.id)
                    .slice(0, 3)
                    .map((participant) => (
                      <div
                        key={participant.id}
                        className="w-6 h-6 rounded-full bg-tertiary border-2 border-[var(--bg-secondary)] flex items-center justify-center text-[10px] font-bold uppercase"
                      >
                        {participant.name.charAt(0)}
                      </div>
                    ))}
                </div>
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                  {
                    participants.filter(
                      (participant) => participant.v2_team_id === team.id,
                    ).length
                  }{" "}
                  {t("pmMisc.workspace.members")}
                </span>
              </div>
              <div className="space-y-1 mb-6">
                <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                  {t("pmMisc.workspace.assignedStaffLabel")}
                </p>
                <p className="text-xs text-[var(--text-primary)] font-black uppercase tracking-tight">
                  {team.handler_name || t("pmMisc.workspace.unassigned")}
                </p>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-[var(--border-primary)]">
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                  {team.is_venture_ready
                    ? t("pmMisc.workspace.ventureReady")
                    : t("pmMisc.workspace.inProgram")}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onOpenTeamDetails(team)}
                    className="btn btn-secondary btn-sm"
                  >
                    <ChevronRight className="w-3 h-3" />{" "}
                    {t("pmMisc.workspace.view")}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {teams.length === 0 && (
            <div className="card border-dashed flex flex-col items-center justify-center gap-3 opacity-40 min-h-[160px] col-span-full py-8 text-center">
              <Target className="w-8 h-8 text-[var(--text-secondary)]" />
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.noGroupsFound")}
                <br />
                {t("pmMisc.workspace.noGroupsFoundHint")}
              </span>
            </div>
          )}
        </div>
      )}

      {activeSubTab === "staff" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter">
                {t("pmMisc.workspace.subTabProgramStaff")}
              </h3>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                {t("pmMisc.workspace.programStaffDesc")}
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => onOpenStaffModal()}
                className="btn btn-primary btn-sm px-4 gap-2"
              >
                <UserPlus className="w-3 h-3" />{" "}
                {t("pmMisc.workspace.assignPersonnel")}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {assignedStaff.map((staff) => (
              <div
                key={staff.cid}
                className="card flex items-center justify-between p-4 hover:border-[var(--brand-orange)] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-orange/10 text-[var(--brand-orange)] flex items-center justify-center text-xs font-black uppercase border border-brand-orange/20">
                    {staff.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-tight">
                      {staff.name}
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">
                      {staff.role}
                    </p>
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => onRemoveStaff(staff.cid)}
                    className="text-rose-500 hover:scale-110 transition-transform"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {assignedStaff.length === 0 && (
              <div className="card border-dashed flex flex-col items-center justify-center gap-3 opacity-40 min-h-[120px] col-span-full py-8 text-center">
                <Users className="w-8 h-8 text-[var(--text-secondary)]" />
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.noStaffAssigned")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
