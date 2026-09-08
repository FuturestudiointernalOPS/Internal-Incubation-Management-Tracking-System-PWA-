"use client";

import { UserPlus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";
import { FOUNDER_ROLES, TEAM_ROLES, getFounderMembers, getTeamMembers } from "../ventureMeta";

/* Add Member Modal — one flow; the chosen role decides founder vs team_member */
function AddMemberModal() {
  const { t } = useI18n();
  const { showAddMember, setShowAddMember, addMemberType, setAddMemberType, searchQuery, setSearchQuery, searchResults, searching, searchContacts, handleAddMember, inputStyle } = useVenture();
  if (!showAddMember) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgb(0 0 0 / 0.6)" }} onClick={() => setShowAddMember(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: "#0f172a", borderColor: "rgb(255 255 255 / 0.1)", color: "var(--text-primary)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{t("venture.addTeamMember")}</h2>
          <button onClick={() => setShowAddMember(false)} style={{ color: "var(--text-secondary)" }}><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.memberRoleInVenture") || "Role in Venture"}</label>
            <select
              value={addMemberType}
              onChange={e => setAddMemberType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg outline-none border mb-1"
              style={inputStyle}
            >
              <option value="founder">{t("venture.addAsFounder") || "Founder"}</option>
              <option value="team_member">{t("venture.teamMembers") || "Team Member"}</option>
            </select>
            <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
              {addMemberType === "founder"
                ? (t("venture.founderRoleHint") || "Founders are clearly identified in the Team and carry founder permissions.")
                : (t("venture.memberRoleHint") || "Team members support the Venture with their assigned role.")}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.searchContacts")}</label>
            <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); searchContacts(e.target.value); }}
              className="w-full px-3 py-2 rounded-lg outline-none border mb-2" style={inputStyle} placeholder={t("venture.searchContacts")} />
          </div>
          {searching && <p className="text-sm py-1" style={{ color: "var(--text-secondary)" }}>Searching...</p>}
          <div className="max-h-48 overflow-y-auto space-y-1">
            {searchResults.map(c => (
              <button key={c.cid} onClick={() => handleAddMember(c.cid)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/10">
                <span className="font-medium">{c.name || c.cid}</span>
                {c.email && <span className="ml-2" style={{ color: "var(--text-secondary)" }}>({c.email})</span>}
              </button>
            ))}
            {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
              <p className="text-sm py-2" style={{ color: "var(--text-secondary)" }}>No contacts found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Remove Confirm Modal */
function RemoveConfirmModal() {
  const { t } = useI18n();
  const { removeConfirm, setRemoveConfirm, handleRemoveMember } = useVenture();
  if (!removeConfirm) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgb(0 0 0 / 0.6)" }} onClick={() => setRemoveConfirm(null)}>
      <div className="rounded-2xl p-6 w-full max-w-sm mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: "#0f172a", borderColor: "rgb(255 255 255 / 0.1)", color: "var(--text-primary)" }} onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-2">{t("venture.confirmRemove")}</h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          {removeConfirm.contact_name || removeConfirm.contact_id}
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setRemoveConfirm(null)} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("venture.cancel")}
          </button>
          <button onClick={() => handleRemoveMember(removeConfirm.id)}
            className="px-4 py-2 rounded-lg text-sm text-white" style={{ backgroundColor: "#ef4444" }}>
            {t("venture.remove")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Shared member row */
function MemberRow({ member, roleOptions, handleRoleChange, onRemove }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between p-4 border-b last:border-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
      <div>
        <p className="font-medium">{member.contact_name || member.contact_id}</p>
        <p className="text-xs flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          <select value={member.role || roleOptions[0]} onChange={e => handleRoleChange(member.id, e.target.value)}
            className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: "transparent", border: "1px solid rgb(255 255 255 / 0.15)", color: "var(--text-secondary)" }}>
            {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          • {t("venture.memberSince")} {new Date(member.joined_at).toLocaleDateString()}
        </p>
      </div>
      <button onClick={() => onRemove(member)}
        className="text-xs px-3 py-1 rounded-lg transition-colors"
        style={{ color: "var(--text-secondary)", border: "1px solid rgb(255 255 255 / 0.15)" }}>
        {t("venture.remove")}
      </button>
    </div>
  );
}

/* Team Tab — one section for everyone associated with the Venture.
   Founders are grouped and clearly identified; the underlying data keeps
   founder status in the membership model (member_type). */
export function TeamTab() {
  const { t } = useI18n();
  const { members, setAddMemberType, setShowAddMember, handleUpdateMemberRole, setRemoveConfirm, cardStyle } = useVenture();
  const founders = getFounderMembers(members);
  const team = getTeamMembers(members);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t("venture.teamMembers")} ({members.length})</h2>
          <button
            onClick={() => { setAddMemberType("team_member"); setShowAddMember(true); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
            style={{ backgroundColor: "var(--brand-orange)" }}
          >
            <UserPlus size={16} /> {t("venture.addTeamMember")}
          </button>
        </div>

        {founders.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={cardStyle}>
            <div className="px-4 py-2.5 border-b" style={{ borderColor: "rgb(255 255 255 / 0.08)" }}>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--brand-orange)" }}>
                {t("venture.founders")} ({founders.length})
              </span>
            </div>
            {founders.map(m => (
              <MemberRow
                key={m.id}
                member={m}
                roleOptions={FOUNDER_ROLES}
                handleRoleChange={handleUpdateMemberRole}
                onRemove={(x) => setRemoveConfirm(x)}
              />
            ))}
          </div>
        )}

        {team.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={cardStyle}>
            <div className="px-4 py-2.5 border-b" style={{ borderColor: "rgb(255 255 255 / 0.08)" }}>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                {t("venture.teamMembers")} ({team.length})
              </span>
            </div>
            {team.map(m => (
              <MemberRow
                key={m.id}
                member={m}
                roleOptions={TEAM_ROLES}
                handleRoleChange={handleUpdateMemberRole}
                onRemove={(x) => setRemoveConfirm(x)}
              />
            ))}
          </div>
        )}

        {members.length === 0 && (
          <div className="rounded-xl p-6 text-center border" style={cardStyle}>
            <p style={{ color: "var(--text-secondary)" }}>{t("venture.noTeamMembersYet")}</p>
          </div>
        )}
      </div>
      <AddMemberModal />
      <RemoveConfirmModal />
    </>
  );
}
