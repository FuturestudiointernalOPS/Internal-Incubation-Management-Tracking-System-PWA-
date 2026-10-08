import db from "@/lib/db";

// ── GET/POST/PUT /api/investor/relationships ─────────────────────────────────

/** Single relationship workspace detail with pipeline stage + names. */
export async function getRelationshipWorkspaceDetail(workspaceId) {
  return db.execute({
    sql: `SELECT rw.*, ip.stage as pipeline_stage, ipr.organization_name, c.name as investor_name, c.email as investor_email,
                       p.name as venture_name, p.industry, p.country,
                       rm.name as relationship_manager_name, im.name as investment_manager_name
                FROM relationship_workspaces rw
                JOIN investment_pipeline ip ON rw.pipeline_id = ip.id
                LEFT JOIN investor_profiles ipr ON rw.investor_id = ipr.id
                LEFT JOIN contacts c ON ipr.user_id = c.cid
                LEFT JOIN v2_programs p ON rw.venture_id = p.id
                LEFT JOIN contacts rm ON rw.relationship_manager_id = rm.cid
                LEFT JOIN contacts im ON rw.investment_manager_id = im.cid
                WHERE rw.id = ?`,
    args: [workspaceId],
  });
}

/** Meetings attached to one relationship workspace (detail view). */
export async function listWorkspaceMeetings(workspaceId) {
  return db.execute({
    sql: "SELECT * FROM relationship_meetings WHERE workspace_id = ? ORDER BY scheduled_date ASC, scheduled_time ASC",
    args: [workspaceId],
  });
}

/** Timeline entries attached to one relationship workspace. */
export async function listWorkspaceTimeline(workspaceId) {
  return db.execute({
    sql: "SELECT * FROM relationship_timeline WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50",
    args: [workspaceId],
  });
}

/** Relationship workspace list — investor branch or admin branch. */
export async function listRelationshipWorkspaces({ investorId, ventureId }) {
  let sql, args;

  // Scope on the PROFILE, not the role string: a baseline member holding an
  // investor profile is an investor too, and used to fall into the unfiltered
  // (admin) branch — exposing every investor's workspaces.
  if (investorId !== null && investorId !== undefined) {
    sql = `SELECT rw.*, ip.stage as pipeline_stage, p.name as venture_name, p.industry,
                    (SELECT COUNT(*) FROM relationship_meetings WHERE workspace_id = rw.id AND status = 'scheduled')::int as upcoming_meetings
             FROM relationship_workspaces rw
             JOIN investment_pipeline ip ON rw.pipeline_id = ip.id
             LEFT JOIN v2_programs p ON rw.venture_id = p.id
             WHERE rw.investor_id = ?
             ORDER BY rw.updated_at DESC`;
    args = [investorId];
  } else {
    sql = `SELECT rw.*, ip.stage as pipeline_stage, ipr.organization_name, c.name as investor_name,
                    p.name as venture_name, p.industry,
                    rm.name as relationship_manager_name,
                    (SELECT COUNT(*) FROM relationship_meetings WHERE workspace_id = rw.id AND status = 'scheduled')::int as upcoming_meetings
             FROM relationship_workspaces rw
             JOIN investment_pipeline ip ON rw.pipeline_id = ip.id
             LEFT JOIN investor_profiles ipr ON rw.investor_id = ipr.id
             LEFT JOIN contacts c ON ipr.user_id = c.cid
             LEFT JOIN v2_programs p ON rw.venture_id = p.id
             LEFT JOIN contacts rm ON rw.relationship_manager_id = rm.cid
             ORDER BY rw.updated_at DESC`;
    args = [];
  }

  if (ventureId) {
    sql += ventureId ? " AND rw.venture_id = ?" : "";
    if (ventureId) args.push(ventureId);
  }

  return db.execute({ sql, args });
}

/** Pipeline row used to seed a relationship workspace (POST). */
export async function getPipelineById(pipelineId) {
  return db.execute({
    sql: "SELECT * FROM investment_pipeline WHERE id = ?",
    args: [pipelineId],
  });
}

/** Create/activate a relationship workspace for a pipeline. */
export async function upsertRelationshipWorkspace(pipelineId, investorId, ventureId, relationshipManagerId, investmentManagerId) {
  return db.execute({
    sql: `INSERT INTO relationship_workspaces (pipeline_id, investor_id, venture_id, relationship_manager_id, investment_manager_id, status, current_stage)
            VALUES (?, ?, ?, ?, ?, 'active', 'introduction_approved')
            ON CONFLICT (pipeline_id)
            DO UPDATE SET status = 'active', relationship_manager_id = EXCLUDED.relationship_manager_id,
                          investment_manager_id = EXCLUDED.investment_manager_id, current_stage = 'introduction_approved',
                          updated_at = NOW()
            RETURNING *`,
    args: [pipelineId, investorId, ventureId, relationshipManagerId, investmentManagerId],
  });
}

/** Timeline entry for the initial workspace creation. */
export async function insertWorkspaceCreatedTimeline(workspaceId, actorId) {
  return db.execute({
    sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description, actor_id)
            VALUES (?, 'workspace_created', 'Relationship workspace created. Introduction approved.', ?)`,
    args: [workspaceId, actorId],
  });
}

/** Investor user_id resolver for the introduction-approval notification. */
export async function getInvestorUserIdByProfileId(profileId) {
  return db.execute({
    sql: "SELECT user_id FROM investor_profiles WHERE id = ?",
    args: [profileId],
  });
}

/** Notify the investor that their introduction was approved. */
export async function notifyIntroductionApproved(recipientId) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
    args: [
      recipientId,
      "Introduction Approved",
      "Your introduction request has been approved. A Relationship Manager will coordinate your first meeting.",
      "/investor/dashboard?tab=discover",
    ],
  });
}

/** Partial update of a relationship workspace. */
export async function updateRelationshipWorkspace(workspaceId, updates) {
  const sets = [];
  const args = [];

  if (updates.relationship_manager_id) { sets.push("relationship_manager_id = ?"); args.push(updates.relationship_manager_id); }
  if (updates.investment_manager_id) { sets.push("investment_manager_id = ?"); args.push(updates.investment_manager_id); }
  if (updates.status) { sets.push("status = ?"); args.push(updates.status); }
  if (updates.current_stage) { sets.push("current_stage = ?"); args.push(updates.current_stage); }
  if (updates.next_action !== undefined) { sets.push("next_action = ?"); args.push(updates.next_action); }

  if (sets.length === 0) return { updated: false };

  sets.push("updated_at = NOW()");
  args.push(workspaceId);

  return db.execute({
    sql: `UPDATE relationship_workspaces SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
    args,
  });
}

/** Timeline entry when a workspace status changes. */
export async function insertWorkspaceStatusChangedTimeline(workspaceId, description, actorId) {
  return db.execute({
    sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description, actor_id)
              VALUES (?, 'status_changed', ?, ?)`,
    args: [workspaceId, description, actorId],
  });
}

// ── GET/POST/PUT /api/investor/relationships/meetings ────────────────────────

/** Meetings list for one relationship workspace. */
export async function listMeetingsForWorkspace(workspaceId) {
  return db.execute({
    sql: "SELECT * FROM relationship_meetings WHERE workspace_id = ? ORDER BY scheduled_date ASC, scheduled_time ASC",
    args: [workspaceId],
  });
}

/** Create a scheduled relationship meeting. */
export async function insertRelationshipMeeting(workspaceId, meetingType, scheduledDate, scheduledTime, durationMinutes, location, notes) {
  return db.execute({
    sql: `INSERT INTO relationship_meetings (workspace_id, meeting_type, scheduled_date, scheduled_time, duration_minutes, location, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled') RETURNING *`,
    args: [workspaceId, meetingType, scheduledDate, scheduledTime, durationMinutes, location, notes],
  });
}

/** Venture id for a relationship workspace (meeting timeline lookups). */
export async function getVentureIdByWorkspaceId(workspaceId) {
  return db.execute({
    sql: "SELECT venture_id FROM relationship_workspaces WHERE id = ?",
    args: [workspaceId],
  });
}

/** Venture name for a scheduled-meeting timeline description. */
export async function getVentureNameForScheduledMeeting(programId) {
  return db.execute({
    sql: "SELECT name FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Timeline entry when a meeting is scheduled. */
export async function insertMeetingScheduledTimeline(workspaceId, description, actorId) {
  return db.execute({
    sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description, actor_id)
            VALUES (?, 'meeting_scheduled', ?, ?)`,
    args: [workspaceId, description, actorId],
  });
}

/** Partial update of a relationship meeting. */
export async function updateRelationshipMeeting(meetingId, updates) {
  const sets = [];
  const args = [];

  if (updates.status) { sets.push("status = ?"); args.push(updates.status); }
  if (updates.notes !== undefined) { sets.push("notes = ?"); args.push(updates.notes); }
  if (updates.outcome !== undefined) { sets.push("outcome = ?"); args.push(updates.outcome); }
  if (updates.action_items !== undefined) { sets.push("action_items = ?"); args.push(typeof updates.action_items === "string" ? updates.action_items : JSON.stringify(updates.action_items)); }
  if (updates.scheduled_date) { sets.push("scheduled_date = ?"); args.push(updates.scheduled_date); }
  if (updates.scheduled_time !== undefined) { sets.push("scheduled_time = ?"); args.push(updates.scheduled_time); }
  if (updates.location !== undefined) { sets.push("location = ?"); args.push(updates.location); }
  if (updates.meeting_type) { sets.push("meeting_type = ?"); args.push(updates.meeting_type); }

  if (sets.length === 0) return { updated: false };

  sets.push("updated_at = NOW()");
  args.push(meetingId);

  return db.execute({
    sql: `UPDATE relationship_meetings SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
    args,
  });
}

/** Workspace row for a meeting-completed timeline entry. */
export async function getWorkspaceForMeetingCompletion(meetingId) {
  return db.execute({
    sql: "SELECT id, venture_id FROM relationship_workspaces WHERE id = (SELECT workspace_id FROM relationship_meetings WHERE id = ?)",
    args: [meetingId],
  });
}

/** Venture name for a completed-meeting timeline description. */
export async function getVentureNameForCompletedMeeting(programId) {
  return db.execute({
    sql: "SELECT name FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Timeline entry when a meeting is completed. */
export async function insertMeetingCompletedTimeline(workspaceId, description, actorId) {
  return db.execute({
    sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description, actor_id)
                VALUES (?, 'meeting_completed', ?, ?)`,
    args: [workspaceId, description, actorId],
  });
}

/** Persist the first action item as the workspace next_action. */
export async function setWorkspaceNextAction(nextAction, workspaceId) {
  return db.execute({
    sql: "UPDATE relationship_workspaces SET next_action = ?, updated_at = NOW() WHERE id = ?",
    args: [nextAction, workspaceId],
  });
}

// ── GET/POST /api/investor/meetings ──────────────────────────────────────────

/** Investor-meeting events, optionally filtered by venture. */
export async function listInvestorMeetingEvents({ ventureId }) {
  let sql = `SELECT e.*, p.name as venture_name
               FROM v2_events e
               LEFT JOIN v2_programs p ON e.program_id = p.id
               WHERE e.event_type = 'investor_meeting'`;
  const args = [];

  if (ventureId) {
    sql += " AND e.program_id = ?";
    args.push(ventureId);
  }

  sql += " ORDER BY e.start_time DESC";

  return db.execute({ sql, args });
}

/** Schedule an investor-meeting event. */
export async function insertInvestorMeeting(ventureId, title, description, startTime, endTime, location, createdBy) {
  return db.execute({
    sql: `INSERT INTO v2_events (program_id, title, description, event_type, start_time, end_time, location, created_by)
            VALUES (?, ?, ?, 'investor_meeting', ?, ?, ?, ?) RETURNING *`,
    args: [ventureId, title, description, startTime, endTime, location, createdBy],
  });
}
