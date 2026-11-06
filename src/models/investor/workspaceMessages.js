import db from "@/lib/db";

export async function listWorkspaceMessages(workspaceId) {
  return db.execute({
    sql: `SELECT m.id, m.sender_id, m.body, m.created_at, m.is_read,
         c.name AS sender_name
            FROM v2_messages m
            LEFT JOIN contacts c ON c.cid = m.sender_id
           WHERE m.target_type = 'investor_workspace' AND m.target_id = ?
             AND (m.is_deleted IS NULL OR m.is_deleted = 0)
           ORDER BY m.created_at ASC, m.id ASC
           LIMIT 500`,
    args: [String(workspaceId)],
  });
}

export async function insertWorkspaceMessage({ workspaceId, senderId, body }) {
  return db.execute({
    sql: `INSERT INTO v2_messages
            (sender_id, recipient_id, target_type, target_id, subject, body, priority, is_read)
          VALUES (?, NULL, 'investor_workspace', ?, NULL, ?, 'normal', 0)
          RETURNING id, sender_id, body, created_at, is_read`,
    args: [String(senderId), String(workspaceId), body],
  });
}

export async function markWorkspaceMessagesRead({ workspaceId, readerId }) {
  return db.execute({
    sql: `UPDATE v2_messages
             SET is_read = 1
           WHERE target_type = 'investor_workspace' AND target_id = ?
             AND sender_id <> ? AND (is_read IS NULL OR is_read = 0)
          RETURNING id`,
    args: [String(workspaceId), String(readerId)],
  });
}

export async function countUnreadWorkspaceMessages({ workspaceIds, readerId }) {
  const ids = (workspaceIds || []).map(String).filter(Boolean);
  if (ids.length === 0 || !readerId) return { rows: [{ unread_count: 0 }] };
  const placeholders = ids.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT COUNT(*)::int AS unread_count
            FROM v2_messages m
            JOIN relationship_workspaces rw ON rw.id::text = m.target_id AND rw.status = 'active'
           WHERE m.target_type = 'investor_workspace'
             AND m.target_id IN (${placeholders})
             AND m.sender_id <> ?
             AND (m.is_read IS NULL OR m.is_read = 0)
             AND (m.is_deleted IS NULL OR m.is_deleted = 0)`,
    args: [...ids, String(readerId)],
  });
}

export async function listUnreadWorkspaceMessageReminders() {
  return db.execute({
    sql: `SELECT DISTINCT ON (m.target_id)
                 rw.id AS workspace_id, ip.id AS investor_profile_id, rw.venture_id,
                 m.id AS message_id, m.sender_id, m.created_at,
                 investor.cid AS investor_cid, investor.email AS investor_email,
                 investor.name AS investor_name, investor.language AS investor_language,
                 founder.cid AS founder_cid, founder.email AS founder_email,
                 founder.name AS founder_name, founder.language AS founder_language,
                 CASE WHEN m.sender_id = investor.cid THEN founder.cid ELSE investor.cid END AS recipient_cid,
                 CASE WHEN m.sender_id = investor.cid THEN founder.email ELSE investor.email END AS recipient_email,
                 CASE WHEN m.sender_id = investor.cid THEN founder.name ELSE investor.name END AS recipient_name,
                 CASE WHEN m.sender_id = investor.cid THEN founder.language ELSE investor.language END AS recipient_language,
                 CASE WHEN m.sender_id = investor.cid THEN 'founder' ELSE 'investor' END AS recipient_type,
                 COALESCE(sender.name, m.sender_id) AS sender_name
            FROM v2_messages m
            JOIN relationship_workspaces rw ON rw.id::text = m.target_id AND rw.status = 'active'
            JOIN investor_profiles ip ON ip.id = rw.investor_id
            JOIN contacts investor ON investor.cid = ip.user_id
            LEFT JOIN LATERAL (
              SELECT c.cid, c.email, c.name, c.language
                FROM venture_members vm
                JOIN contacts c ON c.cid = COALESCE(NULLIF(vm.contact_id, ''), vm.user_cid)
               WHERE vm.removed_at IS NULL
                 AND (vm.member_type = 'founder' OR vm.role IN ('founder', 'co-founder'))
                 AND CAST(vm.venture_id AS TEXT) = CAST(rw.venture_id AS TEXT)
               ORDER BY c.cid
               LIMIT 1
            ) founder ON TRUE
            LEFT JOIN contacts sender ON sender.cid = m.sender_id
           WHERE m.target_type = 'investor_workspace'
             AND (m.is_read IS NULL OR m.is_read = 0)
             AND m.created_at <= NOW() - INTERVAL '6 hours'
             AND (
               (m.sender_id = investor.cid AND founder.cid IS NOT NULL AND founder.email IS NOT NULL)
               OR (m.sender_id = founder.cid AND investor.email IS NOT NULL)
             )
           ORDER BY m.target_id, m.created_at ASC`,
    args: [],
  });
}

export async function claimWorkspaceMessageReminder({ workspaceId, recipientCid }) {
  return db.execute({
    sql: `INSERT INTO investor_message_reminder_claims (workspace_id, window_start, recipient_cid)
          VALUES (?, to_timestamp(floor(extract(epoch FROM NOW()) / 21600) * 21600), ?)
          ON CONFLICT (workspace_id, window_start) DO NOTHING
          RETURNING id`,
    args: [String(workspaceId), String(recipientCid)],
  });
}

export async function markWorkspaceMessageReminderSent(claimId) {
  return db.execute({
    sql: "UPDATE investor_message_reminder_claims SET sent_at = NOW() WHERE id = ?",
    args: [claimId],
  });
}

export async function releaseWorkspaceMessageReminder(claimId) {
  return db.execute({
    sql: "DELETE FROM investor_message_reminder_claims WHERE id = ? AND sent_at IS NULL",
    args: [claimId],
  });
}
