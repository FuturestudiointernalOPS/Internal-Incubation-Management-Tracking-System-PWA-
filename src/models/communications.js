import db from "@/lib/db";

/**
 * Communications model — data access for the internal-comms, announcements,
 * followups, campaigns and events controllers
 * (`src/app/api/internal-comms/route.js`, `src/app/api/announcements/route.js`,
 *  `src/app/api/followups/route.js`, `src/app/api/campaigns/route.js`,
 *  `src/app/api/campaigns/[id]/route.js`, `src/app/api/events/route.js`).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 *
 * Note: extraction is strictly 1:1 with the original inline call sites, so a
 * handful of lookups (e.g. the same notification INSERT running for direct,
 * group and program recipients, or the same "ensure column" ALTER appearing in
 * multiple handlers) intentionally repeat the same SQL across functions.
 */

// ── /api/internal-comms ──────────────────────────────────────────────────────

// Message-scope resolution helpers (group/program recipient resolution)

/** All FUTURE STUDIO staff member cids (role target '__staff__'). */
export async function getStaffMemberCids() {
  return db.execute({
    sql: `SELECT cid FROM contacts WHERE UPPER(TRIM(group_name)) = 'FUTURE STUDIO' OR role IN ('staff', 'developer', 'intern', 'admin', 'super_admin')`,
    args: [],
  });
}

/** Family row for a role/group target id (looked up by id::text). */
export async function findFamilyByIdText(targetId) {
  return db.execute({
    sql: "SELECT name, program_id FROM families WHERE id::text = ?",
    args: [String(targetId)],
  });
}

/** Contact cids whose group name matches a family name. */
export async function getContactsByFamilyGroupName(familyName) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE UPPER(TRIM(group_name)) = ?",
    args: [String(familyName).toUpperCase()],
  });
}

/** User-group cids whose group name matches a family name. */
export async function getUserGroupCidsByGroupName(familyName) {
  return db.execute({
    sql: "SELECT user_cid FROM user_groups WHERE UPPER(TRIM(group_name)) = ?",
    args: [String(familyName).toUpperCase()],
  });
}

/** Participant ids enrolled in a program (program-target recipients). */
export async function getParticipantIdsByProgramId(programId) {
  return db.execute({
    sql: "SELECT participant_id FROM participant_programs WHERE program_id::text = ?",
    args: [String(programId)],
  });
}

/** Staff ids assigned to a program (program-target recipients). */
export async function getProgramStaffIdsByProgramId(programId) {
  return db.execute({
    sql: "SELECT staff_id FROM v2_program_staff WHERE program_id::text = ?",
    args: [String(programId)],
  });
}

/** PM + assistant assignments for a program (program-target recipients). */
export async function getProgramAssigneeIdsByProgramId(programId) {
  return db.execute({
    sql: "SELECT assigned_pm_id, assigned_assistant_id FROM v2_programs WHERE id::text = ?",
    args: [String(programId)],
  });
}

/** Legacy contact cids carrying a program_id (program-target recipients). */
export async function getLegacyContactsByProgramId(programId) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE program_id::text = ?",
    args: [String(programId)],
  });
}

/** A user's contact row used to derive their message scope. */
export async function getContactMessageScopeById(cid) {
  return db.execute({
    sql: "SELECT group_name, role, program_id FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Group names a user belongs to via user_groups. */
export async function getUserGroupNamesByCid(cid) {
  return db.execute({
    sql: "SELECT group_name FROM user_groups WHERE user_cid = ?",
    args: [cid],
  });
}

/** Families whose trimmed, uppercased name matches one of the user's groups. */
export async function findFamiliesByMatchingGroupNames(groupNames) {
  const placeholders = groupNames.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT id, program_id FROM families WHERE UPPER(TRIM(name)) IN (${placeholders})`,
    args: groupNames.map((g) => String(g).toUpperCase()),
  });
}

/** Program ids where the user is the assigned PM or appears as assistant. */
export async function getProgramIdsAssignedToUser(cid) {
  return db.execute({
    sql: "SELECT id::text AS id FROM v2_programs WHERE assigned_pm_id = ? OR assigned_assistant_id LIKE ?",
    args: [cid, `%${cid}%`],
  });
}

/** Program ids the user is staff on (cid or email match). */
export async function getProgramIdsForProgramStaff(cid, email) {
  return db.execute({
    sql: "SELECT program_id::text AS id FROM v2_program_staff WHERE staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?)",
    args: [cid, email || ""],
  });
}

/** Program ids for teams the user handles. */
export async function getProgramIdsForTeamHandler(cid) {
  return db.execute({
    sql: "SELECT program_id::text AS id FROM v2_teams WHERE handler_id = ?",
    args: [cid],
  });
}

/** Family ids linked to any of the given program ids. */
export async function findFamilyIdsByProgramIds(programIds) {
  const placeholders = programIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT id FROM families WHERE program_id IN (${placeholders})`,
    args: programIds,
  });
}

// GET /api/internal-comms

/** Safe migration: ensure v2_messages.is_deleted exists. */
export async function ensureMessagesIsDeletedColumn() {
  return db.execute(
    "ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0",
  );
}

/**
 * GET /api/internal-comms — inbox rows for the requester's visibility scope.
 * SA sees everything (individual + broadcasts); other users see their own
 * individual messages plus group/program messages for the groups/programs
 * they belong to. Broadcasts stay SA-only.
 */
export async function listMessagesForScope({
  isSuperAdmin,
  targetCid,
  groupIds,
  programIds,
  isFutureStudioStaff,
}) {
  let query = "SELECT * FROM v2_messages";
  let args = [];

  if (isSuperAdmin) {
    // SA sees everything (individual + broadcasts)
    query = "SELECT * FROM v2_messages";
    args = [];
    if (targetCid) {
      query +=
        " WHERE (recipient_id = ? OR sender_id = ? OR target_type = 'all')";
      args = [targetCid, targetCid];
    }
  } else {
    // Users see their own individual messages + group/program messages
    // for the groups/programs they belong to. Broadcasts stay SA-only.
    const visibility = ["(recipient_id = ? OR sender_id = ?)"];
    const visArgs = [targetCid, targetCid];

    if (isFutureStudioStaff) {
      visibility.push("(target_type = 'role' AND target_id = '__staff__')");
    }
    if (groupIds.length > 0) {
      visibility.push(
        `(target_type = 'role' AND target_id IN (${groupIds
          .map(() => "?")
          .join(",")}))`,
      );
      visArgs.push(...groupIds);
    }
    if (programIds.length > 0) {
      visibility.push(
        `(target_type = 'program' AND target_id IN (${programIds
          .map(() => "?")
          .join(",")}))`,
      );
      visArgs.push(...programIds);
    }

    query = `SELECT * FROM v2_messages WHERE (${visibility.join(" OR ")})`;
    args = visArgs;
  }

  query +=
    " AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY created_at DESC";

  return db.execute({ sql: query, args });
}

// POST /api/internal-comms

/** Safe migration: ensure v2_messages.is_read exists (before insert). */
export async function ensureMessagesIsReadColumn() {
  return db.execute(
    "ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS is_read INTEGER DEFAULT 0",
  );
}

/** Safe migration: ensure v2_messages.attachment_url exists. */
export async function ensureMessagesAttachmentUrlColumn() {
  return db.execute(
    "ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT",
  );
}

/** Safe migration: ensure v2_messages.attachment_name exists. */
export async function ensureMessagesAttachmentNameColumn() {
  return db.execute(
    "ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT",
  );
}

/** Insert a new message and return its id. */
export async function createMessage({
  senderId,
  recipientId,
  targetType,
  targetId,
  subject,
  body,
  priority,
  attachmentUrl,
  attachmentName,
}) {
  return db.execute({
    sql: "INSERT INTO v2_messages (sender_id, recipient_id, target_type, target_id, subject, body, priority, is_read, attachment_url, attachment_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    args: [
      senderId,
      recipientId || null,
      targetType || "individual",
      targetId || null,
      subject,
      body,
      priority || "normal",
      0,
      attachmentUrl || null,
      attachmentName || null,
    ],
  });
}

/** Contact display name for a sender (looked up by cid or legacy id). */
export async function getSenderNameByCidOrId(identifier) {
  return db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ? OR id = ?",
    args: [identifier, identifier],
  });
}

/** Notify a direct message recipient. */
export async function insertDirectMessageNotification(recipientId, title, message) {
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, ?)",
    args: [recipientId, title, message, "message"],
  });
}

/** Notify one member of a role/group-target message. */
export async function insertGroupMessageNotification(memberId, title, message) {
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, ?)",
    args: [memberId, title, message, "message"],
  });
}

/** Notify one member of a program-target message. */
export async function insertProgramMessageNotification(memberId, title, message) {
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, ?)",
    args: [memberId, title, message, "message"],
  });
}

// PUT /api/internal-comms

/** Safe migration: ensure v2_messages.is_read exists (before mark-read). */
export async function ensureMessagesIsReadColumnForMarkRead() {
  return db.execute(
    "ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS is_read INTEGER DEFAULT 0",
  );
}

/** Mark a list of message ids as read ($1..$n placeholders). */
export async function markMessagesReadByIds(messageIds) {
  const placeholders = messageIds.map((_, i) => `$${i + 1}`).join(",");
  return db.execute({
    sql: `UPDATE v2_messages SET is_read = 1 WHERE id IN (${placeholders})`,
    args: messageIds,
  });
}

/** Mark a user's message-type notifications as read. */
export async function markMessageNotificationsRead(sessionCid) {
  return db.execute({
    sql: "UPDATE v2_notifications SET is_read = 1 WHERE recipient_id = ? AND type = 'message' AND is_read = 0",
    args: [sessionCid],
  });
}

/** Mark all unread messages between a sender and recipient as read. */
export async function markConversationMessagesRead(senderId, recipientId) {
  return db.execute({
    sql: "UPDATE v2_messages SET is_read = 1 WHERE sender_id = ? AND recipient_id = ? AND (is_read IS NULL OR is_read = 0)",
    args: [senderId, recipientId],
  });
}

// ── /api/announcements ───────────────────────────────────────────────────────

/** Safe migration: ensure v2_announcements exists (GET path). */
export async function ensureAnnouncementsTable() {
  return db.execute(`
        CREATE TABLE IF NOT EXISTS v2_announcements (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL DEFAULT '',
          target_type TEXT NOT NULL DEFAULT 'all',
          target_id TEXT,
          is_pinned BOOLEAN DEFAULT false,
          is_archived BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
}

/**
 * GET /api/announcements — announcement rows for the requested audience:
 * admin sees everything including archived, otherwise active rows (optionally
 * filtered to a specific target audience + global announcements).
 */
export async function listAnnouncements({
  showAll,
  isSuperAdmin,
  targetType,
  targetId,
}) {
  let query;
  let args = [];

  if (showAll && isSuperAdmin) {
    // Admin: return everything including archived
    query =
      "SELECT * FROM v2_announcements ORDER BY is_pinned DESC, created_at DESC";
  } else if (targetType && targetId) {
    // Specific audience + global announcements
    query = `SELECT * FROM v2_announcements
        WHERE is_archived = false
          AND (target_type = 'all' OR (target_type = ? AND target_id = ?))
        ORDER BY is_pinned DESC, created_at DESC`;
    args = [targetType, targetId];
  } else {
    // Return all active announcements (for dashboards)
    query = `SELECT * FROM v2_announcements
        WHERE is_archived = false
        ORDER BY is_pinned DESC, created_at DESC`;
  }

  return db.execute({ sql: query, args });
}

/** Safe migration: ensure v2_announcements exists (POST path). */
export async function ensureAnnouncementsTableForInsert() {
  return db.execute(`
        CREATE TABLE IF NOT EXISTS v2_announcements (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL DEFAULT '',
          target_type TEXT NOT NULL DEFAULT 'all',
          target_id TEXT,
          is_pinned BOOLEAN DEFAULT false,
          is_archived BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
}

/** Create an announcement and return its id. */
export async function createAnnouncement({
  title,
  body,
  authorId,
  authorName,
  targetType,
  targetId,
  isPinned,
}) {
  return db.execute({
    sql: `INSERT INTO v2_announcements (title, body, author_id, author_name, target_type, target_id, is_pinned)
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      title,
      body,
      authorId,
      authorName,
      targetType || "all",
      targetId || null,
      isPinned ? true : false,
    ],
  });
}

/** Organization-wide announcement notification for every active user. */
export async function notifyAllActiveUsersOfAnnouncement(title, body) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                SELECT cid, ?, ?, 'announcement', 0, NOW() FROM users WHERE status = 'active'`,
    args: [title, body],
  });
}

/** Announcement notification for all active members of a target group. */
export async function notifyAnnouncementGroupMembers(title, body, groupName) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                SELECT gm.user_id, ?, ?, 'announcement', 0, NOW()
                FROM v2_group_members gm
                INNER JOIN users u ON u.cid = gm.user_id AND u.status = 'active'
                WHERE gm.group_name = ?`,
    args: [title, body, groupName],
  });
}

/** Announcement author_id for ownership checks. */
export async function getAnnouncementAuthorById(id) {
  return db.execute({
    sql: "SELECT author_id FROM v2_announcements WHERE id = ?",
    args: [id],
  });
}

/**
 * PUT /api/announcements — partial update of the editable announcement
 * fields. Only the fields provided (non-undefined) are included; the caller
 * guarantees at least one field is present.
 */
export async function updateAnnouncementFields({ id, is_archived, is_pinned, title, body }) {
  // Build update
  const updates = [];
  const args = [];
  if (is_archived !== undefined) {
    updates.push("is_archived = ?");
    args.push(is_archived);
  }
  if (is_pinned !== undefined) {
    updates.push("is_pinned = ?");
    args.push(is_pinned);
  }
  if (title !== undefined) {
    updates.push("title = ?");
    args.push(title);
  }
  if (body !== undefined) {
    updates.push("body = ?");
    args.push(body);
  }

  updates.push("updated_at = NOW()");
  args.push(id);

  return db.execute({
    sql: `UPDATE v2_announcements SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });
}

/** Announcement author_id for ownership checks (DELETE path). */
export async function getAnnouncementAuthorByIdForDelete(id) {
  return db.execute({
    sql: "SELECT author_id FROM v2_announcements WHERE id = ?",
    args: [id],
  });
}

/** Soft-archive an announcement. */
export async function archiveAnnouncementById(id) {
  return db.execute({
    sql: "UPDATE v2_announcements SET is_archived = true, updated_at = NOW() WHERE id = ?",
    args: [id],
  });
}

// ── /api/followups ───────────────────────────────────────────────────────────

/** Safe migration: ensure v2_followups.created_by exists. */
export async function ensureFollowupsCreatedByColumn() {
  return db.execute("ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS created_by TEXT");
}

/**
 * GET /api/followups — follow-up rows with participant/deliverable names,
 * filtered by query params and the requester's visibility role.
 */
export async function listFollowups({
  programId,
  participantId,
  submissionId,
  status,
  session,
}) {
  let sql = `
      SELECT f.*, c.name as participant_name, d.title as deliverable_title
      FROM v2_followups f
      LEFT JOIN contacts c ON f.participant_id::text = c.cid
      LEFT JOIN v2_submissions s ON f.submission_id = s.id
      LEFT JOIN v2_deliverables d ON s.deliverable_id = d.id
      WHERE 1=1
    `;
  const args = [];

  if (programId) {
    sql += " AND f.program_id = ?";
    args.push(programId);
  }
  if (participantId) {
    sql += " AND f.participant_id = ?";
    args.push(participantId);
  }
  if (submissionId) {
    sql += " AND f.submission_id = ?";
    args.push(submissionId);
  }
  if (status) {
    sql += " AND f.status = ?";
    args.push(status);
  }

  // Visibility: super_admin sees all; participants see their own; everyone
  // else sees follow-ups they assigned. Legacy rows (created_by NULL) remain
  // visible to non-participant staff so historical data is not lost.
  if (session?.role === "participant") {
    sql += " AND f.participant_id = ?";
    args.push(session.cid);
  } else if (session?.role !== "super_admin") {
    sql += " AND (f.created_by IS NULL OR f.created_by = ?)";
    args.push(session.cid);
  }

  sql += " ORDER BY f.scheduled_at DESC";

  return db.execute({ sql, args });
}

/**
 * Check whether a participant belongs to one of the facilitator's teams
 * (POST follow-up scope guard).
 */
export async function isContactInFacilitatorTeams(participantId, teamIds) {
  return db.execute({
    sql: "SELECT 1 FROM contacts c WHERE c.cid = ? AND c.v2_team_id IN (" + teamIds.map(() => "?").join(",") + ")",
    args: [String(participantId), ...teamIds],
  });
}

/** Create a follow-up record and return the full row. */
export async function insertFollowup({
  programId,
  participantId,
  submissionId,
  weekNumber,
  comment,
  scheduledAt,
  durationMinutes,
  meetingLink,
  notes,
  createdBy,
}) {
  return db.execute({
    sql: `INSERT INTO v2_followups (
          program_id, participant_id, submission_id, week_number,
          comment, scheduled_at, duration_minutes, meeting_link, notes, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?) RETURNING *`,
    args: [
      programId,
      participantId || null,
      submissionId || null,
      weekNumber || null,
      comment || null,
      scheduledAt,
      durationMinutes || 30,
      meetingLink || null,
      notes || null,
      createdBy || null,
    ],
  });
}

/** Mirror a follow-up as a calendar event in v2_events (non-blocking). */
export async function insertFollowupCalendarEvent({
  programId,
  title,
  description,
  startTime,
  endTime,
  participantId,
  createdBy,
}) {
  return db.execute({
    sql: `INSERT INTO v2_events (program_id, title, description, event_type, start_time, end_time, participant_id, created_by)
              VALUES (?, ?, ?, 'followup', ?, ?, ?, ?)`,
    args: [
      programId,
      title,
      description,
      startTime,
      endTime,
      participantId || null,
      createdBy || "staff",
    ],
  });
}

/** Flag a linked submission as pending follow-up. */
export async function markSubmissionPendingFollowup(submissionId) {
  return db.execute({
    sql: "UPDATE v2_submissions SET status = 'pending_followup', updated_at = NOW() WHERE id = ?",
    args: [submissionId],
  });
}

/** Follow-up program/participant for scope checks (PATCH path). */
export async function getFollowupById(id) {
  return db.execute({
    sql: "SELECT program_id, participant_id FROM v2_followups WHERE id = ?",
    args: [id],
  });
}

/**
 * Check whether a participant belongs to one of the facilitator's teams
 * (PATCH follow-up scope guard).
 */
export async function isContactInFacilitatorTeamsForUpdate(participantId, teamIds) {
  return db.execute({
    sql: "SELECT 1 FROM contacts c WHERE c.cid = ? AND c.v2_team_id IN (" + teamIds.map(() => "?").join(",") + ")",
    args: [String(participantId), ...teamIds],
  });
}

/** Update a follow-up's editable fields (COALESCE per provided field). */
export async function updateFollowup({
  id,
  status,
  notes,
  meetingLink,
  scheduledAt,
}) {
  return db.execute({
    sql: `UPDATE v2_followups SET
              status = COALESCE(?, status),
              notes = COALESCE(?, notes),
              meeting_link = COALESCE(?, meeting_link),
              scheduled_at = COALESCE(?, scheduled_at)
            WHERE id = ?`,
    args: [
      status || null,
      notes || null,
      meetingLink || null,
      scheduledAt || null,
      id,
    ],
  });
}

// ── /api/campaigns (retired) ─────────────────────────────────────────────────

/** Campaign list with contact + step counts (dead while RETIRED). */
export async function listCampaignsWithStats() {
  return db.execute(`
    SELECT c.*,
           COUNT(cc.id) as total_contacts,
           SUM(CASE WHEN cc.status != 'pending' THEN 1 ELSE 0 END) as sent_contacts,
           (SELECT COUNT(*) FROM campaign_steps cs WHERE cs.campaign_id = c.id) as total_steps
    FROM campaigns c
    LEFT JOIN campaign_contacts cc ON c.id = cc.campaign_id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);
}

/** Insert a pending campaign and return its id. */
export async function insertCampaign(name, formId) {
  return db.execute({
    sql: "INSERT INTO campaigns (name, form_id, status) VALUES (?, ?, 'pending') RETURNING id",
    args: [name, formId || null],
  });
}

// /api/campaigns/[id] (retired)

/** Single campaign with contact counts by id. */
export async function getCampaignWithCounts(id) {
  return db.execute({
    sql: `SELECT c.*,
                   COUNT(cc.id) as total_contacts,
                   SUM(CASE WHEN cc.status != 'pending' THEN 1 ELSE 0 END) as sent_contacts
            FROM campaigns c
            LEFT JOIN campaign_contacts cc ON c.id = cc.campaign_id
            WHERE c.id = ?
            GROUP BY c.id`,
    args: [id],
  });
}

/** Campaign steps ordered by step_order. */
export async function getCampaignSteps(id) {
  return db.execute({
    sql: "SELECT * FROM campaign_steps WHERE campaign_id = ? ORDER BY step_order",
    args: [id],
  });
}

/** Campaign contacts (contact_cid + status). */
export async function getCampaignContacts(id) {
  return db.execute({
    sql: "SELECT contact_cid, status FROM campaign_contacts WHERE campaign_id = ?",
    args: [id],
  });
}

/** Update a campaign's name/form_id. */
export async function updateCampaign({ id, name, formId }) {
  return db.execute({
    sql: "UPDATE campaigns SET name = ?, form_id = ? WHERE id = ?",
    args: [name, formId || null, id],
  });
}

/** Delete every step of a campaign (before re-inserting the new sequence). */
export async function deleteCampaignSteps(campaignId) {
  return db.execute({
    sql: "DELETE FROM campaign_steps WHERE campaign_id = ?",
    args: [campaignId],
  });
}

/** Existing contact_cids of a campaign (sync target-audience diffing). */
export async function getCampaignContactCids(campaignId) {
  return db.execute({
    sql: "SELECT contact_cid FROM campaign_contacts WHERE campaign_id = ?",
    args: [campaignId],
  });
}

/** Remove campaign contacts that were dropped from the target audience. */
export async function deleteCampaignContacts(campaignId, contactCids) {
  return db.execute({
    sql: `DELETE FROM campaign_contacts WHERE campaign_id = ? AND contact_cid IN (${contactCids.map(() => "?").join(",")}) AND status != 'sent'`,
    args: [campaignId, ...contactCids],
  });
}

// ── /api/events ──────────────────────────────────────────────────────────────

/** Event rows, optionally filtered by program_id. */
export async function listEvents({ programId }) {
  let sql = "SELECT * FROM v2_events";
  let args = [];

  if (programId) {
    sql += " WHERE program_id = ?";
    args.push(programId);
  }

  return db.execute({ sql, args });
}

/** Create an event and return the full row. */
export async function insertEvent({
  programId,
  title,
  description,
  eventType,
  startTime,
  endTime,
  location,
  createdBy,
}) {
  return db.execute({
    sql: `INSERT INTO v2_events (program_id, title, description, event_type, start_time, end_time, location, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [
      programId,
      title,
      description,
      eventType || "meeting",
      startTime,
      endTime || null,
      location || null,
      createdBy,
    ],
  });
}

/** Notify a participant that a meeting event was scheduled. */
export async function insertEventNotification(recipientId, title, message) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, 'event', 0, NOW())`,
    args: [recipientId, title, message],
  });
}
