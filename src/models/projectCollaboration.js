import db from "@/lib/db";

/**
 * Project collaboration model — data access for the collaboration controllers:
 * `src/app/api/projects/members/route.js`,
 * `src/app/api/projects/assignments/route.js`,
 * `src/app/api/projects/discuss/route.js`,
 * `src/app/api/projects/invitations/route.js`, and
 * `src/app/api/projects/invitations/respond/route.js`.
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 * Where the original handlers ran the same query at multiple call sites, the
 * model keeps one function per call site (1:1 extraction —
 * see docs/MVC_REFACTOR.md).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

/** Project members with contact names, ordered by role then name. */
export async function getProjectMembersWithNames(projectId) {
  return db.execute({
    sql: `SELECT pm.*, c.name
            FROM project_members pm
            LEFT JOIN contacts c ON pm.user_cid = c.cid OR pm.user_cid = c.id
            WHERE pm.project_id::text = ?
            ORDER BY pm.role ASC, c.name ASC`,
    args: [projectId],
  });
}

/** Project display name (used when building an invitation message). */
export async function getProjectName(project_id) {
  return db.execute({
    sql: "SELECT name FROM v2_projects WHERE id::text = ?",
    args: [project_id],
  });
}

/** Cancel any pending invitation for a project + invitee (re-invite path). */
export async function declinePendingProjectInvitation(project_id, user_cid) {
  return db.execute({
    sql: "UPDATE project_invitations SET status = 'declined', responded_at = NOW() WHERE project_id = ? AND invitee_id = ? AND status = 'pending'",
    args: [project_id, user_cid],
  });
}

/** Insert a pending project invitation, returning the new id. */
export async function createProjectInvitation(
  project_id,
  inviter_id,
  invitee_id,
  role,
) {
  return db.execute({
    sql: "INSERT INTO project_invitations (project_id, inviter_id, invitee_id, role) VALUES (?, ?, ?, ?) RETURNING id",
    args: [project_id, inviter_id, invitee_id, role || "member"],
  });
}

/** Notify an invitee about a new project invitation. */
export async function createProjectInvitationNotification(
  recipient_id,
  title,
  message,
  type,
) {
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
    args: [recipient_id, title, message, type],
  });
}

/** Remove one member from a project (DELETE /api/projects/members). */
export async function deleteProjectMember(projectId, userCid) {
  return db.execute({
    sql: "DELETE FROM project_members WHERE project_id::text = ? AND user_cid = ?",
    args: [projectId, userCid],
  });
}

/** Projects owned by a user (assignments dropdown, owned list). */
export async function getOwnedProjectsByUser(userCid) {
  return db.execute({
    sql: `SELECT id, name, status FROM v2_projects
            WHERE owner_id = ? AND status != 'Archived'
            ORDER BY name ASC`,
    args: [userCid],
  });
}

/** Projects a user collaborates on (assignments dropdown, collab list). */
export async function getCollaboratingProjectsByUser(userCid) {
  return db.execute({
    sql: `SELECT p.id, p.name, p.status, pm.role as member_role
            FROM project_members pm
            INNER JOIN v2_projects p ON pm.project_id::text = p.id::text
            WHERE pm.user_cid = ? AND p.status != 'Archived'
            ORDER BY p.name ASC`,
    args: [userCid],
  });
}

/** All active (non-archived/completed) projects — unlinked dropdown. */
export async function getAllActiveProjects() {
  return db.execute({
    sql: `SELECT id, name, status FROM v2_projects
              WHERE status != 'Archived' AND status != 'Completed'
              ORDER BY name ASC`,
    args: [],
  });
}

/** Discussion messages of a project, oldest first. */
export async function getProjectDiscussionMessages(project_id) {
  return db.execute({
    sql: `SELECT v2_messages.id, v2_messages.sender_id, contacts.name AS sender_name, v2_messages.body, v2_messages.created_at
          FROM v2_messages
          LEFT JOIN contacts ON v2_messages.sender_id = contacts.cid
          WHERE v2_messages.project_id = ? AND v2_messages.is_deleted = 0
          ORDER BY v2_messages.created_at ASC`,
    args: [project_id],
  });
}

/** Insert a project discussion message, returning id + created_at. */
export async function createProjectDiscussionMessage(
  sender_id,
  subject,
  messageBody,
  project_id,
) {
  return db.execute({
    sql: `INSERT INTO v2_messages (sender_id, subject, body, project_id, target_type)
          VALUES (?, ?, ?, ?, 'project')
          RETURNING id, created_at`,
    args: [sender_id, subject, messageBody.trim(), project_id],
  });
}

/** Cids of all project members (discussion notification fan-out). */
export async function getProjectMemberCids(project_id) {
  return db.execute({
    sql: "SELECT user_cid FROM project_members WHERE project_id::text = ?",
    args: [project_id],
  });
}

/** Owner id + name of a project (discussion notifications). */
export async function getProjectOwnerAndName(project_id) {
  return db.execute({
    sql: "SELECT owner_id, name FROM v2_projects WHERE id::text = ?",
    args: [project_id],
  });
}

/** Notify one recipient of a project discussion message / mention. */
export async function createProjectDiscussionNotification(
  recipient_id,
  title,
  message,
  type,
) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
              VALUES (?, ?, ?, ?, 0, NOW())`,
    args: [recipient_id, title, message, type],
  });
}

/** Contacts whose trimmed name matches one of the @mention names. */
export async function findContactsByNames(namesArray) {
  const placeholders = namesArray.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT cid, name FROM contacts
              WHERE LOWER(TRIM(name)) IN (${placeholders})
              AND deleted = 0`,
    args: namesArray,
  });
}

/** Invitations with project name, optional invitee/status/project filters. */
export async function getProjectInvitations(invitee_id, status, project_id) {
  let sql =
    "SELECT pi.*, p.name as project_name FROM project_invitations pi LEFT JOIN v2_projects p ON pi.project_id = p.id::text WHERE 1=1";
  const args = [];
  if (invitee_id) {
    sql += " AND pi.invitee_id = ?";
    args.push(invitee_id);
  }
  if (status) {
    sql += " AND pi.status = ?";
    args.push(status);
  }
  if (project_id) {
    sql += " AND pi.project_id = ?";
    args.push(project_id);
  }
  sql += " ORDER BY pi.created_at DESC";

  return db.execute({ sql, args });
}

/** Full invitation row by numeric id. */
export async function getProjectInvitationById(invitation_id) {
  return db.execute({
    sql: "SELECT * FROM project_invitations WHERE id = ?",
    args: [parseInt(invitation_id)],
  });
}

/** Cancel a pending invitation (inviter declines it, respond handler). */
export async function cancelProjectInvitation(invitation_id) {
  return db.execute({
    sql: "UPDATE project_invitations SET status = 'declined', responded_at = NOW() WHERE id = ?",
    args: [parseInt(invitation_id)],
  });
}

/**
 * Decline a pending invitation (invitee declines it, respond handler).
 * Byte-identical query to cancelProjectInvitation; extracted separately so
 * each original inline call site maps 1:1 to a model function.
 */
export async function declineProjectInvitation(invitation_id) {
  return db.execute({
    sql: "UPDATE project_invitations SET status = 'declined', responded_at = NOW() WHERE id = ?",
    args: [parseInt(invitation_id)],
  });
}

/** Add the invitee to project_members (accept path, upsert on conflict). */
export async function addProjectMemberFromInvitation(
  project_id,
  invitee_id,
  role,
) {
  return db.execute({
    sql: `INSERT INTO project_members (project_id, user_cid, role, assigned_at)
              VALUES (?, ?, ?, NOW())
              ON CONFLICT (project_id, user_cid)
              DO UPDATE SET role = ?, assigned_at = NOW()`,
    args: [project_id, invitee_id, role || "member", role || "member"],
  });
}

/** Mark an invitation accepted (accept path). */
export async function acceptProjectInvitation(invitation_id) {
  return db.execute({
    sql: "UPDATE project_invitations SET status = 'accepted', responded_at = NOW() WHERE id = ?",
    args: [parseInt(invitation_id)],
  });
}

/**
 * Project display name for the accept flow (inviter notification message).
 * Byte-identical query to getProjectName; extracted separately so each
 * original inline call site maps 1:1 to a model function.
 */
export async function getProjectNameForInvitation(project_id) {
  return db.execute({
    sql: "SELECT name FROM v2_projects WHERE id::text = ?",
    args: [project_id],
  });
}

/** Cid of the inviter contact (looked up by stored inviter name). */
export async function getContactCidByName(inviter_id) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE name = ? LIMIT 1",
    args: [inviter_id],
  });
}

/** Notify the inviter that their invitation was accepted. */
export async function createInvitationAcceptedNotification(
  recipient_id,
  title,
  message,
  type,
) {
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
    args: [recipient_id, title, message, type],
  });
}
