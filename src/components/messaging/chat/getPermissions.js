"use client";

export function getPermissions(role, groupName, userProgramIds, allPrograms) {
  const isSA = role === "super_admin";
  const isStaffFutureStudio =
    role === "staff" &&
    String(groupName || "").toUpperCase() === "FUTURE STUDIO";
  const isPM = role === "program_manager";
  const isParticipant = role === "participant";

  // Send modes available
  const sendModes = ["individual"];
  if (isSA) sendModes.push("group", "program", "broadcast");
  if (isStaffFutureStudio) sendModes.push("group");
  if (isPM) sendModes.push("group", "program");

  // Contact filter: returns true if the user can message this contact
  function canMessage(contact, allContacts) {
    if (!contact || contact.status !== "active") return false;
    if (contact.cid === role) return false; // can't message self (uid check below)

    // Super Admin can message anyone
    if (isSA) return true;

    // Staff (FUTURE STUDIO): only other FUTURE STUDIO members
    if (isStaffFutureStudio) {
      return (
        String(contact.group_name || "").toUpperCase() === "FUTURE STUDIO"
      );
    }

    // Program Manager: only contacts in programs they manage
    if (isPM) {
      if (userProgramIds.length === 0) return false;
      // Participants with matching program_id
      if (contact.program_id && userProgramIds.includes(contact.program_id))
        return true;
      // FUTURE STUDIO staff who may be assigned to PM's programs
      if (String(contact.group_name || "").toUpperCase() === "FUTURE STUDIO")
        return true;
      // Contacts whose group_name matches a family linked to PM's programs
      if (contact.group_name) {
        const familyProgramId = allContacts
          .filter((candidate) => candidate.group_name === contact.group_name)
          .find((candidate) => candidate.program_id && userProgramIds.includes(candidate.program_id));
        if (familyProgramId) return true;
      }
      return false;
    }

    // Participant: only contacts linked to their specific program
    if (isParticipant) {
      // Other participants with same group_name (case-insensitive — group
      // names can be stored uppercased by some flows and original-case by others)
      if (
        contact.role === "participant" &&
        String(contact.group_name || "").toUpperCase() ===
          String(groupName || "").toUpperCase()
      )
        return true;
      // Staff/PM assigned to this participant's program
      if (contact.role !== "participant" && userProgramIds.length > 0) {
        // Contact is the assigned PM for participant's program
        const isAssignedPm = userProgramIds.some((programId) => {
          const program = allPrograms.find((candidate) => candidate.id === programId);
          return (
            program &&
            String(program.assigned_pm_id) === String(contact.cid || contact.id)
          );
        });
        if (isAssignedPm) return true;
        // Contact is assigned as assistant for participant's program
        const isAssistantPm = userProgramIds.some((programId) => {
          const program = allPrograms.find((candidate) => candidate.id === programId);
          if (!program || !program.assigned_assistant_id) return false;
          try {
            const assistants = JSON.parse(program.assigned_assistant_id);
            return (
              Array.isArray(assistants) &&
              assistants.some(
                (assistantId) => String(assistantId) === String(contact.cid || contact.id),
              )
            );
          } catch {
            return false;
          }
        });
        if (isAssistantPm) return true;
        // Contact has matching program_id in their record
        if (contact.program_id && userProgramIds.includes(contact.program_id))
          return true;
      }
      return false;
    }

    return false;
  }

  // Groups available for group messaging
  function getAvailableGroups(allFamilies) {
    const groups = [];

    // Super Admin sees all families + Future Studio Staff
    if (isSA) {
      groups.push({
        id: "__staff__",
        name: "Future Studio Staff",
        type: "staff",
      });
      allFamilies.forEach((family) => {
        if (!family.is_archived && family.program_id) {
          groups.push({
            id: family.id,
            name: family.name,
            type: "family",
            programId: family.program_id,
          });
        }
      });
      return groups;
    }

    // Staff (FUTURE STUDIO) sees only Future Studio Staff
    if (isStaffFutureStudio) {
      groups.push({
        id: "__staff__",
        name: "Future Studio Staff",
        type: "staff",
      });
      return groups;
    }

    // PM sees families linked to their programs
    if (isPM && userProgramIds.length > 0) {
      allFamilies.forEach((family) => {
        if (
          !family.is_archived &&
          family.program_id &&
          userProgramIds.includes(family.program_id)
        ) {
          groups.push({
            id: family.id,
            name: family.name,
            type: "family",
            programId: family.program_id,
          });
        }
      });
      return groups;
    }

    return groups;
  }

  // Programs available for program-wide messaging
  function getAvailablePrograms(allPrograms) {
    if (isSA) return allPrograms.filter((program) => !program.is_archived);
    if (isPM && userProgramIds.length > 0) {
      return allPrograms.filter((program) => userProgramIds.includes(program.id));
    }
    return [];
  }

  return {
    sendModes,
    canMessage,
    getAvailableGroups,
    getAvailablePrograms,
    userProgramIds,
  };
}
