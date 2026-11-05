"use client";

/**
 * CRM — Organizational membership (shared screen).
 *
 * Rendered by the single CRM route (/crm/membership); the legacy admin route
 * redirects here.
 *
 * The screen chooses its own posture from the caller's rights: the roster is
 * read-only unless the person holds `org_membership.manage` (Super Admin
 * bypasses). The write affordances (add member, renew, deactivate, end,
 * reactivate) and the "View effective access" deep link are hidden while that
 * right is missing or still loading. The API remains the real boundary: GET
 * requires `org_membership.view`, PUT requires `org_membership.manage`.
 */

import { deriveMembershipStatus } from "@/lib/membership-ui";
import {
  AddMemberModal,
  RenewModal,
  ConfirmModal,
  HistoryModal,
  DetailModal,
} from "@/components/membership/MembershipModals";
import { useMembershipState } from "./useMembershipState";
import { useCrmCapabilities } from "./useCrmCapabilities";
import { MembershipHeader } from "./MembershipHeader";
import { MembershipGroupTabs } from "./MembershipGroupTabs";
import { MembershipFilters } from "./MembershipFilters";
import { MembershipRoster } from "./MembershipRoster";

export default function MembershipScreen({
  effectiveAccessHref = "/admin/security/permissions/people",
}) {
  const { holds, loaded, isSuperAdmin } = useCrmCapabilities();
  const canManage = isSuperAdmin || holds("org_membership", "manage");
  // Until the permission read answers, stay read-only: showing write buttons to
  // someone who lacks the right is worse than a moment of caution.
  const readOnly = !loaded || !canManage;
  const s = useMembershipState({
    readOnly,
    // The deep link lands in the Super Admin shell; a non-admin manager must not
    // be offered a door that redirects them away.
    effectiveAccessHref: isSuperAdmin ? effectiveAccessHref : null,
  });

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <MembershipHeader
          t={s.t}
          readOnly={s.readOnly}
          onReload={s.reload}
          onAddMember={() => s.setAddOpen(true)}
        />

        {/* Group selector */}
        <MembershipGroupTabs
          t={s.t}
          groups={s.groups}
          selectedGroup={s.selectedGroup}
          setSelectedGroup={s.setSelectedGroup}
        />

        {/* Toolbar: search + filters */}
        <MembershipFilters
          t={s.t}
          search={s.search}
          setSearch={s.setSearch}
          statusFilter={s.statusFilter}
          setStatusFilter={s.setStatusFilter}
          accountFilter={s.accountFilter}
          setAccountFilter={s.setAccountFilter}
          roleFilter={s.roleFilter}
          setRoleFilter={s.setRoleFilter}
          roles={s.roles}
        />

        {/* Roster */}
        <MembershipRoster
          t={s.t}
          readOnly={s.readOnly}
          selectedGroup={s.selectedGroup}
          search={s.search}
          statusFilter={s.statusFilter}
          accountFilter={s.accountFilter}
          roleFilter={s.roleFilter}
          filtered={s.filtered}
          loading={s.loading}
          loadFailed={s.loadFailed}
          reload={s.reload}
          fmtDate={s.fmtDate}
          statusKey={s.statusKey}
          accountKey={s.accountKey}
          isProtected={s.isProtected}
          setDetailMember={s.setDetailMember}
          setRenewMember={s.setRenewMember}
          setConfirmState={s.setConfirmState}
          setHistoryMember={s.setHistoryMember}
        />
      </div>

      {/* Add Member */}
      {!s.readOnly && s.addOpen && (
        <AddMemberModal
          groups={s.groups}
          defaultGroup={s.selectedGroup || (s.groups[0] ? s.groups[0].name : "")}
          isProtected={s.isProtected}
          existing={s.members}
          t={s.t}
          lang={s.lang}
          onClose={() => s.setAddOpen(false)}
          onAdded={() => {
            s.setAddOpen(false);
            s.reload();
          }}
        />
      )}

      {/* Member detail */}
      {s.detailMember && (
        <DetailModal
          member={s.detailMember}
          derived={deriveMembershipStatus(s.detailMember)}
          isProtected={s.isProtected(s.detailMember.group_name)}
          t={s.t}
          fmtDate={s.fmtDate}
          readOnly={s.readOnly}
          effectiveAccessHref={s.effectiveAccessHref}
          onClose={() => s.setDetailMember(null)}
          onHistory={() => {
            s.setHistoryMember(s.detailMember);
            s.setDetailMember(null);
          }}
        />
      )}

      {/* Renew / Reactivate */}
      {!s.readOnly && s.renewMember && (
        <RenewModal
          member={s.renewMember}
          isReactivate={deriveMembershipStatus(s.renewMember) === "ended"}
          t={s.t}
          lang={s.lang}
          fmtDate={s.fmtDate}
          onClose={() => s.setRenewMember(null)}
          onConfirm={s.handleRenew}
        />
      )}

      {/* Deactivate / End confirm */}
      {!s.readOnly && s.confirmState && (
        <ConfirmModal state={s.confirmState} t={s.t} onClose={() => s.setConfirmState(null)} onConfirm={s.handleAction} />
      )}

      {/* History */}
      {s.historyMember && (
        <HistoryModal member={s.historyMember} t={s.t} lang={s.lang} fmtDate={s.fmtDate} onClose={() => s.setHistoryMember(null)} />
      )}
    </>
  );
}
