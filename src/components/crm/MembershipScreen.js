"use client";

/**
 * CRM — Organizational membership (shared screen).
 *
 * Rendered by BOTH the admin route (/admin/crm/membership) and the non-admin
 * CRM workspace route (/crm/membership).
 *
 * `readOnly` hides every write affordance (add member, renew, deactivate, end,
 * reactivate) and the admin-only "View effective access" deep link — the
 * roster, filters and history stay available. The API is the real boundary:
 * GET requires `org_membership.view`, PUT requires `org_membership.manage`.
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
import { MembershipHeader } from "./MembershipHeader";
import { MembershipGroupTabs } from "./MembershipGroupTabs";
import { MembershipFilters } from "./MembershipFilters";
import { MembershipRoster } from "./MembershipRoster";

export default function MembershipScreen({
  readOnly = false,
  effectiveAccessHref = "/admin/security/permissions/people",
}) {
  const s = useMembershipState({ readOnly, effectiveAccessHref });

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
