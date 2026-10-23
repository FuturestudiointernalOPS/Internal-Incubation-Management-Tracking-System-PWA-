"use client";

import { UserPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppModal from "@/components/ui/AppModal";
import { useVenture } from "../VentureContext";
import { getFounderMembers, getTeamMembers } from "../ventureMeta";
import VentureSupportCard from "@/components/ventures/support/VentureSupportCard";

/* Add Member — a founder invites ANOTHER FOUNDER by email; the person joins the
   Venture only after accepting the emailed link. The type is fixed to founder:
   team members and roles are the Venture's staff decision, and the server
   refuses anything else from a founder. */
function AddMemberModal() {
  const { t } = useI18n();
  const { showAddMember, setShowAddMember, inviteEmail, setInviteEmail, inviting, handleInviteMember, inputStyle } = useVenture();
  if (!showAddMember) return null;
  return (
    <AppModal isOpen onClose={() => setShowAddMember(false)} title={t("venture.addMember")} size="sm">
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); handleInviteMember(); }}>
        <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{t("venture.addMemberFounderHint")}</p>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="invite-founder-email">{t("venture.inviteEmail")}</label>
          <input
            id="invite-founder-email"
            type="email"
            required
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            className="w-full px-3 py-2 rounded-lg outline-none border"
            style={inputStyle}
            placeholder={t("venture.inviteEmailPlaceholder")}
          />
          <p className="text-[10px] mt-1" style={{ color: "var(--text-secondary)" }}>{t("venture.inviteEmailHint")}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setShowAddMember(false)} className="stf-btn">{t("venture.cancel")}</button>
          <button type="submit" disabled={inviting} className="stf-btn pr">
            {inviting ? t("venture.sendingInvitation") : t("venture.sendInvitation")}
          </button>
        </div>
      </form>
    </AppModal>
  );
}

/* Remove Confirm Modal */
function RemoveConfirmModal() {
  const { t } = useI18n();
  const { removeConfirm, setRemoveConfirm, handleRemoveMember } = useVenture();
  if (!removeConfirm) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgb(0 0 0 / 0.6)" }} onClick={() => setRemoveConfirm(null)}>
      <div className="rounded-2xl p-6 w-full max-w-sm mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: "var(--surface-1)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }} onClick={event => event.stopPropagation()}>
        <h2 className="text-lg font-bold mb-2">{t("venture.confirmRemove")}</h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          {removeConfirm.contact_name || removeConfirm.contact_id}
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setRemoveConfirm(null)} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("venture.cancel")}
          </button>
          <button onClick={() => handleRemoveMember(removeConfirm.id)}
            className="px-4 py-2 rounded-lg text-sm text-white" style={{ backgroundColor: "var(--chart-danger)" }}>
            {t("venture.remove")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Shared member row — the role is DISPLAYED, never chosen by the member. */
function MemberRow({ member, onRemove }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between p-4 border-b last:border-0" style={{ borderColor: "var(--border-primary)" }}>
      <div>
        <p className="font-medium">{member.contact_name || member.contact_id}</p>
        <p className="text-xs flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          <span className="stf-tag" style={{ textTransform: "capitalize" }}>{member.role || "—"}</span>
          • {t("venture.memberSince")} {new Date(member.joined_at).toLocaleDateString()}
        </p>
      </div>
      <button onClick={() => onRemove(member)}
        className="text-xs px-3 py-1 rounded-lg transition-colors"
        style={{ color: "var(--text-secondary)", border: "1px solid var(--border-primary)" }}>
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
  const { members, membersLoading, setRemoveConfirm, setShowAddMember, setAddMemberType, cardStyle, invitations, handleRevokeInvitation, params } = useVenture();
  const founders = getFounderMembers(members);
  const team = getTeamMembers(members);
  const pending = Array.isArray(invitations) ? invitations : [];

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t("venture.teamMembers")} ({membersLoading ? "…" : members.length})</h2>
          {/* Only founders can be added from here (fixed server-side too). */}
          <button
            onClick={() => { setAddMemberType("founder"); setShowAddMember(true); }}
            className="stf-btn pr"
          >
            <UserPlus size={14} /> {t("venture.addMember")}
          </button>
        </div>

        {pending.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={cardStyle}>
            <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border-primary)" }}>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--brand-orange)" }}>
                {t("venture.pendingInvitations")} ({pending.length})
              </span>
            </div>
            {pending.map(invitation => (
              <div key={invitation.id} className="flex items-center justify-between p-4 border-b last:border-0" style={{ borderColor: "var(--border-primary)" }}>
                <div>
                  <p className="font-medium">{invitation.display_name || invitation.name || invitation.email}</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {invitation.email} • {invitation.member_type === "founder" ? t("venture.founders") : t("venture.teamMembers")}
                    {invitation.is_expired ? ` • ${t("venture.invitationExpired")}` : ""}
                  </p>
                  {invitation.email_status === "failed" && (
                    <p className="text-xs mt-1" style={{ color: "var(--chart-danger)" }}>
                      {t("venture.invitationEmailNotSent")}
                    </p>
                  )}
                </div>
                <button onClick={() => handleRevokeInvitation(invitation.id)}
                  className="text-xs px-3 py-1 rounded-lg transition-colors"
                  style={{ color: "var(--text-secondary)", border: "1px solid var(--border-primary)" }}>
                  {t("venture.revokeInvitation")}
                </button>
              </div>
            ))}
          </div>
        )}

        {founders.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={cardStyle}>
            <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border-primary)" }}>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--brand-orange)" }}>
                {t("venture.founders")} ({founders.length})
              </span>
            </div>
            {founders.map(member => (
              <MemberRow
                key={member.id}
                member={member}
                onRemove={(memberToRemove) => setRemoveConfirm(memberToRemove)}
              />
            ))}
          </div>
        )}

        {team.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={cardStyle}>
            <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border-primary)" }}>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                {t("venture.teamMembers")} ({team.length})
              </span>
            </div>
            {team.map(member => (
              <MemberRow
                key={member.id}
                member={member}
                onRemove={(memberToRemove) => setRemoveConfirm(memberToRemove)}
              />
            ))}
          </div>
        )}

        {/* Not "empty" until the roster has actually answered. */}
        {!membersLoading && members.length === 0 && (
          <div className="rounded-xl p-6 text-center border" style={cardStyle}>
            <p style={{ color: "var(--text-secondary)" }}>{t("venture.noTeamMembersYet")}</p>
          </div>
        )}
      </div>
      {/* WHO supports this Venture beyond its own people: the assigned staff, with
          the address to reach them. Same read as the dashboard card. */}
      {params?.id && (
        <div className="mt-4">
          <VentureSupportCard ventureId={params.id} />
        </div>
      )}
      <AddMemberModal />
      <RemoveConfirmModal />
    </>
  );
}
