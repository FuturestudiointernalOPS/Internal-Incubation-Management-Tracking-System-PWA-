import { Rocket, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
export default function TeamTab({ project,
  members,
  allStaff,
  onRemoveMember,
  onAddCollaborator, }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      {/* Owner Section */}
      <div className="card border-l-4 border-l-[var(--brand-orange)]">
        <div className="flex items-center gap-2 mb-3">
          <Rocket className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">
            {t("adminMisc.projectDetail.projectOwner")}
          </span>
        </div>
        {project.owner_name ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-orange/[0.04] border border-brand-orange/20">
            <div className="w-10 h-10 rounded-full bg-brand-orange/20 border border-brand-orange/30 flex items-center justify-center text-xs font-black text-[var(--brand-orange)]">
              {project.owner_name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {project.owner_name}
              </p>
              <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                {t("adminMisc.projectDetail.ownerAccountable")}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[10px] font-medium text-[var(--text-secondary)]">
            {t("adminMisc.projectDetail.noOwnerAssigned")}
          </p>
        )}
      </div>

      {/* Collaborators Section */}
      <div className="card border-l-4 border-l-blue-500">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">
              {t("adminMisc.projectDetail.collaborators")}
            </span>
          </div>
          <span className="text-[10px] font-medium text-[var(--text-secondary)]">
            {t("adminMisc.projectDetail.totalCount", {
              count: members.length,
            })}
          </span>
        </div>

        {/* Collaborator list */}
        {members.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] text-center py-6">
            {t("adminMisc.projectDetail.noCollaborators")}
          </p>
        ) : (
          <div className="space-y-1.5 mb-4">
            {members.map((member) => (
              <div
                key={member.member_id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-tertiary/50 hover:bg-tertiary transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase">
                    {(member.name || member.member_id || "?").charAt(0)}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[var(--text-primary)]">
                      {member.name ||
                        member.member_id ||
                        t("adminMisc.projectDetail.unknown")}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {member.member_role && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">
                          {member.member_role}
                        </span>
                      )}
                      {member.role && (
                        <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                          {member.role}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveMember(member.member_id)}
                  className="text-[10px] font-bold uppercase text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-all"
                >
                  {t("adminMisc.projectDetail.remove")}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Collaborator */}
        <div className="pt-3 border-t border-divider/30">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
            {t("adminMisc.projectDetail.addCollaborator")}
          </p>
          <div className="flex gap-2">
            <select
              id="add-collab-team"
              className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
            >
              <option value="">{t("adminMisc.projectDetail.selectStaff")}</option>
              {allStaff
                .filter(
                  (staffMember) =>
                    staffMember.cid !== (project.owner_id || "") &&
                    !members.find(
                      (member) =>
                        String(member.member_id) === String(staffMember.cid || staffMember.id),
                    ),
                )
                .map((staffMember) => (
                  <option key={staffMember.cid || staffMember.id} value={staffMember.cid || staffMember.id}>
                    {staffMember.name} ({staffMember.role})
                  </option>
                ))}
            </select>
            <button
              onClick={onAddCollaborator}
              className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-sm font-bold uppercase tracking-wide hover:brightness-110"
            >
              {t("adminMisc.projectDetail.add")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
