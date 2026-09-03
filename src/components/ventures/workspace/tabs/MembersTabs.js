"use client";

import { UserPlus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";
import { FOUNDER_ROLES, TEAM_ROLES, getFounderMembers, getTeamMembers } from "../ventureMeta";

/* Add Member Modal — shared by Founders & Team tabs */
function AddMemberModal() {
  const { t } = useI18n();
  const { showAddMember, setShowAddMember, addMemberType, setAddMemberType, searchQuery, setSearchQuery, searchResults, searching, searchContacts, handleAddMember, inputStyle } = useVenture();
  if (!showAddMember) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgb(0 0 0 / 0.6)" }} onClick={() => setShowAddMember(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: "#0f172a", borderColor: "rgb(255 255 255 / 0.1)", color: "var(--text-primary)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{addMemberType === "founder" ? t("venture.addFounder") : t("venture.addTeamMember")}</h2>
          <button onClick={() => setShowAddMember(false)} style={{ color: "var(--text-secondary)" }}><X size={20} /></button>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.searchContacts")}</label>
          <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); searchContacts(e.target.value); }}
            className="w-full px-3 py-2 rounded-lg outline-none border mb-2" style={inputStyle} placeholder={t("venture.searchContacts")} />
        </div>
        {searching && <p className="text-sm py-2" style={{ color: "var(--text-secondary)" }}>Searching...</p>}
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
  );
}

/* Remove Confirm Modal — shared by Founders & Team tabs */
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

/* Founders Tab */
export function FoundersTab() {
  const { t } = useI18n();
  const { members, setAddMemberType, setShowAddMember, handleUpdateMemberRole, setRemoveConfirm, cardStyle } = useVenture();
  const founders = getFounderMembers(members);
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t("venture.founders")} ({founders.length})</h2>
          <button onClick={() => { setAddMemberType("founder"); setShowAddMember(true); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
            style={{ backgroundColor: "var(--brand-orange)" }}>
            <UserPlus size={16} /> {t("venture.addFounder")}
          </button>
        </div>
        <div className="rounded-xl border" style={cardStyle}>
          {founders.length === 0 ? (
            <div className="p-6 text-center" style={{ color: "var(--text-secondary)" }}>{t("venture.noFoundersYet")}</div>
          ) : founders.map(m => (
            <div key={m.id} className="flex items-center justify-between p-4 border-b last:border-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
              <div>
                <p className="font-medium">{m.contact_name || m.contact_id}</p>
                <p className="text-xs flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                  <select value={m.role || "Founder"} onChange={e => handleUpdateMemberRole(m.id, e.target.value)}
                    className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: "transparent", border: "1px solid rgb(255 255 255 / 0.15)", color: "var(--text-secondary)" }}>
                    {FOUNDER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  • {t("venture.memberSince")} {new Date(m.joined_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setRemoveConfirm(m)}
                className="text-xs px-3 py-1 rounded-lg transition-colors"
                style={{ color: "var(--text-secondary)", border: "1px solid rgb(255 255 255 / 0.15)" }}>
                {t("venture.remove")}
              </button>
            </div>
          ))}
        </div>
      </div>
      <AddMemberModal />
      <RemoveConfirmModal />
    </>
  );
}

/* Team Tab */
export function TeamTab() {
  const { t } = useI18n();
  const { members, setAddMemberType, setShowAddMember, handleUpdateMemberRole, setRemoveConfirm, cardStyle } = useVenture();
  const team = getTeamMembers(members);
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t("venture.teamMembers")} ({team.length})</h2>
          <button onClick={() => { setAddMemberType("team_member"); setShowAddMember(true); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
            style={{ backgroundColor: "var(--brand-orange)" }}>
            <UserPlus size={16} /> {t("venture.addTeamMember")}
          </button>
        </div>
        <div className="rounded-xl border" style={cardStyle}>
          {team.length === 0 ? (
            <div className="p-6 text-center" style={{ color: "var(--text-secondary)" }}>{t("venture.noTeamMembersYet")}</div>
          ) : team.map(m => (
            <div key={m.id} className="flex items-center justify-between p-4 border-b last:border-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
              <div>
                <p className="font-medium">{m.contact_name || m.contact_id}</p>
                <p className="text-xs flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                  <select value={m.role || "Team Member"} onChange={e => handleUpdateMemberRole(m.id, e.target.value)}
                    className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: "transparent", border: "1px solid rgb(255 255 255 / 0.15)", color: "var(--text-secondary)" }}>
                    {TEAM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  • {t("venture.memberSince")} {new Date(m.joined_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setRemoveConfirm(m)}
                className="text-xs px-3 py-1 rounded-lg transition-colors"
                style={{ color: "var(--text-secondary)", border: "1px solid rgb(255 255 255 / 0.15)" }}>
                {t("venture.remove")}
              </button>
            </div>
          ))}
        </div>
      </div>
      <AddMemberModal />
      <RemoveConfirmModal />
    </>
  );
}
