import db from "@/lib/db";

/**
 * Investor model — data access for the investor API controllers under
 * `src/app/api/investor/` (diligence, pipeline, dashboards, evaluation, KPIs,
 * ventures search, updates).
 *
 * Each exported function wraps exactly one SQL statement, and SQL is
 * byte-identical to the queries that used to live inline in the controllers,
 * so behavior is unchanged (see docs/MVC_REFACTOR.md §4).
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data/outcome it returns.
 *
 * Route → function-group mapping (extraction is strictly 1:1 with the
 * original inline call sites, so lookups that intentionally repeat the same
 * SQL — e.g. `SELECT id FROM investor_profiles WHERE user_id = ?` or the
 * `relationship_workspaces` id/assignee lookups — appear once per controller
 * call site, mirroring the pre-extraction code):
 *
 *  src/app/api/investor/diligence/route.js                → 26 functions
 *  src/app/api/investor/diligence/documents/route.js      →  8 functions
 *  src/app/api/investor/pipeline/route.js                 → 19 functions
 *  src/app/api/investor/dashboard/route.js                →  9 functions
 *  src/app/api/investor/executive-dashboard/route.js      →  1 function
 *  src/app/api/investor/admin-overview/route.js           →  4 functions
 *  src/app/api/investor/evaluation/route.js               →  4 functions
 *  src/app/api/investor/venture-kpis/route.js             →  3 functions
 *  src/app/api/investor/kpis/route.js                     →  2 functions
 *  src/app/api/investor/ventures/route.js                 →  2 functions
 *  src/app/api/investor/updates/route.js                  →  2 functions
 */

// ── GET/POST /api/investor/diligence ────────────────────────────────────────

/** diligence GET — due diligence workspace row for a pipeline. */
export async function getDiligenceWorkspaceByPipelineId(pipelineId) {
  return db.execute({
    sql: "SELECT * FROM due_diligence_workspaces WHERE pipeline_id = ?",
    args: [pipelineId],
  });
}

/** diligence GET — DD information requests for a workspace, newest first. */
export async function listDdInformationRequestsByWorkspaceId(workspaceId) {
  return db.execute({
    sql: "SELECT * FROM dd_information_requests WHERE workspace_id = ? ORDER BY created_at DESC",
    args: [workspaceId],
  });
}

/** diligence GET — investor notes for a pipeline, newest first. */
export async function listInvestorNotesByPipelineId(pipelineId) {
  return db.execute({
    sql: "SELECT * FROM investor_notes WHERE pipeline_id = ? ORDER BY created_at DESC",
    args: [pipelineId],
  });
}

/** diligence GET — pipeline row joined with its venture program. */
export async function getPipelineWithVentureById(pipelineId) {
  return db.execute({
    sql: `SELECT ip.*, p.name as venture_name, p.description as venture_description,
                   p.industry, p.country, p.business_stage
            FROM investment_pipeline ip
            LEFT JOIN v2_programs p ON ip.venture_id = p.id
            WHERE ip.id = ?`,
    args: [pipelineId],
  });
}

/** diligence POST create_workspace — create (or reactivate) the workspace. */
export async function upsertDiligenceWorkspace(pipelineId) {
  return db.execute({
    sql: `INSERT INTO due_diligence_workspaces (pipeline_id, status)
              VALUES (?, 'active')
              ON CONFLICT (pipeline_id) DO UPDATE SET status = 'active', updated_at = NOW()
              RETURNING *`,
    args: [pipelineId],
  });
}

/** diligence POST create_workspace — move the pipeline into due diligence. */
export async function updatePipelineStageToDueDiligence(pipelineId) {
  return db.execute({
    sql: "UPDATE investment_pipeline SET stage = 'due_diligence', stage_changed_at = NOW(), updated_at = NOW() WHERE id = ?",
    args: [pipelineId],
  });
}

/** diligence POST add_request — workspace id lookup before inserting a request. */
export async function getDiligenceWorkspaceIdByPipelineId(pipelineId) {
  return db.execute({
    sql: "SELECT id FROM due_diligence_workspaces WHERE pipeline_id = ?",
    args: [pipelineId],
  });
}

/** diligence POST add_request — create a DD information request (pending). */
export async function insertDdInformationRequest({ workspace_id, title, description, category, priority, due_date, owner_id }) {
  return db.execute({
    sql: `INSERT INTO dd_information_requests (workspace_id, title, description, category, priority, due_date, owner_id, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'pending') RETURNING *`,
    args: [workspace_id, title, description || null, category || "general", priority || "medium", due_date || null, owner_id || null],
  });
}

/** diligence POST add_request — relationship workspace id for the timeline entry. */
export async function getRelationshipWorkspaceIdByPipelineId(pipelineId) {
  return db.execute({
    sql: "SELECT id FROM relationship_workspaces WHERE pipeline_id = ?",
    args: [pipelineId],
  });
}

/** diligence POST add_request — 'dd_request_added' timeline event. */
export async function insertDdRequestAddedTimeline({ workspace_id, title, category }) {
  return db.execute({
    sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description)
                  VALUES (?, 'dd_request_added', ?)`,
    args: [workspace_id, `DD request: ${title} (${category})`],
  });
}

/** diligence POST update_request — request info + owning pipeline id. */
export async function getDdRequestInfoByRequestId(request_id) {
  return db.execute({
    sql: `SELECT r.workspace_id, r.title, dw.pipeline_id
              FROM dd_information_requests r
              JOIN due_diligence_workspaces dw ON r.workspace_id = dw.id
              WHERE r.id = ?`,
    args: [request_id],
  });
}

/** diligence POST update_request — RM/IM assignments of the relationship workspace. */
export async function getRelationshipWorkspaceAssigneesByPipelineId(pipelineId) {
  return db.execute({
    sql: "SELECT relationship_manager_id, investment_manager_id FROM relationship_workspaces WHERE pipeline_id = ?",
    args: [pipelineId],
  });
}

/** diligence POST update_request — owning investor profile id of the pipeline. */
export async function getPipelineInvestorIdByPipelineId(pipelineId) {
  return db.execute({
    sql: "SELECT investor_id FROM investment_pipeline WHERE id = ?",
    args: [pipelineId],
  });
}

/** diligence POST update_request — user id behind an investor profile. */
export async function getInvestorProfileUserIdByProfileId(investorProfileId) {
  return db.execute({
    sql: "SELECT user_id FROM investor_profiles WHERE id = ?",
    args: [investorProfileId],
  });
}

/** diligence POST update_request — current version history + status. */
export async function getDdRequestVersionHistoryByRequestId(request_id) {
  return db.execute({
    sql: "SELECT version_history, status FROM dd_information_requests WHERE id = ?",
    args: [request_id],
  });
}

/** diligence POST update_request — persist status transition + version history. */
export async function updateDdRequestResponse({ status, response_text, response_file_url, version_history, request_id }) {
  return db.execute({
    sql: `UPDATE dd_information_requests
              SET status = ?, response_text = ?, response_file_url = ?, version_history = ?, updated_at = NOW()
              WHERE id = ?`,
    args: [status, response_text || null, response_file_url || null, version_history, request_id],
  });
}

/** diligence POST update_request — request info re-fetched for the timeline entry. */
export async function getDdRequestInfoForTimeline(request_id) {
  return db.execute({
    sql: `SELECT r.workspace_id, r.title, dw.pipeline_id
                FROM dd_information_requests r
                JOIN due_diligence_workspaces dw ON r.workspace_id = dw.id
                WHERE r.id = ?`,
    args: [request_id],
  });
}

/** diligence POST update_request — relationship workspace id for the timeline entry. */
export async function getRelationshipWorkspaceIdForStatusTimeline(pipelineId) {
  return db.execute({
    sql: "SELECT id FROM relationship_workspaces WHERE pipeline_id = ?",
    args: [pipelineId],
  });
}

/** diligence POST update_request — 'dd_status_changed' timeline event. */
export async function insertDdStatusChangedTimeline({ workspace_id, title, status }) {
  return db.execute({
    sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description)
                    VALUES (?, 'dd_status_changed', ?)`,
    args: [workspace_id, `DD request "${title}" status: ${status}`],
  });
}

/** diligence POST add_note — investor profile id of the note author. */
export async function getInvestorProfileIdByUserIdForNotes(userCid) {
  return db.execute({
    sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
    args: [userCid],
  });
}

/** diligence POST add_note — create an investor note. */
export async function insertInvestorNote({ investor_id, pipeline_id, note_type, content }) {
  return db.execute({
    sql: `INSERT INTO investor_notes (investor_id, pipeline_id, note_type, content)
              VALUES (?, ?, ?, ?) RETURNING *`,
    args: [investor_id, pipeline_id, note_type || "private", content],
  });
}

/** diligence POST complete — mark the workspace completed. */
export async function completeDiligenceWorkspace(pipelineId) {
  return db.execute({
    sql: "UPDATE due_diligence_workspaces SET status = 'completed', updated_at = NOW() WHERE pipeline_id = ?",
    args: [pipelineId],
  });
}

/** diligence POST add_followup — current follow-up questions of the request. */
export async function getDdRequestFollowUpQuestionsByRequestId(request_id) {
  return db.execute({
    sql: "SELECT follow_up_questions FROM dd_information_requests WHERE id = ?",
    args: [request_id],
  });
}

/** diligence POST add_followup — append a question to the request. */
export async function updateDdRequestFollowUpQuestions({ questions, request_id }) {
  return db.execute({
    sql: "UPDATE dd_information_requests SET follow_up_questions = ?, updated_at = NOW() WHERE id = ?",
    args: [JSON.stringify(questions), request_id],
  });
}

/** diligence POST respond_followup — current follow-up questions of the request. */
export async function getDdRequestFollowUpQuestionsForRespond(request_id) {
  return db.execute({
    sql: "SELECT follow_up_questions FROM dd_information_requests WHERE id = ?",
    args: [request_id],
  });
}

/** diligence POST respond_followup — persist the answered question. */
export async function updateDdRequestFollowUpQuestionsForRespond({ questions, request_id }) {
  return db.execute({
    sql: "UPDATE dd_information_requests SET follow_up_questions = ?, updated_at = NOW() WHERE id = ?",
    args: [JSON.stringify(questions), request_id],
  });
}

// ── POST/GET /api/investor/diligence/documents ──────────────────────────────

/** documents POST — insert a DD document row. */
export async function insertDdDocument({ request_id, file_name, file_size, file_type, file_data, uploaded_by }) {
  return db.execute({
    sql: `INSERT INTO dd_documents (request_id, file_name, file_size, file_type, file_data, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING id, file_name, file_size, file_type, uploaded_at`,
    args: [request_id, file_name, file_size, file_type || "application/pdf", file_data, uploaded_by],
  });
}

/** documents POST — auto-advance the request to documents_uploaded. */
export async function markDdRequestDocumentsUploaded({ file_name, request_id }) {
  return db.execute({
    sql: `UPDATE dd_information_requests SET response_file_url = ?, status = 'documents_uploaded', updated_at = NOW()
            WHERE id = ? AND status IN ('pending', 'under_review')`,
    args: [file_name, request_id],
  });
}

/** documents POST — request info (workspace + pipeline) for the timeline entry. */
export async function getDdRequestInfoForDocumentUpload(request_id) {
  return db.execute({
    sql: "SELECT r.workspace_id, r.title, dw.pipeline_id FROM dd_information_requests r JOIN due_diligence_workspaces dw ON r.workspace_id = dw.id WHERE r.id = ?",
    args: [request_id],
  });
}

/** documents POST — relationship workspace id for the timeline entry. */
export async function getRelationshipWorkspaceIdForDocumentUpload(pipeline_id) {
  return db.execute({
    sql: "SELECT id FROM relationship_workspaces WHERE pipeline_id = ?",
    args: [pipeline_id],
  });
}

/** documents POST — 'document_uploaded' timeline event. */
export async function insertDocumentUploadedTimeline({ workspace_id, file_name, title }) {
  return db.execute({
    sql: "INSERT INTO relationship_timeline (workspace_id, event_type, description) VALUES (?, 'document_uploaded', ?)",
    args: [workspace_id, `Document "${file_name}" uploaded for "${title}"`],
  });
}

/** documents GET (download) — fetch a single document by id. */
export async function getDdDocumentById(docId) {
  return db.execute({
    sql: "SELECT * FROM dd_documents WHERE id = ?",
    args: [docId],
  });
}

/** documents GET (download) — 'document_downloaded' timeline event (insert-select). */
export async function insertDocumentDownloadedTimeline({ file_name, actor, doc_id }) {
  return db.execute({
    sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description)
                SELECT rw.id, 'document_downloaded', ? FROM dd_documents d
                JOIN dd_information_requests r ON d.request_id = r.id
                JOIN due_diligence_workspaces dw ON r.workspace_id = dw.id
                LEFT JOIN relationship_workspaces rw ON rw.pipeline_id = dw.pipeline_id
                WHERE d.id = ? AND rw.id IS NOT NULL`,
    args: [`"${file_name}" downloaded by ${actor || "user"}`, doc_id],
  });
}

/** documents GET — list documents of a request, newest first. */
export async function listDdDocumentsByRequestId(requestId) {
  return db.execute({
    sql: "SELECT id, request_id, file_name, file_size, file_type, uploaded_by, uploaded_at FROM dd_documents WHERE request_id = ? ORDER BY uploaded_at DESC",
    args: [requestId],
  });
}

// ── POST/GET /api/investor/pipeline ─────────────────────────────────────────

/** pipeline POST — investor profile id of the current user. */
export async function getInvestorProfileIdByUserId(userCid) {
  return db.execute({
    sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
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

  if (ventureId) {
    sql = `SELECT ip.*, p.name as venture_name
             FROM investment_pipeline ip
             LEFT JOIN v2_programs p ON ip.venture_id = p.id
             WHERE ip.venture_id = ?`;
    args = [ventureId];
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
    sql = `SELECT ip.*, p.name as venture_name
             FROM investment_pipeline ip
             LEFT JOIN v2_programs p ON ip.venture_id = p.id
             WHERE ip.investor_id = ?
             ORDER BY ip.stage_changed_at DESC`;
    args = [investorId];
  }

  return db.execute({ sql, args });
}

// ── GET /api/investor/dashboard ─────────────────────────────────────────────

/** dashboard — full investor profile + preference overlap fields. */
export async function getInvestorDashboardProfile(userCid) {
  return db.execute({
    sql: `SELECT ip.*, ipr.industries, ipr.countries, ipr.startup_stages
            FROM investor_profiles ip
            LEFT JOIN investor_preferences ipr ON ipr.investor_id = ip.id
            WHERE ip.user_id = ?`,
    args: [userCid],
  });
}

/** dashboard — the investor's pipeline entries, newest stage change first. */
export async function listInvestorPipelineEntries(investorId) {
  return db.execute({
    sql: `SELECT ip.*, p.name as venture_name, p.status as venture_status
            FROM investment_pipeline ip
            LEFT JOIN v2_programs p ON ip.venture_id = p.id
            WHERE ip.investor_id = ?
            ORDER BY ip.stage_changed_at DESC`,
    args: [investorId],
  });
}

/** dashboard — the investor's watchlist enriched with venture/campaign data. */
export async function listInvestorWatchlist(investorId) {
  return db.execute({
    sql: `SELECT iw.*, p.name as venture_name, p.status as venture_status,
                    p.industry, p.country, p.business_stage, p.completion_index,
                    p.funding_requirement, p.description,
                    fc.id as campaign_id, fc.name as campaign_name, fc.status as campaign_status,
                    fc.target_raise, fc.current_raised, fc.min_investment,
                    fc.opening_date, fc.closing_date,
                    (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = iw.venture_id AND stage NOT IN ('declined'))::int as investor_count
             FROM investor_watchlist iw
             LEFT JOIN v2_programs p ON iw.venture_id = p.id
             LEFT JOIN fundraising_campaigns fc ON fc.venture_id = iw.venture_id AND fc.status = 'active'
             WHERE iw.investor_id = ?
             ORDER BY iw.created_at DESC`,
    args: [investorId],
  });
}

/** dashboard — active ventures fed into the recommendation scorer. */
export async function listActiveVenturesForRecommendations() {
  return db.execute({
    sql: `SELECT p.id, p.name, p.description, p.status, p.industry,
                     p.country, p.completion_index, p.business_stage,
                     p.funding_requirement, p.created_at,
                     (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = p.id) as investor_interest_count
              FROM v2_programs p
              WHERE p.status = 'active' AND p.is_archived = 0
              ORDER BY p.created_at DESC LIMIT 50`,
    args: [],
  });
}

/** dashboard — pipeline funnel stats for the investor. */
export async function getInvestorPipelineStats(investorId) {
  return db.execute({
    sql: `SELECT
              COUNT(*) FILTER (WHERE stage = 'invested') as invested_count,
              COUNT(*) FILTER (WHERE stage IN ('due_diligence','negotiation')) as active_evaluations,
              COUNT(*) as total_pipeline
            FROM investment_pipeline WHERE investor_id = ?`,
    args: [investorId],
  });
}

/** dashboard — investor watchlist row count. */
export async function countInvestorWatchlist(investorId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM investor_watchlist WHERE investor_id = ?",
    args: [investorId],
  });
}

/** dashboard — active fundraising campaigns (public or invite-only). */
export async function listActiveFundraisingCampaigns() {
  return db.execute({
    sql: `SELECT fc.*, p.name as venture_name, p.industry, p.country, p.business_stage,
                     p.funding_requirement, p.completion_index,
                     (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = fc.venture_id AND stage NOT IN ('declined'))::int as investor_count,
                     (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = fc.venture_id AND stage IN ('due_diligence','negotiation'))::int as active_dd_count
              FROM fundraising_campaigns fc
              LEFT JOIN v2_programs p ON fc.venture_id = p.id
              WHERE fc.status = 'active' AND (fc.visibility = 'public' OR fc.visibility = 'invite_only')
              ORDER BY fc.created_at DESC LIMIT 20`,
    args: [],
  });
}

/** dashboard — active relationship workspaces of the investor with RM names. */
export async function listActiveInvestorRelationshipWorkspaces(investorId) {
  return db.execute({
    sql: `SELECT rw.*, p.name as venture_name, p.industry,
                     rm.name as relationship_manager_name,
                     (SELECT COUNT(*) FROM relationship_meetings WHERE workspace_id = rw.id AND status = 'scheduled')::int as upcoming_meetings
              FROM relationship_workspaces rw
              LEFT JOIN v2_programs p ON rw.venture_id = p.id
              LEFT JOIN contacts rm ON rw.relationship_manager_id = rm.cid
              WHERE rw.investor_id = ? AND rw.status = 'active'
              ORDER BY rw.updated_at DESC`,
    args: [investorId],
  });
}

/** dashboard — next scheduled meetings of a relationship workspace. */
export async function listUpcomingRelationshipMeetings(workspaceId) {
  return db.execute({
    sql: `SELECT id, meeting_type, scheduled_date, scheduled_time, status, location
                FROM relationship_meetings
                WHERE workspace_id = ? AND status = 'scheduled'
                ORDER BY scheduled_date ASC LIMIT 3`,
    args: [workspaceId],
  });
}

// ── GET /api/investor/executive-dashboard ───────────────────────────────────

/**
 * executive-dashboard GET — run one parameterless report query and return its
 * rows. The controller feeds the eight report SQL strings through this single
 * execute site (it previously did so through an inline q(sql) helper), so the
 * extraction is 1:1 with the original call site; the SQL text stays with the
 * caller by design.
 */
export async function runExecutiveDashboardQuery(sql) {
  return (await db.execute({ sql, args: [] })).rows;
}

// ── GET /api/investor/admin-overview ────────────────────────────────────────

/** admin-overview — DD workspaces joined with pipeline/investor/venture info. */
export async function listAdminOverviewWorkspaces() {
  return db.execute({
    sql: `SELECT dw.*, ip.venture_id, ip.stage, ipr.organization_name, c.name as investor_name, c.email as investor_email, p.name as venture_name FROM due_diligence_workspaces dw JOIN investment_pipeline ip ON dw.pipeline_id = ip.id LEFT JOIN investor_profiles ipr ON ip.investor_id = ipr.id LEFT JOIN contacts c ON ipr.user_id = c.cid LEFT JOIN v2_programs p ON ip.venture_id = p.id ORDER BY dw.updated_at DESC`,
    args: [],
  });
}

/** admin-overview — active pipelines with investor, venture and decision data. */
export async function listAdminOverviewPipelines() {
  return db.execute({
    sql: `SELECT ip.*, ipr.organization_name, c.name as investor_name, c.email, c.cid as investor_cid,
                           p.name as venture_name, d.decision_type, d.investment_amount, d.decision_date,
                           ipref.industries, ipref.countries, ipref.startup_stages,
                           ipref.ticket_size_min, ipref.ticket_size_max, ipref.investment_philosophy
                    FROM investment_pipeline ip
                    LEFT JOIN investor_profiles ipr ON ip.investor_id = ipr.id
                    LEFT JOIN contacts c ON ipr.user_id = c.cid
                    LEFT JOIN v2_programs p ON ip.venture_id = p.id
                    LEFT JOIN investment_decisions d ON d.pipeline_id = ip.id
                    LEFT JOIN investor_preferences ipref ON ipref.investor_id = ipr.id
                    WHERE ip.stage IN ('invested','negotiation','due_diligence','meeting_requested')
                    ORDER BY ip.stage_changed_at DESC`,
    args: [],
  });
}

/** admin-overview — headline investor/DD/pipeline counters. */
export async function getAdminOverviewStats() {
  return db.execute({
    sql: `SELECT (SELECT COUNT(*) FROM investor_profiles WHERE approval_status='approved')::int as approved_investors, (SELECT COUNT(*) FROM investor_profiles WHERE approval_status='pending_review')::int as pending_investors, (SELECT COUNT(*) FROM due_diligence_workspaces WHERE status='active')::int as active_dd, (SELECT COUNT(*) FROM investment_pipeline WHERE stage='invested')::int as total_invested`,
    args: [],
  });
}

/** admin-overview — recent DD information requests (50) with context joins. */
export async function listAdminOverviewRequests() {
  return db.execute({
    sql: `SELECT r.*, dw.pipeline_id, ip.venture_id, p.name as venture_name, ipr.organization_name, c.name as investor_name FROM dd_information_requests r JOIN due_diligence_workspaces dw ON r.workspace_id = dw.id JOIN investment_pipeline ip ON dw.pipeline_id = ip.id LEFT JOIN investor_profiles ipr ON ip.investor_id = ipr.id LEFT JOIN contacts c ON ipr.user_id = c.cid LEFT JOIN v2_programs p ON ip.venture_id = p.id ORDER BY r.created_at DESC LIMIT 50`,
    args: [],
  });
}

// ── GET/POST /api/investor/evaluation ───────────────────────────────────────

/** evaluation GET — founder evaluations of a pipeline, newest first. */
export async function listFounderEvaluationsByPipelineId(pipelineId) {
  return db.execute({
    sql: "SELECT * FROM founder_evaluations WHERE pipeline_id = ? ORDER BY created_at DESC",
    args: [pipelineId],
  });
}

/** evaluation GET — risk assessments of a pipeline, severity first. */
export async function listRiskAssessmentsByPipelineId(pipelineId) {
  return db.execute({
    sql: "SELECT * FROM risk_assessments WHERE pipeline_id = ? ORDER BY severity DESC, created_at DESC",
    args: [pipelineId],
  });
}

/** evaluation POST (founder) — create a founder evaluation. */
export async function createFounderEvaluation({ pipeline_id, founder_name, role, experience_score, leadership_score, domain_expertise_score, overall_rating, notes, created_by }) {
  return db.execute({
    sql: `INSERT INTO founder_evaluations (pipeline_id, founder_name, role, experience_score, leadership_score, domain_expertise_score, overall_rating, notes, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [pipeline_id, founder_name, role || null, experience_score || 0, leadership_score || 0, domain_expertise_score || 0, overall_rating || 0, notes || null, created_by],
  });
}

/** evaluation POST (risk) — create or update a risk assessment per category. */
export async function upsertRiskAssessment({ pipeline_id, risk_category, risk_description, severity, mitigation, status, created_by }) {
  return db.execute({
    sql: `INSERT INTO risk_assessments (pipeline_id, risk_category, risk_description, severity, mitigation, status, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT (pipeline_id, risk_category) DO UPDATE
              SET risk_description = EXCLUDED.risk_description, severity = EXCLUDED.severity,
                  mitigation = EXCLUDED.mitigation, status = EXCLUDED.status, updated_at = NOW()
              RETURNING *`,
    args: [pipeline_id, risk_category, risk_description, severity || "medium", mitigation || null, status || "open", created_by],
  });
}

// ── GET /api/investor/venture-kpis ──────────────────────────────────────────

/** venture-kpis — program fields backing the derived KPI cards. */
export async function getVentureProgramKpiFields(ventureId) {
  return db.execute({
    sql: "SELECT completion_index, status, start_date, end_date FROM v2_programs WHERE id = ?",
    args: [ventureId],
  });
}

/** venture-kpis — count of active (non-facilitator) participants in a program. */
export async function countVentureParticipants(ventureId) {
  return db.execute({
    sql: `SELECT COUNT(*) as count
            FROM participant_programs pp
            JOIN contacts c ON pp.participant_id = c.cid
            WHERE CAST(pp.program_id AS TEXT) = ?
              AND c.deleted = 0
              AND c.deleted_at IS NULL
              AND c.archived_at IS NULL
              AND LOWER(COALESCE(c.status, '')) = 'active'
              AND NOT EXISTS (
                SELECT 1 FROM v2_program_staff ps
                WHERE CAST(ps.program_id AS TEXT) = CAST(pp.program_id AS TEXT)
                  AND ps.role = 'facilitator'
                  AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
              )`,
    args: [ventureId],
  });
}

/** venture-kpis — count of invested pipelines for a venture. */
export async function countVentureInvestedPipeline(ventureId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM investment_pipeline WHERE venture_id = ? AND stage = 'invested'",
    args: [ventureId],
  });
}

// ── GET/POST /api/investor/kpis ─────────────────────────────────────────────

/** kpis GET — stored venture KPIs, ordered by key. */
export async function listVentureKpisByVentureId(ventureId) {
  return db.execute({
    sql: "SELECT * FROM venture_kpis WHERE venture_id = ? ORDER BY kpi_key",
    args: [ventureId],
  });
}

/** kpis POST — upsert a venture KPI by (venture_id, kpi_key). */
export async function upsertVentureKpi({ venture_id, kpi_key, kpi_label, kpi_value, trend }) {
  return db.execute({
    sql: `INSERT INTO venture_kpis (venture_id, kpi_key, kpi_label, kpi_value, trend)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (venture_id, kpi_key)
            DO UPDATE SET kpi_label = EXCLUDED.kpi_label, kpi_value = EXCLUDED.kpi_value,
                          trend = EXCLUDED.trend, updated_at = NOW()`,
    args: [venture_id, kpi_key, kpi_label, kpi_value, trend || "stable"],
  });
}

// ── GET /api/investor/ventures ──────────────────────────────────────────────

/**
 * ventures GET — build the filtered venture-search SQL. Shared by the count
 * and the page query below; each executed query gets its own function with a
 * 1:1 copy of the original controller assembly.
 */
function buildVentureSearchQuery({ search, industry, country, stage, fundingMin, fundingMax }) {
  let sql = `SELECT p.id, p.name, p.description, p.status, p.industry,
                      p.country, p.start_date, p.end_date, p.created_at,
                      p.completion_index,
                      (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = p.id) as investor_interest_count
               FROM v2_programs p
               WHERE p.is_archived = 0 AND p.status = 'active'`;
  const args = [];

  // Text search
  if (search) {
    sql += ` AND (p.name ILIKE ? OR p.description ILIKE ? OR p.industry ILIKE ?)`;
    const q = `%${search}%`;
    args.push(q, q, q);
  }

  // Industry filter
  if (industry) {
    const industries = industry.split(",").filter(Boolean);
    if (industries.length > 0) {
      sql += ` AND (${industries.map(() => "p.industry ILIKE ?").join(" OR ")})`;
      industries.forEach(i => args.push(`%${i.trim()}%`));
    }
  }

  // Country filter
  if (country) {
    const countries = country.split(",").filter(Boolean);
    if (countries.length > 0) {
      sql += ` AND (${countries.map(() => "p.country ILIKE ?").join(" OR ")})`;
      countries.forEach(c => args.push(`%${c.trim()}%`));
    }
  }

  // Stage filter
  if (stage) {
    const stages = stage.split(",").filter(Boolean);
    if (stages.length > 0) {
      sql += ` AND (${stages.map(() => "p.business_stage ILIKE ?").join(" OR ")})`;
      stages.forEach(s => args.push(`%${s.trim()}%`));
    }
  }

  // Funding range
  if (fundingMin) {
    sql += " AND (p.funding_requirement::numeric >= ?)";
    args.push(parseFloat(fundingMin));
  }
  if (fundingMax) {
    sql += " AND (p.funding_requirement::numeric <= ?)";
    args.push(parseFloat(fundingMax));
  }

  return { sql, args };
}

/** ventures GET — total count of ventures matching the filters. */
export async function countInvestorVentureSearch(filters) {
  const { sql, args } = buildVentureSearchQuery(filters);
  const countSql = sql.replace(/SELECT .* FROM/, "SELECT COUNT(*) as total FROM");
  return db.execute({ sql: countSql, args });
}

/** ventures GET — filtered venture page (with pagination). */
export async function searchInvestorVentures({ search, industry, country, stage, fundingMin, fundingMax, limit, offset }) {
  const built = buildVentureSearchQuery({ search, industry, country, stage, fundingMin, fundingMax });
  const sql = built.sql + " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
  const args = [...built.args, limit, offset];
  return db.execute({ sql, args });
}

// ── GET/POST /api/investor/updates ──────────────────────────────────────────

/** updates GET — venture updates, newest first. */
export async function listVentureUpdatesByVentureId(ventureId) {
  return db.execute({
    sql: "SELECT * FROM venture_updates WHERE venture_id = ? ORDER BY created_at DESC",
    args: [ventureId],
  });
}

/** updates POST — create a venture update. */
export async function createVentureUpdate({ venture_id, title, content, update_type, created_by }) {
  return db.execute({
    sql: "INSERT INTO venture_updates (venture_id, title, content, update_type, created_by) VALUES (?, ?, ?, ?, ?) RETURNING *",
    args: [venture_id, title, content, update_type || "general", created_by],
  });
}
