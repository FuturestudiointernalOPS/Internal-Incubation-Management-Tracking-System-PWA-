/**
 * INTERNAL COMMS — the message scope engine and the inbox / send / read use-cases.
 *
 * A group or program message (target_type 'role' / 'program') carries a target_id
 * but no recipient_id, so recipients are resolved from their memberships. Direct
 * messages stay program-scoped: a non-Super-Admin may only message somebody who
 * shares a program with them (or is FUTURE STUDIO staff). The inbox visibility
 * policy itself lives in `./messageScope` (the `listMessagesForScope` plan).
 *
 * Reads and writes go through `@/models/communications`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import { getParticipantProgramIds } from "@/models/participant-membership";
import {
  createMessage,
  ensureMessagesAttachmentNameColumn,
  ensureMessagesAttachmentUrlColumn,
  ensureMessagesIsDeletedColumn,
  ensureMessagesIsReadColumn,
  ensureMessagesIsReadColumnForMarkRead,
  findFamiliesByMatchingGroupNames,
  findFamilyByIdText,
  findFamilyIdsByProgramIds,
  getContactMessageScopeById,
  getContactsByFamilyGroupName,
  getLegacyContactsByProgramId,
  getParticipantIdsByProgramId,
  getProgramAssigneeIdsByProgramId,
  getProgramIdsAssignedToUser,
  getProgramIdsForProgramStaff,
  getProgramIdsForTeamHandler,
  getProgramStaffIdsByProgramId,
  getSenderNameByCidOrId,
  getStaffMemberCids,
  getUserGroupCidsByGroupName,
  getUserGroupNamesByCid,
  insertDirectMessageNotification,
  insertGroupMessageNotification,
  insertProgramMessageNotification,
  markConversationMessagesRead,
  markMessageNotificationsRead,
  markMessagesReadByIds,
} from "@/models/communications";
import { listMessagesForScope } from "@/services/communications/messageScope";

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

// ─── Use-cases ───────────────────────────────────────────────────────────────

/** Whether the caller may read the messages of `cid` (own inbox, or any as SA). */
export function mayReadInbox(session, cid) {
  return session.role === "super_admin" || cid === session.cid;
}

/** The inbox for `cid` under the caller's scope. */
export async function readMessageInbox({ session, cid }) {
  const targetCid = cid || session.cid;

  // Ensure is_deleted column exists (safe migration)
  try {
    await ensureMessagesIsDeletedColumn();
  } catch (_) {}

  // Message visibility policy lives in listMessagesForScope (./messageScope):
  // SA sees everything (individual + broadcasts); everyone else sees their own
  // messages + group/program messages for the groups/programs they belong to.
  let scope = null;
  if (session.role !== "super_admin") {
    scope = await resolveUserMessageScope(session);
  }

  const messagesResult = await listMessagesForScope({
    isSuperAdmin: session.role === "super_admin",
    targetCid,
    groupIds: scope ? Array.from(scope.groupIds) : [],
    programIds: scope ? Array.from(scope.programIds) : [],
    isFutureStudioStaff: scope ? scope.isFutureStudioStaff : false,
  });
  return messagesResult.rows;
}

/**
 * Send one internal message. Returns `{ id }`, or `{ denied: { error, status } }`
 * when the caller sends as somebody else, broadcasts to all without the right,
 * or targets something outside their program/group scope.
 */
export async function sendInternalMessage({ session, payload }) {
  const {
    sender_id,
    recipient_id,
    target_type,
    target_id,
    subject,
    body,
    priority,
    attachment_url,
    attachment_name,
  } = payload || {};

  // SECURITY: Sender must match the authenticated user. Default to the
  // authenticated user when sender_id is missing/falsy — otherwise a null
  // sender_id reaches the INSERT and leaks a raw SQL error as a 500.
  const sessionCid = session.cid;
  const effectiveSenderId = sender_id || sessionCid;
  if (effectiveSenderId !== sessionCid && session.role !== "super_admin") {
    return { denied: { error: "Cannot send messages as another user.", status: 403 } };
  }

  // SECURITY: Broadcast to all users is reserved to super_admin
  if (target_type === "all" && session.role !== "super_admin") {
    return { denied: { error: "Only super admins can broadcast to all users.", status: 403 } };
  }

  // PROGRAM-SCOPED MESSAGING: non-SA senders may only message targets within
  // their own program/group scope.
  if (session.role !== "super_admin") {
    const scope = await resolveUserMessageScope(session);
    if (target_type === "program" && target_id) {
      if (!scope.programIds.has(String(target_id))) {
        return { denied: { error: "errors.insufficientPermissions", status: 403 } };
      }
    } else if (target_type === "role" && target_id) {
      const normalizedTargetId = String(target_id);
      const inScope =
        (normalizedTargetId === "__staff__" && scope.isFutureStudioStaff) ||
        scope.groupIds.has(normalizedTargetId);
      if (!inScope) {
        return { denied: { error: "errors.insufficientPermissions", status: 403 } };
      }
    } else if (recipient_id) {
      const sharesProgram = await recipientSharesProgram(recipient_id, scope);
      if (!sharesProgram) {
        return { denied: { error: "errors.insufficientPermissions", status: 403 } };
      }
    }
  }

  // Ensure the optional columns exist (safe migrations)
  try {
    await ensureMessagesIsReadColumn();
  } catch (_) {}
  try {
    await ensureMessagesAttachmentUrlColumn();
  } catch (_) {}
  try {
    await ensureMessagesAttachmentNameColumn();
  } catch (_) {}

  const insertResult = await createMessage({
    senderId: effectiveSenderId,
    recipientId: recipient_id,
    targetType: target_type,
    targetId: target_id,
    subject,
    body,
    priority,
    attachmentUrl: attachment_url,
    attachmentName: attachment_name,
  });
  const newMessageId = insertResult.rows[0]?.id;

  // Get sender name for the notification
  let senderName = effectiveSenderId;
  try {
    const senderResult = await getSenderNameByCidOrId(effectiveSenderId);
    if (senderResult.rows.length > 0) senderName = senderResult.rows[0].name;
  } catch (_) {}

  // Trigger Notifications on Message Transmission
  const notificationTitle = "New Message";
  const notificationMessage = `You have 1 new message from ${senderName}`;

  if (recipient_id) {
    await insertDirectMessageNotification(recipient_id, notificationTitle, notificationMessage);
  } else if (target_type === "role" && target_id) {
    // Group message — notify every member of the group (family or staff)
    const memberIds = await resolveGroupMemberIds(target_id);
    for (const memberId of memberIds) {
      if (String(memberId) === String(effectiveSenderId)) continue;
      await insertGroupMessageNotification(memberId, notificationTitle, notificationMessage);
    }
  } else if (target_type === "program" && target_id) {
    // Program message — notify participants, staff, PM and assistants
    const memberIds = await resolveProgramMemberIds(target_id);
    for (const memberId of memberIds) {
      if (String(memberId) === String(effectiveSenderId)) continue;
      await insertProgramMessageNotification(memberId, notificationTitle, notificationMessage);
    }
  }

  return { id: newMessageId };
}

/**
 * Mark messages read. Returns `{ denied: { error, status } }` when the caller is
 * not part of the named conversation.
 */
export async function markMessagesRead({ session, messageIds, conversationWith }) {
  const sessionCid = session.cid;

  // SECURITY: Validate the user is a participant in the conversation
  if (conversationWith) {
    if (
      conversationWith.recipientId !== sessionCid &&
      conversationWith.senderId !== sessionCid &&
      session.role !== "super_admin"
    ) {
      return {
        denied: {
          error: "Cannot mark messages as read for a conversation you are not part of.",
          status: 403,
        },
      };
    }
  }

  // Ensure is_read column exists
  try {
    await ensureMessagesIsReadColumnForMarkRead();
  } catch (_) {}

  if (Array.isArray(messageIds) && messageIds.length > 0) {
    await markMessagesReadByIds(messageIds);
    // Mark corresponding notifications as read
    try {
      await markMessageNotificationsRead(sessionCid);
    } catch (_) {}
  } else if (conversationWith) {
    // Mark all messages from a specific sender as read
    await markConversationMessagesRead(
      conversationWith.senderId,
      conversationWith.recipientId,
    );
  }

  return { ok: true };
}
