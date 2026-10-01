/**
 * Projects — collaboration use cases (SERVICE layer).
 *
 * The domain work behind the project collaboration endpoints: members
 * (list/invite/remove), the assignments dropdown, project discussions, the
 * invitation list and the invitation response flow.
 *
 * The CONTROLLER still authenticates (role/capability/object guards), validates
 * the request shape and shapes the HTTP answer. Everything below is what each
 * action DOES — including the invite/re-invite sequence, the discussion
 * notification fan-out with @mentions, and the accept/decline/cancel
 * permission rules of an invitation.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import {
  getProjectMembersWithNames,
  getProjectName,
  declinePendingProjectInvitation,
  createProjectInvitation,
  createProjectInvitationNotification,
  deleteProjectMember,
  getOwnedProjectsByUser,
  getCollaboratingProjectsByUser,
  getAllActiveProjects,
  getProjectDiscussionMessages,
  createProjectDiscussionMessage,
  getProjectMemberCids,
  getProjectOwnerAndName,
  createProjectDiscussionNotification,
  findContactsByNames,
  getProjectInvitations,
  getProjectInvitationById,
  cancelProjectInvitation,
  declineProjectInvitation,
  addProjectMemberFromInvitation,
  acceptProjectInvitation,
  getProjectNameForInvitation,
  getContactCidByName,
  createInvitationAcceptedNotification,
} from "@/models/projectCollaboration";
import { seesWholeProjectPortfolio, resolveOwnScope } from "./workspace";

/** The members of a project, with their contact names. */
export async function listProjectMembers(projectId) {
  const result = await getProjectMembersWithNames(projectId);
  return { status: 200, members: result.rows };
}

/**
 * Invite somebody into a project.
 *
 * Re-inviting is not an error: any pending invitation for the same project and
 * person is declined first, so a person never sits on two live invitations.
 */
export async function inviteProjectMember({
  projectId,
  userCid,
  role,
  inviterName,
}) {
  const projectResult = await getProjectName(projectId);
  const projectName = projectResult.rows[0]?.name || "Unknown Project";

  await declinePendingProjectInvitation(projectId, userCid);
  await createProjectInvitation(projectId, inviterName, userCid, role);
  await createProjectInvitationNotification(
    userCid,
    "Project Invitation",
    `${inviterName} invited you to join "${projectName}"`,
    "project_invite",
  );

  return { status: 200, action: "invited" };
}

/** Remove one member from a project. */
export async function removeProjectMember(projectId, userCid) {
  await deleteProjectMember(projectId, userCid);
  return { status: 200, action: "removed" };
}

/**
 * The projects a caller is related to, grouped: the ones they own, the ones they
 * collaborate on, a deduplicated union, and — for portfolio roles only — every
 * active project (the unlinked dropdown).
 *
 * The three reads fail OPEN: a failing list becomes an empty list, because a
 * dropdown that cannot be built must not turn a page into an error.
 */
export async function listProjectAssignments({ role, sessionCid, requestedCid }) {
  const scope = resolveOwnScope({
    role,
    sessionCid,
    requestedCid,
    denialMessage: "You can only view your own assignments.",
  });
  if (scope.denied) return { status: 403, error: scope.denied };

  const userCid = scope.cid;
  if (!userCid) return { status: 400, error: "user_cid is required." };

  const readRows = async (read) => {
    try {
      const result = await read();
      return result.rows;
    } catch {
      return [];
    }
  };

  const owned = await readRows(() => getOwnedProjectsByUser(userCid));
  const collab = await readRows(() => getCollaboratingProjectsByUser(userCid));
  const all_active = seesWholeProjectPortfolio(role)
    ? await readRows(() => getAllActiveProjects())
    : [];

  const seen = new Set();
  const myProjects = [...owned, ...collab].filter((project) => {
    if (seen.has(project.id)) return false;
    seen.add(project.id);
    return true;
  });

  return { status: 200, owned, collab, myProjects, all_active };
}

/** The discussion messages of a project, oldest first. */
export async function listProjectDiscussions(projectId) {
  const result = await getProjectDiscussionMessages(projectId);
  return { status: 200, messages: result.rows };
}

/**
 * Post a discussion message and notify the project: the owner, every member
 * (the sender excepted, each person once) and anyone @mentioned.
 *
 * The fan-out fails SOFT: a notification problem must not lose the message that
 * was already written.
 */
export async function postProjectDiscussion({
  projectId,
  senderId,
  senderName,
  body,
}) {
  const result = await createProjectDiscussionMessage(
    senderId,
    "Project Discussion",
    body,
    projectId,
  );
  const row = result.rows[0] || {};

  try {
    const membersResult = await getProjectMemberCids(projectId);
    const projectResult = await getProjectOwnerAndName(projectId);
    const projectName = projectResult.rows[0]?.name || "a project";
    const poster = senderName || "Someone";
    const notified = new Set();

    const notify = (recipientId, title, message, type) =>
      createProjectDiscussionNotification(recipientId, title, message, type);

    const ownerId = projectResult.rows[0]?.owner_id;
    if (ownerId && ownerId !== senderId) {
      notified.add(ownerId);
      await notify(
        ownerId,
        "New Discussion Message",
        `${poster} posted in "${projectName}"`,
        "project_discussion",
      );
    }

    for (const member of membersResult.rows) {
      if (member.user_cid === senderId) continue;
      if (notified.has(member.user_cid)) continue;
      notified.add(member.user_cid);
      await notify(
        member.user_cid,
        "New Discussion Message",
        `${poster} posted in "${projectName}"`,
        "project_discussion",
      );
    }

    // @mentions: notify a named contact once, never the sender, never twice.
    const mentionRegex = /@(\w[\w\s.-]*?\w)\b/g;
    let match;
    const mentionedNames = new Set();
    while ((match = mentionRegex.exec(body)) !== null) {
      mentionedNames.add(match[1].trim().toLowerCase());
    }

    if (mentionedNames.size > 0) {
      const mentionResult = await findContactsByNames([...mentionedNames]);
      for (const mentioned of mentionResult.rows) {
        if (notified.has(mentioned.cid)) continue;
        if (mentioned.cid === senderId) continue;
        await notify(
          mentioned.cid,
          "Mention in Discussion",
          `${poster} mentioned you in "${projectName}"`,
          "mention",
        );
      }
    }
  } catch {
    // Notification failure is non-fatal — the message is already written.
  }

  return { status: 200, id: Number(row.id), created_at: row.created_at };
}

/**
 * The invitations a caller may see. Portfolio roles may list any invitee (or
 * none, meaning everyone); everyone else is pinned to their own.
 *
 * `status` defaults to "pending" — the list is a to-do by default.
 */
export async function listProjectInvitations({
  role,
  sessionCid,
  inviteeId,
  status,
  projectId,
}) {
  const scope = resolveOwnScope({
    role,
    sessionCid,
    requestedCid: inviteeId,
    denialMessage: "You can only view your own invitations.",
  });
  if (scope.denied) return { status: 403, error: scope.denied };

  const result = await getProjectInvitations(
    scope.cid,
    status || "pending",
    projectId,
  );
  return { status: 200, invitations: result.rows };
}

/**
 * Respond to a project invitation: cancel (the inviter), accept or decline (the
 * invitee).
 *
 * The cancel rule is the subtle one: `inviter_id` stores a NAME, so the inviter
 * is resolved back to a cid before the comparison — otherwise a namesake could
 * cancel somebody else's invitation. Super Admin may cancel any invitation.
 *
 * @returns {Promise<{status: number, error?: string, action?: string}>}
 */
export async function respondToProjectInvitation({
  invitationId,
  action,
  sessionCid,
  sessionName,
  role,
}) {
  const invitationResult = await getProjectInvitationById(invitationId);
  if (invitationResult.rows.length === 0) {
    return { status: 404, error: "Invitation not found" };
  }
  const invitation = invitationResult.rows[0];

  if (invitation.status !== "pending") {
    return { status: 400, error: "Invitation is no longer pending" };
  }

  if (action === "cancel") {
    let inviterCid = null;
    try {
      const inviterResult = await getContactCidByName(invitation.inviter_id);
      inviterCid = inviterResult.rows?.[0]?.cid || null;
    } catch {
      // A lookup failure leaves inviterCid null — the request is then refused
      // unless the caller is Super Admin, i.e. it fails CLOSED.
    }
    const isInviter =
      Boolean(inviterCid) && String(sessionCid) === String(inviterCid);
    if (!isInviter && role !== "super_admin") {
      return { status: 403, error: "Only the inviter can cancel" };
    }
    await cancelProjectInvitation(invitationId);
    return { status: 200, action: "cancelled" };
  }

  // Accept or decline: only the invitee.
  if (invitation.invitee_id !== sessionCid) {
    return { status: 403, error: "Only the invited user can respond" };
  }

  if (action === "decline") {
    await declineProjectInvitation(invitationId);
    return { status: 200, action: "declined" };
  }

  if (action === "accept") {
    // Join the project, then mark the invitation accepted.
    await addProjectMemberFromInvitation(
      invitation.project_id,
      invitation.invitee_id,
      invitation.role,
    );
    await acceptProjectInvitation(invitationId);

    // Tell the inviter (resolved back from the stored name), if they still exist.
    const projectResult = await getProjectNameForInvitation(invitation.project_id);
    const projectName = projectResult.rows[0]?.name || "Unknown Project";
    const inviterResult = await getContactCidByName(invitation.inviter_id);
    if (inviterResult.rows.length > 0) {
      await createInvitationAcceptedNotification(
        inviterResult.rows[0].cid,
        "Invitation Accepted",
        `${sessionName || invitation.invitee_id} accepted your invitation to "${projectName}"`,
        "project_invite",
      );
    }

    return { status: 200, action: "accepted" };
  }

  return { status: 400, error: "Invalid action" };
}
