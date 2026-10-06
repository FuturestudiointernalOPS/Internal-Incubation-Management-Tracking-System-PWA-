import db from "@/lib/db";

// ── POST/GET /api/investor/pipeline ─────────────────────────────────────────

/** pipeline POST — investor profile id of the current user. */
export async function getInvestorProfileIdByUserId(userCid) {
  return db.execute({
    sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
    args: [userCid],
  });
}

/**
 * The APPROVED investor context of a person, if any.
 *
 * Used by the login landing, the personal sidebar and the workspaces hub to
 * recognise someone who has been MADE an investor even when their global
 * identity is still the baseline "member" — the profile is the entitlement,
 * not the legacy role string. Approval is required: a pending or rejected
 * application is not a context yet.
 */
export async function getApprovedInvestorProfileIdByUserId(userCid) {
  return db.execute({
    sql: "SELECT id FROM investor_profiles WHERE user_id = ? AND approval_status = 'approved' LIMIT 1",
    args: [userCid],
  });
}

/** pipeline POST — upsert the investment pipeline entry. */
export async function upsertInvestmentPipeline({ investor_id, venture_id, stage, notes }) {
  return db.execute({
    sql: `INSERT INTO investment_pipeline (investor_id, venture_id, stage, notes, stage_changed_at)
            VALUES (?, ?, ?, ?, NOW())
            ON CONFLICT (investor_id, venture_id)
            DO UPDATE SET stage = EXCLUDED.stage, notes = EXCLUDED.notes,
                          stage_changed_at = NOW(), updated_at = NOW()
            RETURNING *`,
    args: [investor_id, venture_id, stage, notes || null],
  });
}

/** pipeline POST — investor/venture names for the meeting-request notification. */
export async function getMeetingRequestInfo({ venture_id, investor_id }) {
  return db.execute({
    sql: `SELECT c.name as investor_name, ipr.organization_name, p.name as venture_name
                FROM investor_profiles ipr
                JOIN contacts c ON ipr.user_id = c.cid
                LEFT JOIN v2_programs p ON p.id = ?
                WHERE ipr.id = ?`,
    args: [venture_id, investor_id],
  });
}

/** pipeline POST — super admin recipients for meeting-request notifications. */
export async function listSuperAdminCids() {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE role = 'super_admin' AND deleted_at IS NULL",
    args: [],
  });
}

/** pipeline POST — notify a super admin of a meeting (introduction) request. */
export async function insertInvestorMeetingRequestNotification({ recipient_id, investor_name, organization_name, venture_name, notes, link }) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                  VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
    args: [
      recipient_id,
      `Introduction Request: ${venture_name || "Venture"}`,
      `${investor_name || "Investor"} (${organization_name || "Individual"}) requested an introduction to ${venture_name || "a venture"}.${notes ? ` Message: "${notes.length > 100 ? notes.substring(0, 100) + '...' : notes}"` : ""}`,
      link,
    ],
  });
}

/** pipeline POST — calendar placeholder event for a requested meeting. */
export async function insertInvestorMeetingPlaceholderEvent({ program_id, venture_name, investor_name, organization_name, start_time, end_time, created_by }) {
  return db.execute({
    sql: `INSERT INTO v2_events (program_id, team_id, title, description, event_type, start_time, end_time, location, created_by)
                VALUES (?, NULL, ?, ?, 'investor_meeting', ?, ?, 'TBD', ?)`,
    args: [
      program_id,
      `Meeting: ${venture_name || "Venture"} — ${investor_name || "Investor"}`,
      `Meeting requested by ${investor_name || "Investor"} (${organization_name || "Individual"}) for ${venture_name || "venture"}. Pending confirmation.`,
      start_time,
      end_time,
      created_by,
    ],
  });
}

/** pipeline POST — auto-create the 'invest' decision on stage invested. */
export async function createInvestmentDecision({ pipeline_id, investment_amount, notes }) {
  return db.execute({
    sql: `INSERT INTO investment_decisions (pipeline_id, decision_type, decision_date, investment_amount, decision_notes)
              VALUES (?, 'invest', CURRENT_DATE, ?, ?)
              ON CONFLICT (pipeline_id) DO NOTHING
              RETURNING *`,
    args: [pipeline_id, investment_amount > 0 ? investment_amount : null, notes || null],
  });
}

/** pipeline POST — add committed amount to the active fundraising campaign. */
export async function addInvestmentToActiveCampaign({ amount, venture_id }) {
  return db.execute({
    sql: `UPDATE fundraising_campaigns
                  SET current_raised = COALESCE(current_raised, 0) + ?,
                      status = CASE WHEN COALESCE(current_raised, 0) + ? >= target_raise THEN 'closed' ELSE status END,
                      updated_at = NOW()
                  WHERE venture_id = ? AND status = 'active'`,
    args: [amount, amount, venture_id],
  });
}

/** pipeline POST — relationship workspace id for the investment timeline entry. */
export async function getRelationshipWorkspaceIdForInvestment(pipelineId) {
  return db.execute({
    sql: "SELECT id FROM relationship_workspaces WHERE pipeline_id = ?",
    args: [pipelineId],
  });
}

/** pipeline POST — 'investment_committed' timeline event. */
export async function insertInvestmentCommittedTimeline({ workspace_id, investment_amount }) {
  return db.execute({
    sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description)
                  VALUES (?, 'investment_committed', ?)`,
    args: [workspace_id, `Investment committed${investment_amount > 0 ? ' — $' + investment_amount.toLocaleString() : ''}`],
  });
}

/** pipeline POST — flip the relationship workspace into an active investment. */
export async function markRelationshipWorkspaceActiveInvestment(workspaceId) {
  return db.execute({
    sql: "UPDATE relationship_workspaces SET current_stage = 'active_investment', updated_at = NOW() WHERE id = ?",
    args: [workspaceId],
  });
}

/** pipeline POST — investor/venture/contact info for investment notifications. */
export async function getInvestmentNotificationInfo({ venture_id, investor_id }) {
  return db.execute({
    sql: `SELECT c.name as investor_name, c.email, ipr.organization_name, p.name as venture_name, ipr.user_id
                FROM investor_profiles ipr
                JOIN contacts c ON ipr.user_id = c.cid
                LEFT JOIN v2_programs p ON p.id = ?
                WHERE ipr.id = ?`,
    args: [venture_id, investor_id],
  });
}

/** pipeline POST — admin/staff recipients for investment notifications. */
export async function listAdminAndStaffCids() {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE role IN ('super_admin','staff') AND deleted_at IS NULL",
    args: [],
  });
}

/** pipeline POST — notify an admin of a confirmed investment. */
export async function insertInvestmentConfirmedAdminNotification({ recipient_id, investor_name, organization_name, venture_name, investment_amount, link }) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                  VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
    args: [
      recipient_id,
      `Investment Confirmed: ${venture_name || "Venture"}`,
      `${investor_name || "Investor"} (${organization_name || "Individual"}) has invested${investment_amount > 0 ? ' $' + investment_amount.toLocaleString() : ''} in ${venture_name || "a venture"}.`,
      link,
    ],
  });
}

/** pipeline POST — notify the investing user of their confirmed investment. */
export async function insertInvestmentConfirmedInvestorNotification({ recipient_id, venture_name, investment_amount, link }) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                  VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
    args: [
      recipient_id,
      `Investment Confirmed: ${venture_name || "Venture"}`,
      `Your investment${investment_amount > 0 ? ' of $' + investment_amount.toLocaleString() : ''} in ${venture_name || "the venture"} has been recorded. Welcome to your portfolio!`,
      link,
    ],
  });
}

/** pipeline POST — RM/IM assignments of the relationship workspace (notify step). */
export async function getRelationshipWorkspaceAssigneesForInvestment(pipelineId) {
  return db.execute({
    sql: "SELECT relationship_manager_id, investment_manager_id FROM relationship_workspaces WHERE pipeline_id = ?",
    args: [pipelineId],
  });
}

/** pipeline POST — notify an RM/IM of the completed investment. */
export async function insertInvestmentConfirmedStaffNotification({ recipient_id, investor_name, venture_name, investment_amount, link }) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                      VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
    args: [
      recipient_id,
      `Investment Confirmed: ${venture_name || "Venture"}`,
      `${investor_name || "Investor"} has completed their investment in ${venture_name || "a venture"}${investment_amount > 0 ? ' ($' + investment_amount.toLocaleString() + ')' : ''}.`,
      link,
    ],
  });
}

/** pipeline GET — investor profile id of the current user (investor branch). */
export async function getInvestorProfileIdByUserIdForPipelineList(userCid) {
  return db.execute({
    sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
    args: [userCid],
  });
}

/**
 * pipeline GET — pipeline listing. Rebuilds the controller's three query
 * variants (by venture / admin stage filter / by investor) from the same
 * inputs and runs exactly one statement.
 */
export async function listInvestmentPipeline({ ventureId, stage, role, investorId }) {
  let sql, args;

  if (ventureId && !investorId) {
    // Management view: all pipeline rows for the venture.
    sql = `SELECT ip.*, p.name as venture_name
             FROM investment_pipeline ip
             LEFT JOIN v2_programs p ON ip.venture_id = p.id
             WHERE ip.venture_id = ?`;
    args = [ventureId];
  } else if (ventureId && investorId) {
    // Phase 1.5: own-scoped venture view — a non-management session may only
    // read its OWN rows for the venture (the previous branch returned every
    // investor's rows to anyone with the venture id).
    sql = `SELECT ip.*, p.name as venture_name
             FROM investment_pipeline ip
             LEFT JOIN v2_programs p ON ip.venture_id = p.id
             WHERE ip.venture_id = ? AND ip.investor_id = ?`;
    args = [ventureId, investorId];
  } else if (stage && (role === "super_admin" || role === "staff")) {
    // Admin filtering by stage (e.g., meeting_requested)
    sql = `SELECT ip.*, p.name as venture_name, ipr.organization_name, c.name as investor_name, c.email,
                     ipref.industries, ipref.countries, ipref.startup_stages,
                     ipref.ticket_size_min, ipref.ticket_size_max
             FROM investment_pipeline ip
             LEFT JOIN v2_programs p ON ip.venture_id = p.id
             LEFT JOIN investor_profiles ipr ON ip.investor_id = ipr.id
             LEFT JOIN contacts c ON ipr.user_id = c.cid
             LEFT JOIN investor_preferences ipref ON ipref.investor_id = ipr.id
             WHERE ip.stage = ?
             ORDER BY ip.stage_changed_at DESC`;
    args = [stage];
  } else {
    // Own pipeline.
    sql = `SELECT ip.*, p.name as venture_name
             FROM investment_pipeline ip
             LEFT JOIN v2_programs p ON ip.venture_id = p.id
             WHERE ip.investor_id = ?
             ORDER BY ip.stage_changed_at DESC`;
    args = [investorId];
  }

  return db.execute({ sql, args });
}
