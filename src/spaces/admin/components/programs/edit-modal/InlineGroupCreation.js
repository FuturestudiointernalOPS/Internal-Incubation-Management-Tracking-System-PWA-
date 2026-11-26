"use client";

import { useI18n } from "@/lib/i18n";

/** Inline "create a new group" form shown inside the target groups section. */
export default function InlineGroupCreation({
  newGroup,
  setNewGroup,
  onCreateGroupInline,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-3 p-4 bg-primary border border-blue-500/20 rounded-xl animate-in fade-in mt-2">
      <input
        value={newGroup.name}
        onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
        placeholder={t("adminMisc.programs.groupNamePlaceholder")}
        className="w-full bg-transparent border-b border-[var(--border-primary)] py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-blue-400"
      />
      <textarea
        value={newGroup.description}
        onChange={(e) =>
          setNewGroup({ ...newGroup, description: e.target.value })
        }
        placeholder={t("adminMisc.programs.groupDescriptionPlaceholder")}
        rows={2}
        className="w-full bg-transparent border border-[var(--border-primary)] p-2 rounded text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-blue-400 resize-none"
      />
      <select
        value={newGroup.default_role || ""}
        onChange={(e) =>
          setNewGroup({ ...newGroup, default_role: e.target.value })
        }
        className="w-full bg-transparent border border-[var(--border-primary)] p-2 rounded text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-blue-400"
      >
        <option value="">
          {t("adminMisc.programs.defaultRoleOptional")}
        </option>
        <option value="participant">
          {t("adminMisc.programs.roleParticipant")}
        </option>
        <option value="staff">{t("adminMisc.programs.roleStaff")}</option>
        <option value="program_manager">
          {t("adminMisc.programs.roleProgramManager")}
        </option>
        <option value="mentor">{t("adminMisc.programs.roleMentor")}</option>
        <option value="investor">{t("adminMisc.programs.roleInvestor")}</option>
        <option value="founder">{t("adminMisc.programs.roleFounder")}</option>
      </select>
      <button
        type="button"
        onClick={onCreateGroupInline}
        className="w-full py-2.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-all"
      >
        {t?.("common.create") || "Create & Assign Group"}
      </button>
    </div>
  );
}
