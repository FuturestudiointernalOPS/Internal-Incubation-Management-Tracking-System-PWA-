import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
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
  listMessagesForScope,
  markConversationMessagesRead,
  markMessageNotificationsRead,
  markMessagesReadByIds,
} from "@/models/communications";

// ─── Message-scope resolution helpers ───────────────────────────────────────
// Group/program messages (target_type 'role'/'program') carry a target_id but
// no recipient_id, so recipients must be resolved from their memberships.

/** Group member ids for a role/group target ('__staff__' or a family id). */
async function resolveGroupMemberIds(targetId) {
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
 * Individual message recipients must share at least one program with the
 * sender (or belong to FUTURE STUDIO staff) — direct messages stay
 * program-scoped for non-SA users (Phase 3 fix).
 */
async function recipientSharesProgram(recipientId, senderScope) {
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

/** Member ids for a program target (participants, staff, PM, assistants). */
async function resolveProgramMemberIds(programId) {
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

/**
 * Groups (family ids + '__staff__') and programs the user belongs to, used to
 * include group/program messages in their inbox.
 */
async function resolveUserMessageScope(session) {
  const cid = session.cid;
  const email = session.email;
  const scope = {
    groupIds: new Set(),
    programIds: new Set(),
    isFutureStudioStaff: false,
  };

  // ── Wave 1: everything that needs only the session identity ──────────────
  // The contact row, the user's group names and the three "programs this person
  // is attached to" lookups are independent of each other. They used to run one
  // after another — five round trips (~700ms) before a single message could be
  // selected. allSettled keeps the original failure behaviour: a failing lookup
  // contributes nothing instead of breaking the inbox.
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
  // Families whose name matches one of the user's group names, and the
  // participant_programs membership (authoritative, with its legacy fallback).
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

  (participantProgramIds || []).forEach((id) =>
    scope.programIds.add(String(id)),
  );

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

export async function GET(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const capError = await requireAuthorization("messaging", "view");
    if (capError) return capError;
    const { searchParams } = new URL(req.url);
    const cid = searchParams.get("cid");

    // SECURITY: Users can only request their own messages unless super_admin
    const requestingCid = session.cid;
    if (session.role !== "super_admin" && cid !== requestingCid) {
      return NextResponse.json(
        { success: false, error: "You can only access your own messages." },
        { status: 403 },
      );
    }

    // Use the validated CID
    const targetCid = cid || requestingCid;

    // Ensure is_deleted column exists (safe migration)
    try {
      await ensureMessagesIsDeletedColumn();
    } catch (_) {}

    // Message visibility SQL assembled in listMessagesForScope (model):
    // SA sees everything (individual + broadcasts); everyone else sees their
    // own messages + group/program messages for the groups/programs they
    // belong to. Broadcasts stay SA-only.
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
    return NextResponse.json({ success: true, messages: messagesResult.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const capError = await requireAuthorization("messaging", "send");
    if (capError) return capError;
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
    } = await req.json();

    // SECURITY: Sender must match the authenticated user.
    // Default to the authenticated user when sender_id is missing/falsy —
    // otherwise a null sender_id reaches the INSERT and leaks a raw SQL
    // error as a 500 (NOT NULL constraint), since the super_admin branch
    // below never re-validates it.
    const sessionCid = session.cid;
    const effectiveSenderId = sender_id || sessionCid;
    if (effectiveSenderId !== sessionCid && session.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Cannot send messages as another user." },
        { status: 403 },
      );
    }

    // SECURITY: Broadcast to all users is reserved to super_admin
    if (target_type === "all" && session.role !== "super_admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Only super admins can broadcast to all users.",
        },
        { status: 403 },
      );
    }

    // PROGRAM-SCOPED MESSAGING (Phase 3): non-SA senders may only message
    // targets within their own program/group scope. A participant must not be
    // able to message programs, groups or people they do not belong to.
    if (session.role !== "super_admin") {
      const scope = await resolveUserMessageScope(session);
      if (target_type === "program" && target_id) {
        if (!scope.programIds.has(String(target_id))) {
          return NextResponse.json(
            { success: false, error: "errors.insufficientPermissions" },
            { status: 403 },
          );
        }
      } else if (target_type === "role" && target_id) {
        const normalizedTargetId = String(target_id);
        const inScope =
          (normalizedTargetId === "__staff__" && scope.isFutureStudioStaff) ||
          scope.groupIds.has(normalizedTargetId);
        if (!inScope) {
          return NextResponse.json(
            { success: false, error: "errors.insufficientPermissions" },
            { status: 403 },
          );
        }
      } else if (recipient_id) {
        const sharesProgram = await recipientSharesProgram(recipient_id, scope);
        if (!sharesProgram) {
          return NextResponse.json(
            { success: false, error: "errors.insufficientPermissions" },
            { status: 403 },
          );
        }
      }
    }

    // Ensure is_read column exists (safe migration)
    try {
      await ensureMessagesIsReadColumn();
    } catch (_) {}

    // Ensure attachment columns exist (safe migration)
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

    // Get sender name for notification
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

    return NextResponse.json({ success: true, id: newMessageId });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const capError = await requireAuthorization("messaging", "view");
    if (capError) return capError;
    const { messageIds, conversationWith } = await req.json();

    // SECURITY: Validate the user is a participant in the conversation
    const sessionCid = session.cid;
    if (conversationWith) {
      if (
        conversationWith.recipientId !== sessionCid &&
        conversationWith.senderId !== sessionCid &&
        session.role !== "super_admin"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Cannot mark messages as read for a conversation you are not part of.",
          },
          { status: 403 },
        );
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT internal-comms error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
