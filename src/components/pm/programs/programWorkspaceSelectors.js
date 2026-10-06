/**
 * Pure derived reads for the PM program workspace.
 *
 * These were the bodies of the screen's top-level derivations. They hold no
 * state and read no data: each is a pure function of its arguments, so the
 * screen keeps the hooks that call them and the results are unchanged.
 */

// Compute program team members from Super Admin's approved list
// (assigned_assistant_id).
export function selectProgramTeamMembers(
  assignedAssistantId,
  staffList,
  assignedStaff,
) {
  if (!assignedAssistantId) return [];
  try {
    const rawAssistantIds = assignedAssistantId;
    let approvedIds = [];
    // Handle both JSON array string and single CID string
    if (typeof rawAssistantIds === "string") {
      if (rawAssistantIds.startsWith("[")) {
        approvedIds = JSON.parse(rawAssistantIds);
      } else {
        approvedIds = [rawAssistantIds];
      }
    } else if (Array.isArray(rawAssistantIds)) {
      approvedIds = rawAssistantIds;
    }
    if (!Array.isArray(approvedIds)) return [];
    const allAvailable = [...staffList, ...assignedStaff];
    const unique = Array.from(
      new Map(allAvailable.map((member) => [member.cid, member])).values(),
    );
    return unique.filter(
      (member) =>
        approvedIds.includes(member.cid) && member.role !== "investor",
    );
  } catch {
    return [];
  }
}

// Oversight candidates = assigned program staff (staff/assistant)
// + program facilitators. Deduped by cid so the same person appears once.
export function selectOversightCandidates(assignedStaff, facilitators) {
  const merged = [...assignedStaff, ...facilitators];
  return Array.from(
    new Map(
      merged.map((member) => [
        member.cid ?? member.email ?? member.id,
        member,
      ]),
    ).values(),
  );
}

/**
 * The screen's access flags.
 *
 * Assistants / associates listed in assigned_assistant_id are "team members";
 * a staff member who is the program's assigned PM, OR a team member
 * (assistant/associate), can manage the program the same as a program_manager.
 */
export function selectProgramAccess({ program, programTeamMembers, user }) {
  const isAssignedPm =
    user.role === "super_admin" ||
    (!!program?.assigned_pm_id &&
      (user.cid === program.assigned_pm_id ||
        user.id === program.assigned_pm_id));

  const isTeamMember = programTeamMembers.some(
    (member) => member.cid === (user.cid || user.id),
  );

  const canEdit =
    user.role === "super_admin" ||
    user.role === "program_manager" ||
    isAssignedPm ||
    isTeamMember;

  const canContribute = canEdit;

  return { isAssignedPm, isTeamMember, canEdit, canContribute };
}

// Tabs: show all tabs to anyone with edit rights, otherwise filter by roles array
export function selectVisibleTabs({ allTabs, isAssignedPm, isTeamMember, user }) {
  return allTabs.filter(
    (tab) =>
      !tab.roles ||
      tab.roles.includes(user.role) ||
      isAssignedPm ||
      isTeamMember,
  );
}
