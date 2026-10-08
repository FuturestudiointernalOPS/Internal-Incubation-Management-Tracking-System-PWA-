"use client";

import { useMemo } from "react";
import { getPermissions } from "@/components/messaging/chat/getPermissions";

export function useDerivedData({
  role,
  groupName,
  allPrograms,
  allContacts,
  families,
  uid,
  effectiveUser,
}) {
  const userProgramIds = useMemo(() => {
    if (!uid || !role) return [];
    if (role === "super_admin") return [];
    if (role === "staff") return [];
    if (role === "program_manager") {
      return allPrograms
        .filter((program) => String(program.assigned_pm_id) === String(uid))
        .map((program) => program.id);
    }
    if (role === "participant") {
      if (effectiveUser?.program_id) return [effectiveUser.program_id];
      return [];
    }
    return [];
  }, [uid, role, allPrograms, effectiveUser]);

  const permissions = useMemo(
    () => getPermissions(role, groupName, userProgramIds, allPrograms),
    [role, groupName, userProgramIds, allPrograms],
  );

  const contacts = useMemo(() => {
    return allContacts.filter((contact) => {
      if (String(contact.cid || contact.id) === String(uid)) return false;
      if (role === "participant" || role === "founder") return true;
      return permissions.canMessage(contact, allContacts);
    });
  }, [allContacts, permissions, uid, role]);

  const availableGroups = useMemo(
    () => permissions.getAvailableGroups(families),
    [permissions, families],
  );

  const availablePrograms = useMemo(
    () => permissions.getAvailablePrograms(allPrograms),
    [permissions, allPrograms],
  );

  const sendModes = permissions.sendModes;

  return {
    userProgramIds,
    permissions,
    contacts,
    availableGroups,
    availablePrograms,
    sendModes,
  };
}