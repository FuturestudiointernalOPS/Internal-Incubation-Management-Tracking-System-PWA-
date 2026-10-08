import db from "@/lib/db";

/**
 * User ⇄ group membership store — `user_groups` edges and the
 * `group_memberships` history rows behind `/api/user-groups`.
 *
 * Split out of `src/models/groups.js` (see docs/MVC_REFACTOR.md). SQL is
 * byte-identical to the statements that used to live there, so behavior is
 * unchanged; the barrel `@/models/groups` re-exports every name.
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── GET / POST / DELETE /api/user-groups ─────────────────────────────────────

/** Group names + role for one user (user_groups membership rows, by name). */
export async function getUserGroups(userCid) {
  return db.execute({
    sql: "SELECT group_name, role_in_group FROM user_groups WHERE user_cid = ? ORDER BY group_name",
    args: [userCid],
  });
}

/** Legacy fallback: the single group_name column on the user's contact row. */
export async function getContactLegacyGroup(cid) {
  return db.execute({
    sql: "SELECT group_name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Assign a user to a group (idempotent user_groups upsert by admin). */
export async function assignUserToGroup(user_cid, group_name) {
  return db.execute({
    sql: `INSERT INTO user_groups (user_cid, group_name, assigned_by)
            VALUES (?, ?, 'admin')
            ON CONFLICT (user_cid, group_name) DO NOTHING`,
    args: [user_cid, group_name],
  });
}

/** Open a group membership record (join history for the membership layer). */
export async function createGroupMembership(
  user_cid,
  group_name,
  started_at,
  expires_at,
  status,
  created_by,
) {
  return db.execute({
    sql: `INSERT INTO group_memberships
                (user_cid, group_name, started_at, expires_at, status, created_by)
              VALUES (?, ?, ?, ?, ?, ?)`,
    args: [user_cid, group_name, started_at, expires_at, status, created_by],
  });
}

/** Record the join event for a group membership (legacy group API note). */
export async function createGroupMembershipEvent(
  user_cid,
  group_name,
  action,
  actor_cid,
  note,
) {
  return db.execute({
    sql: `INSERT INTO group_membership_events
                (user_cid, group_name, action, actor_cid, note)
              VALUES (?, ?, ?, ?, ?)`,
    args: [user_cid, group_name, action, actor_cid, note],
  });
}

/** Remove a user from a group (user_groups edge only — history is kept). */
export async function unassignUserFromGroup(user_cid, group_name) {
  return db.execute({
    sql: "DELETE FROM user_groups WHERE user_cid = ? AND group_name = ?",
    args: [user_cid, group_name],
  });
}

/** End (never delete) a user's group membership record. */
export async function endGroupMembership(updated_by, user_cid, group_name) {
  return db.execute({
    sql: `UPDATE group_memberships
              SET status = 'ended', updated_by = ?, updated_at = NOW()
              WHERE user_cid = ? AND group_name = ?`,
    args: [updated_by, user_cid, group_name],
  });
}

/** Record the end event for a group membership (legacy group API note). */
export async function createGroupMembershipEndEvent(user_cid, group_name, actor_cid) {
  return db.execute({
    sql: `INSERT INTO group_membership_events
                (user_cid, group_name, action, actor_cid, note)
              VALUES (?, ?, 'ended', ?, 'legacy group API')`,
    args: [user_cid, group_name, actor_cid],
  });
}
