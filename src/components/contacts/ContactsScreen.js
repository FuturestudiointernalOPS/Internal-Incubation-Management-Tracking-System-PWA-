"use client";

import React, { Suspense } from "react";
import { TableSkeleton } from "@/components/ui/Skeleton";

// The screen is shared by /crm/contacts (canonical) and the old
// /admin/communications/contacts route, which now redirects here. The pieces
// still live beside the old route during the merge; moving them is the phase 5
// cleanup, not a behaviour change.
import { useContactsState } from "@/app/admin/communications/contacts/useContactsState";
import { ContactsNotification } from "@/app/admin/communications/contacts/ContactsNotification";
import { ContactsHeader } from "@/app/admin/communications/contacts/ContactsHeader";
import { ContactsSegmentsSidebar } from "@/app/admin/communications/contacts/ContactsSegmentsSidebar";
import { ContactsToolbar } from "@/app/admin/communications/contacts/ContactsToolbar";
import { ContactsTeamTabs } from "@/app/admin/communications/contacts/ContactsTeamTabs";
import { ContactsTable } from "@/app/admin/communications/contacts/ContactsTable";
import { ContactsPagination } from "@/app/admin/communications/contacts/ContactsPagination";
import { ContactFormModal } from "@/app/admin/communications/contacts/ContactFormModal";
import { SegmentFormModal } from "@/app/admin/communications/contacts/SegmentFormModal";
import { GroupInviteModal } from "@/app/admin/communications/contacts/GroupInviteModal";
import { BulkProgramModal } from "@/app/admin/communications/contacts/BulkProgramModal";
import { ContactsConfirmDialog } from "@/app/admin/communications/contacts/ContactsConfirmDialog";

function ContactsScreenContent() {
  const s = useContactsState();

  return (
    <>
      <ContactsNotification notification={s.notification} />

      <div className="space-y-10 pb-20 animate-in text-left">
        <ContactsHeader
          t={s.t}
          goBack={s.goBack}
          statusFilter={s.statusFilter}
          onAddMember={s.openNewContact}
          onBulkAssign={() => s.setShowBulkProgramModal(true)}
        />

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <ContactsSegmentsSidebar
            t={s.t}
            families={s.families}
            contacts={s.contacts}
            selectedGroup={s.selectedGroup}
            setSelectedGroup={s.setSelectedGroup}
            segmentCounts={s.segmentCounts}
            copiedGroup={s.copiedGroup}
            setShowGroupModal={s.setShowGroupModal}
            setInviteForm={s.setInviteForm}
            setShowInviteModal={s.setShowInviteModal}
            setNewGroupName={s.setNewGroupName}
            setNewGroupType={s.setNewGroupType}
            setNewGroupProgramId={s.setNewGroupProgramId}
            copyJoinLink={s.copyJoinLink}
          />

          <div className="xl:col-span-3 space-y-6">
            {/* Unified toolbar: search + status tabs + result count + bulk actions */}
            <ContactsToolbar
              t={s.t}
              search={s.search}
              setSearch={s.setSearch}
              statusFilter={s.statusFilter}
              setStatusFilter={s.setStatusFilter}
              filteredCount={s.filtered.length}
            />

            {/* SUB-TEAM TABS (Only shown when a group is selected and not in Archived mode) */}
            <ContactsTeamTabs
              t={s.t}
              selectedGroup={s.selectedGroup}
              statusFilter={s.statusFilter}
              selectedTeamTab={s.selectedTeamTab}
              setSelectedTeamTab={s.setSelectedTeamTab}
              teams={s.teams}
            />

            <ContactsTable
              t={s.t}
              loading={s.loading}
              paginated={s.paginated}
              teams={s.teams}
              statusFilter={s.statusFilter}
              isProcessing={s.isProcessing}
              search={s.search}
              selectedGroup={s.selectedGroup}
              toggleStatus={s.toggleStatus}
              handleInviteContact={s.handleInviteContact}
              handleResendActivation={s.handleResendActivation}
              openEditContact={s.openEditContact}
              handlePivotToEntity={s.handlePivotToEntity}
              handleArchive={s.handleArchive}
              handleRestore={s.handleRestore}
              handleSoftDelete={s.handleSoftDelete}
              clearFilters={s.clearFilters}
            />

            {/* Pagination bar */}
            <ContactsPagination
              t={s.t}
              loading={s.loading}
              totalPages={s.totalPages}
              safePage={s.safePage}
              setCurrentPage={s.setCurrentPage}
            />
          </div>
        </div>
      </div>

      {/* MODALS */}
      {s.showManualModal && (
        <ContactFormModal
          t={s.t}
          form={s.form}
          setForm={s.setForm}
          families={s.families}
          programs={s.programs}
          contactPrograms={s.contactPrograms}
          setContactPrograms={s.setContactPrograms}
          onClose={() => s.setShowManualModal(false)}
          onSave={s.handleSaveContact}
        />
      )}

      {s.showGroupModal && (
        <SegmentFormModal
          t={s.t}
          showGroupModal={s.showGroupModal}
          newGroupName={s.newGroupName}
          setNewGroupName={s.setNewGroupName}
          newGroupType={s.newGroupType}
          setNewGroupType={s.setNewGroupType}
          newGroupProgramId={s.newGroupProgramId}
          setNewGroupProgramId={s.setNewGroupProgramId}
          programs={s.programs}
          onClose={() => s.setShowGroupModal(null)}
          onSave={s.handleSaveGroup}
        />
      )}

      {s.showInviteModal && (
        <GroupInviteModal
          t={s.t}
          showInviteModal={s.showInviteModal}
          inviteForm={s.inviteForm}
          setInviteForm={s.setInviteForm}
          isProcessing={s.isProcessing}
          onClose={() => s.setShowInviteModal(null)}
          onInvite={s.handleInvite}
        />
      )}

      {/* BULK PROGRAM ASSIGNMENT MODAL */}
      {s.showBulkProgramModal && (
        <BulkProgramModal
          t={s.t}
          contacts={s.contacts}
          programs={s.programs}
          bulkSelected={s.bulkSelected}
          setBulkSelected={s.setBulkSelected}
          isProcessing={s.isProcessing}
          setIsProcessing={s.setIsProcessing}
          setNotification={s.setNotification}
          setShowBulkProgramModal={s.setShowBulkProgramModal}
          refreshAll={s.refreshAll}
        />
      )}

      {/* Confirm Dialog */}
      {s.confirmTarget && (
        <ContactsConfirmDialog
          t={s.t}
          confirmTarget={s.confirmTarget}
          setConfirmTarget={s.setConfirmTarget}
        />
      )}
    </>
  );
}

export default function ContactsScreen() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} />}>
      <ContactsScreenContent />
    </Suspense>
  );
}
