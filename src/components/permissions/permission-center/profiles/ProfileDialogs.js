/**
 * The two dialogs: the assigned-roles editor and the save confirmation.
 *
 * Cut out of src/components/permissions/permission-center/AccessProfilesView.js
 * as-is: the panel keeps every state value and every write, and hands this block
 * what it reads through `ctx`. The names it needs are listed in the signature —
 * nothing else.
 */

"use client";
import ProfileRoleDefaultsModal from "@/components/permissions/permission-center/ProfileRoleDefaultsModal";
import ProfileSaveConfirmModal from "@/components/permissions/permission-center/ProfileSaveConfirmModal";

export default function ProfileDialogs({ ctx }) {
  const {
    allRoles,
    assignRoleDefault,
    confirmSave,
    defaultRoleBusy,
    defaultRoleChoice,
    defaultRoleErr,
    defaultRoleMsg,
    pendingSaveConfirm,
    removeBusy,
    removeErr,
    removeMsg,
    removeRoleDefault,
    rolesModalOpen,
    selectedIsDefaultFor,
    selectedProfile,
    setDefaultRoleChoice,
    setPendingSaveConfirm,
    setRolesModalOpen,
    t,
  } = ctx;

  return (
    <>
      {/* Assigned-roles modal — the roles list is read-only until Edit */}
      {rolesModalOpen && selectedProfile && (
        <ProfileRoleDefaultsModal
          t={t}
          selectedIsDefaultFor={selectedIsDefaultFor}
          removeRoleDefault={removeRoleDefault}
          removeBusy={removeBusy}
          defaultRoleChoice={defaultRoleChoice}
          setDefaultRoleChoice={setDefaultRoleChoice}
          allRoles={allRoles}
          assignRoleDefault={assignRoleDefault}
          defaultRoleBusy={defaultRoleBusy}
          defaultRoleMsg={defaultRoleMsg}
          defaultRoleErr={defaultRoleErr}
          removeMsg={removeMsg}
          removeErr={removeErr}
          onClose={() => setRolesModalOpen(false)}
        />
      )}

      {/* Profile-safety confirmation for role-bound profiles */}
      {pendingSaveConfirm && (
        <ProfileSaveConfirmModal
          t={t}
          roles={pendingSaveConfirm}
          onCancel={() => setPendingSaveConfirm(null)}
          onConfirm={confirmSave}
        />
      )}
    </>
  );
}
