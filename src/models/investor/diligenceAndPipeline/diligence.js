import db from "@/lib/db";

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
