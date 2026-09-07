import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
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
      const res = await getStaffMemberCids();
      res.rows.forEach((r) => r.cid && ids.add(String(r.cid)));
      return Array.from(ids);
    }
    const fam = await findFamilyByIdText(targetId);
    if (fam.rows.length === 0) return [];
    const family = fam.rows[0];
    if (family.name) {
      const members = await getContactsByFamilyGroupName(family.name);
      members.rows.forEach((r) => r.cid && ids.add(String(r.cid)));
      try {
        const ug = await getUserGroupCidsByGroupName(family.name);
        ug.rows.forEach((r) => r.user_cid && ids.add(String(r.user_cid)));
      } catch (_) {}
    }
    if (family.program_id) {
      (await resolveProgramMemberIds(family.program_id)).forEach((m) =>
        ids.add(m),
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
    const pp = await getParticipantIdsByProgramId(programId);
    pp.rows.forEach((r) => r.participant_id && ids.add(String(r.participant_id)));
  } catch (_) {}
  try {
    const staff = await getProgramStaffIdsByProgramId(programId);
    staff.rows.forEach((r) => r.staff_id && ids.add(String(r.staff_id)));
  } catch (_) {}
  try {
    const prog = await getProgramAssigneeIdsByProgramId(programId);
    const p = prog.rows[0];
    if (p) {
      if (p.assigned_pm_id) ids.add(String(p.assigned_pm_id));
      if (p.assigned_assistant_id) {
        try {
          const arr = JSON.parse(p.assigned_assistant_id);
          if (Array.isArray(arr))
            arr.forEach((a) => a && ids.add(String(a)));
        } catch (_) {}
      }
    }
  } catch (_) {}
  try {
    const legacy = await getLegacyContactsByProgramId(programId);
    legacy.rows.forEach((r) => r.cid && ids.add(String(r.cid)));
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

  let contact = {};
  try {
    const cRes = await getContactMessageScopeById(cid);
    if (cRes.rows.length > 0) contact = cRes.rows[0];
  } catch (_) {}

  const groupNames = new Set();
  if (contact.group_name) groupNames.add(String(contact.group_name).trim());
  try {
    const ug = await getUserGroupNamesByCid(cid);
    ug.rows.forEach((r) => {
      if (r.group_name) groupNames.add(String(r.group_name).trim());
    });
  } catch (_) {}

  scope.isFutureStudioStaff =
    String(contact.group_name || "").toUpperCase() === "FUTURE STUDIO" ||
    ["staff", "developer", "intern", "admin"].includes(contact.role);

  // Families whose name matches one of the user's group names
  if (groupNames.size > 0) {
    try {
      const famRes = await findFamiliesByMatchingGroupNames(
        Array.from(groupNames),
      );
      famRes.rows.forEach((r) => {
        scope.groupIds.add(String(r.id));
        if (r.program_id) scope.programIds.add(String(r.program_id));
      });
    } catch (_) {}
  }

  // Program ids: participant_programs (authoritative) + contact + assignments
  try {
    const { getParticipantProgramIds } = await import(
      "@/lib/participant-membership"
    );
    const pp = await getParticipantProgramIds({ cid, email, contact });
    pp.forEach((id) => scope.programIds.add(String(id)));
  } catch (_) {}
  if (contact.program_id) {
    String(contact.program_id)
      .split(",")
      .forEach((id) => {
        if (id.trim()) scope.programIds.add(String(id.trim()));
      });
  }
  try {
    const progRes = await getProgramIdsAssignedToUser(cid);
    progRes.rows.forEach((r) => scope.programIds.add(String(r.id)));
  } catch (_) {}
  try {
    const staffRes = await getProgramIdsForProgramStaff(cid, email);
    staffRes.rows.forEach((r) => scope.programIds.add(String(r.id)));
  } catch (_) {}
  try {
    const teamRes = await getProgramIdsForTeamHandler(cid);
    teamRes.rows.forEach((r) => scope.programIds.add(String(r.id)));
  } catch (_) {}

  // Families linked to those programs
  if (scope.programIds.size > 0) {
    try {
      const famRes = await findFamilyIdsByProgramIds(
        Array.from(scope.programIds),
      );
      famRes.rows.forEach((r) => scope.groupIds.add(String(r.id)));
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

    const res = await listMessagesForScope({
      isSuperAdmin: session.role === "super_admin",
      targetCid,
      groupIds: scope ? Array.from(scope.groupIds) : [],
      programIds: scope ? Array.from(scope.programIds) : [],
      isFutureStudioStaff: scope ? scope.isFutureStudioStaff : false,
    });
    return NextResponse.json({ success: true, messages: res.rows });
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
        const tid = String(target_id);
        const inScope =
          (tid === "__staff__" && scope.isFutureStudioStaff) ||
          scope.groupIds.has(tid);
        if (!inScope) {
          return NextResponse.json(
            { success: false, error: "errors.insufficientPermissions" },
            { status: 403 },
          );
        }
      } else if (recipient_id) {
        const ok = await recipientSharesProgram(recipient_id, scope);
        if (!ok) {
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

    const insertRes = await createMessage({
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
    const newMessageId = insertRes.rows[0]?.id;

    // Get sender name for notification
    let senderName = effectiveSenderId;
    try {
      const senderRes = await getSenderNameByCidOrId(effectiveSenderId);
      if (senderRes.rows.length > 0) senderName = senderRes.rows[0].name;
    } catch (_) {}

    // Trigger Notifications on Message Transmission
    const notifTitle = "New Message";
    const notifMessage = `You have 1 new message from ${senderName}`;

    if (recipient_id) {
      await insertDirectMessageNotification(recipient_id, notifTitle, notifMessage);
    } else if (target_type === "role" && target_id) {
      // Group message — notify every member of the group (family or staff)
      const memberIds = await resolveGroupMemberIds(target_id);
      for (const m of memberIds) {
        if (String(m) === String(effectiveSenderId)) continue;
        await insertGroupMessageNotification(m, notifTitle, notifMessage);
      }
    } else if (target_type === "program" && target_id) {
      // Program message — notify participants, staff, PM and assistants
      const memberIds = await resolveProgramMemberIds(target_id);
      for (const m of memberIds) {
        if (String(m) === String(effectiveSenderId)) continue;
        await insertProgramMessageNotification(m, notifTitle, notifMessage);
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
