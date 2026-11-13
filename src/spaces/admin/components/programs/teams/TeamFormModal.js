"use client";

import { AlertTriangle, Check, Loader2, Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Create/edit team modal for the program-teams screen. */
export default function TeamFormModal({
  editingTeam,
  closeModal,
  handleSave,
  saving,
  formError,
  teamName,
  setTeamName,
  handlerId,
  setHandlerId,
  staff,
  memberSearch,
  setMemberSearch,
  selectedMembers,
  filteredParticipants,
  participants,
  toggleMember,
}) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeModal}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-lg bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
            {editingTeam
              ? t("admin.teams.editTeam")
              : t("admin.teams.createTeam")}
          </h3>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-[var(--text-secondary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {formError}
            </div>
          )}

          {/* Team Name */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] pl-1">
              {t("admin.teams.teamName")}
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder={t("admin.teams.teamNamePlaceholder")}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60 transition-colors"
              autoFocus
            />
          </div>

          {/* Handler */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] pl-1">
              {t("admin.teams.handler")}
            </label>
            <select
              value={handlerId}
              onChange={(event) => setHandlerId(event.target.value)}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60 transition-colors appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                paddingRight: "2.5rem",
              }}
            >
              <option value="">
                {t("admin.teams.handlerPlaceholder")}
              </option>
              {staff.map((staffMember) => (
                <option key={staffMember.cid || staffMember.id} value={staffMember.cid || staffMember.id}>
                  {staffMember.name || staffMember.email || staffMember.cid} ({staffMember.role || "staff"})
                </option>
              ))}
            </select>
          </div>

          {/* Members */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] pl-1">
              {t("admin.teams.members")}{" "}
              <span className="text-[var(--text-tertiary)]">
                {t("adminMisc.programTeams.membersSelected", {
                  count: selectedMembers.length,
                })}
              </span>
            </label>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder={t("admin.teams.selectMembers")}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60 transition-colors"
              />
            </div>

            {/* Participant list */}
            <div className="max-h-48 overflow-y-auto border border-[var(--border-primary)] rounded-xl bg-primary divide-y divide-[var(--border-primary)]">
              {filteredParticipants.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-[10px] text-[var(--text-tertiary)] font-bold">
                    {participants.length === 0
                      ? t("adminMisc.programTeams.noParticipants")
                      : t("adminMisc.programTeams.noMatchingParticipants")}
                  </p>
                </div>
              ) : (
                filteredParticipants.map((participant) => {
                  const participantId = participant.id?.toString() || participant.cid;
                  const isSelected = selectedMembers.includes(participantId);
                  return (
                    <button
                      key={participantId}
                      type="button"
                      onClick={() => toggleMember(participantId)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary ${
                        isSelected ? "bg-brand-orange/5" : ""
                      }`}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {participant.name || t("adminMisc.programTeams.unnamed")}
                        </span>
                        <span className="text-[10px] font-medium text-[var(--text-tertiary)] truncate">
                          {participant.email || ""}
                        </span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ml-3 transition-all ${
                          isSelected
                            ? "bg-[var(--brand-orange)] border-[var(--brand-orange)]"
                            : "border-[var(--border-primary)]"
                        }`}
                      >
                        {isSelected && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-5 py-2.5 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest rounded-xl hover:bg-secondary transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving || !teamName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingTeam ? t("common.update") : t("common.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
