import { getParticipantProgramIds } from "@/models/participant-membership";
import { findFamiliesByMatchingGroupNames, findFamilyByIdText, findFamilyIdsByProgramIds, getContactMessageScopeById, getContactsByFamilyGroupName, getLegacyContactsByProgramId, getParticipantIdsByProgramId, getProgramAssigneeIdsByProgramId, getProgramIdsAssignedToUser, getProgramIdsForProgramStaff, getProgramIdsForTeamHandler, getProgramStaffIdsByProgramId, getStaffMemberCids, getUserGroupCidsByGroupName, getUserGroupNamesByCid } from "@/models/communications";


// ─── Message-scope resolution ────────────────────────────────────────────────

/** Member ids for a program target (participants, staff, PM, assistants). */
export async function resolveProgramMemberIds(programId) {
  const ids = new Set();
  try {
    const participantsResult = await getParticipantIdsByProgramId(programId);
    participantsResult.rows.forEach((row) => row.participant_id && ids.add(String(row.participant_id)));
  } catch (_) {}
  try {
    const staffResult = await getProgramStaffIdsByProgramId(programId);
    staffResult.rows.forEach((row) => row.staff_id && ids.add(String(row.staff_id)));
  } catch (_) {}
  try {
    const assigneesResult = await getProgramAssigneeIdsByProgramId(programId);
    const assigneeRow = assigneesResult.rows[0];
    if (assigneeRow) {
      if (assigneeRow.assigned_pm_id) ids.add(String(assigneeRow.assigned_pm_id));
      if (assigneeRow.assigned_assistant_id) {
        try {
          const assistantIds = JSON.parse(assigneeRow.assigned_assistant_id);
          if (Array.isArray(assistantIds))
            assistantIds.forEach((assistantId) => assistantId && ids.add(String(assistantId)));
        } catch (_) {}
      }
    }
  } catch (_) {}
  try {
    const legacyResult = await getLegacyContactsByProgramId(programId);
    legacyResult.rows.forEach((row) => row.cid && ids.add(String(row.cid)));
  } catch (_) {}
  return Array.from(ids);
}

/** Group member ids for a role/group target ('__staff__' or a family id). */
export async function resolveGroupMemberIds(targetId) {
  const ids = new Set();
  try {
    if (String(targetId) === "__staff__") {
      const staffResult = await getStaffMemberCids();
      staffResult.rows.forEach((row) => row.cid && ids.add(String(row.cid)));
      return Array.from(ids);
    }
    const familyResult = await findFamilyByIdText(targetId);
    if (familyResult.rows.length === 0) return [];
    const family = familyResult.rows[0];
    if (family.name) {
      const members = await getContactsByFamilyGroupName(family.name);
      members.rows.forEach((row) => row.cid && ids.add(String(row.cid)));
      try {
        const userGroupResult = await getUserGroupCidsByGroupName(family.name);
        userGroupResult.rows.forEach((row) => row.user_cid && ids.add(String(row.user_cid)));
      } catch (_) {}
    }
    if (family.program_id) {
      (await resolveProgramMemberIds(family.program_id)).forEach((memberId) =>
        ids.add(memberId),
      );
    }
  } catch (_) {}
  return Array.from(ids);
}

/**
 * Groups (family ids + '__staff__') and programs the user belongs to, used to
 * include group/program messages in their inbox.
 */
export async function resolveUserMessageScope(session) {
  const cid = session.cid;
  const email = session.email;
  const scope = {
    groupIds: new Set(),
    programIds: new Set(),
    isFutureStudioStaff: false,
  };

  // ── Wave 1: everything that needs only the session identity ──────────────
  // The contact row, the user's group names and the three "programs this person
  // is attached to" lookups are independent of each other. allSettled keeps the
  // original failure behaviour: a failing lookup contributes nothing.
  const [contactSettled, userGroupsSettled, assignedSettled, staffSettled, teamSettled] =
    await Promise.allSettled([
      getContactMessageScopeById(cid),
      getUserGroupNamesByCid(cid),
      getProgramIdsAssignedToUser(cid),
      getProgramIdsForProgramStaff(cid, email),
      getProgramIdsForTeamHandler(cid),
    ]);

  const contact =
    contactSettled.status === "fulfilled" ? contactSettled.value.rows[0] || {} : {};

  const groupNames = new Set();
  if (contact.group_name) groupNames.add(String(contact.group_name).trim());
  if (userGroupsSettled.status === "fulfilled") {
    userGroupsSettled.value.rows.forEach((row) => {
      if (row.group_name) groupNames.add(String(row.group_name).trim());
    });
  }

  scope.isFutureStudioStaff =
    String(contact.group_name || "").toUpperCase() === "FUTURE STUDIO" ||
    ["staff", "intern"].includes(contact.role);

  // ── Wave 2: the two lookups that need wave 1 ──────────────────────────────
  const [familiesResult, participantProgramIds] = await Promise.all([
    groupNames.size > 0
      ? findFamiliesByMatchingGroupNames(Array.from(groupNames)).catch(() => null)
      : Promise.resolve(null),
    getParticipantProgramIds({ cid, email, contact }).catch(() => null),
  ]);

  if (familiesResult) {
    familiesResult.rows.forEach((row) => {
      scope.groupIds.add(String(row.id));
      if (row.program_id) scope.programIds.add(String(row.program_id));
    });
  }

  (participantProgramIds || []).forEach((id) => scope.programIds.add(String(id)));

  if (contact.program_id) {
    String(contact.program_id)
      .split(",")
      .forEach((id) => {
        if (id.trim()) scope.programIds.add(String(id.trim()));
      });
  }
  if (assignedSettled.status === "fulfilled") {
    assignedSettled.value.rows.forEach((row) => scope.programIds.add(String(row.id)));
  }
  if (staffSettled.status === "fulfilled") {
    staffSettled.value.rows.forEach((row) => scope.programIds.add(String(row.id)));
  }
  if (teamSettled.status === "fulfilled") {
    teamSettled.value.rows.forEach((row) => scope.programIds.add(String(row.id)));
  }

  // ── Wave 3: families linked to the programs resolved above ───────────────
  if (scope.programIds.size > 0) {
    try {
      const programFamiliesResult = await findFamilyIdsByProgramIds(
        Array.from(scope.programIds),
      );
      programFamiliesResult.rows.forEach((row) => scope.groupIds.add(String(row.id)));
    } catch (_) {}
  }

  return scope;
}

/**
 * The visibility plan for one caller: the same decision the inbox renders, so a
 * writer (marking read) can be restricted to exactly what the caller may list.
 *
 * A Super Admin plan is unrestricted (`isSuperAdmin: true`, no scope lookups);
 * every other caller's plan carries their own cid plus the group/program scopes
 * they belong to. `targetCid` is the cid the plan is read against (the caller's
 * own for a mark-read).
 */
export async function resolveMessageVisibilityPlan(session, targetCid) {
  if (session.role === "super_admin") {
    return {
      isSuperAdmin: true,
      targetCid: targetCid || session.cid,
      groupIds: [],
      programIds: [],
      isFutureStudioStaff: false,
    };
  }

  const scope = await resolveUserMessageScope(session);
  return {
    isSuperAdmin: false,
    targetCid: targetCid || session.cid,
    groupIds: Array.from(scope.groupIds),
    programIds: Array.from(scope.programIds),
    isFutureStudioStaff: scope.isFutureStudioStaff,
  };
}

/**
 * Individual message recipients must share at least one program with the sender
 * (or belong to FUTURE STUDIO staff) — direct messages stay program-scoped for
 * non-SA users.
 */
export async function recipientSharesProgram(recipientId, senderScope) {
  if (!recipientId) return false;
  try {
    const recipientScope = await resolveUserMessageScope({
      cid: String(recipientId),
      email: null,
    });
    if (senderScope.isFutureStudioStaff || recipientScope.isFutureStudioStaff) {
      return true;
    }
    for (const id of recipientScope.programIds) {
      if (senderScope.programIds.has(id)) return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

