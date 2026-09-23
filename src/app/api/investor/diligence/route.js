import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

import {
  completeDiligenceWorkspace,
  getDdRequestFollowUpQuestionsByRequestId,
  getDdRequestFollowUpQuestionsForRespond,
  getDdRequestInfoByRequestId,
  getDdRequestInfoForTimeline,
  getDdRequestVersionHistoryByRequestId,
  getDiligenceWorkspaceByPipelineId,
  getDiligenceWorkspaceIdByPipelineId,
  getInvestorProfileIdByUserIdForNotes,
  getInvestorProfileUserIdByProfileId,
  getPipelineInvestorIdByPipelineId,
  getPipelineWithVentureById,
  getRelationshipWorkspaceAssigneesByPipelineId,
  getRelationshipWorkspaceIdByPipelineId,
  getRelationshipWorkspaceIdForStatusTimeline,
  insertDdInformationRequest,
  insertDdRequestAddedTimeline,
  insertDdStatusChangedTimeline,
  insertInvestorNote,
  listDdInformationRequestsByWorkspaceId,
  listInvestorNotesByPipelineId,
  updateDdRequestFollowUpQuestions,
  updateDdRequestFollowUpQuestionsForRespond,
  updateDdRequestResponse,
  updatePipelineStageToDueDiligence,
  upsertDiligenceWorkspace,
} from "@/models/investor";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";

/** GET /api/investor/diligence?pipeline_id=X */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get("pipeline_id");

    if (!pipelineId) {
      return NextResponse.json({ success: false, error: "pipeline_id required" }, { status: 400 });
    }

    // Workspace
    let workspace = null;
    const workspaceResult = await getDiligenceWorkspaceByPipelineId(pipelineId);
    if (workspaceResult.rows.length > 0) workspace = workspaceResult.rows[0];

    // Information requests
    let requests = [];
    if (workspace) {
      const requestsResult = await listDdInformationRequestsByWorkspaceId(workspace.id);
      requests = requestsResult.rows;
    }

    // Notes
    const notesResult = await listInvestorNotesByPipelineId(pipelineId);

    // Pipeline info
    const pipelineResult = await getPipelineWithVentureById(pipelineId);

    return NextResponse.json({
      success: true,
      workspace,
      requests,
      notes: notesResult.rows,
      pipeline: pipelineResult.rows[0] || null,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST /api/investor/diligence — create/update workspace */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const { pipeline_id, action, ...payload } = await req.json();

    if (!pipeline_id) {
      return NextResponse.json({ success: false, error: "pipeline_id required" }, { status: 400 });
    }

    if (action === "create_workspace") {
      // Create workspace
      const workspaceResult = await upsertDiligenceWorkspace(pipeline_id);

      // Update pipeline stage
      await updatePipelineStageToDueDiligence(pipeline_id);

      return NextResponse.json({ success: true, workspace: workspaceResult.rows[0] });
    }

    if (action === "add_request") {
      const { title, description, category, priority, due_date, owner_id } = payload;
      if (!title) return NextResponse.json({ success: false, error: "title required" }, { status: 400 });

      // Get workspace
      const workspaceLookup = await getDiligenceWorkspaceIdByPipelineId(pipeline_id);
      if (workspaceLookup.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Workspace not found. Create it first." }, { status: 404 });
      }

      const requestResult = await insertDdInformationRequest({ workspace_id: workspaceLookup.rows[0].id, title, description, category, priority, due_date, owner_id });

      // Timeline entry in relationship workspace
      try {
        const relationshipWorkspaceResult = await getRelationshipWorkspaceIdByPipelineId(pipeline_id);
        if (relationshipWorkspaceResult.rows.length > 0) {
          await insertDdRequestAddedTimeline({ workspace_id: relationshipWorkspaceResult.rows[0].id, title, category });
        }
      } catch (_) {}

      return NextResponse.json({ success: true, request: requestResult.rows[0] });
    }

    if (action === "update_request") {
      const { request_id, status, response_text, response_file_url } = payload;
      const session = await getSession();
      const userCid = session?.cid || session?.id;
      const userRole = session?.role;

      // Get the pipeline_id and relationship workspace assignments for this request
      const requestInfo = await getDdRequestInfoByRequestId(request_id);
      if (requestInfo.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
      }

      const pipelineId = requestInfo.rows[0].pipeline_id;

      // Get relationship workspace assignments (RM, IM)
      const relationshipWorkspaceResult = await getRelationshipWorkspaceAssigneesByPipelineId(pipelineId);
      const relationshipWorkspace = relationshipWorkspaceResult.rows[0] || {};
      const isRM = relationshipWorkspace.relationship_manager_id === userCid;
      const isIM = relationshipWorkspace.investment_manager_id === userCid;
      const isAdmin = userRole === "super_admin";

      // Get investor profile to exclude from founder actions
      const pipelineInfo = await getPipelineInvestorIdByPipelineId(pipelineId);
      const investorProfileId = pipelineInfo.rows[0]?.investor_id;
      const investorUser = await getInvestorProfileUserIdByProfileId(investorProfileId);
      const isInvestor = investorUser.rows[0]?.user_id === userCid;

      // Role-based access control for each transition
      const allowedTransitions = {
        under_review: isAdmin || isRM,
        documents_uploaded: isAdmin || isRM || (userRole !== "investor"),
        verified: isAdmin || isIM,
        completed: isAdmin || isIM,
        responded: isAdmin || isRM || isIM || !isInvestor,
        closed: isAdmin || isRM || isIM,
      };

      if (!allowedTransitions[status] && !isAdmin) {
        return NextResponse.json({
          success: false,
          error: `Only the ${status === 'under_review' ? 'Relationship Manager' : status === 'verified' || status === 'completed' ? 'Investment Manager' : 'authorized staff'} can perform this action.`
        }, { status: 403 });
      }

      // Get current version history
      const versionHistoryResult = await getDdRequestVersionHistoryByRequestId(request_id);

      // Append to version history
      let newHistory = versionHistoryResult.rows[0]?.version_history || [];
      if (typeof newHistory === "string") newHistory = JSON.parse(newHistory);
      if (!Array.isArray(newHistory)) newHistory = [];
      newHistory.push({
        from_status: versionHistoryResult.rows[0]?.status,
        to_status: status,
        changed_at: new Date().toISOString(),
        changed_by: session?.cid || session?.id || "system",
        notes: response_text || null,
      });

      await updateDdRequestResponse({ status, response_text, response_file_url, version_history: JSON.stringify(newHistory), request_id });

      // Timeline entry in relationship workspace
      try {
        const requestInfo = await getDdRequestInfoForTimeline(request_id);
        if (requestInfo.rows.length > 0) {
          const relationshipWorkspaceResult = await getRelationshipWorkspaceIdForStatusTimeline(requestInfo.rows[0].pipeline_id);
          if (relationshipWorkspaceResult.rows.length > 0) {
            await insertDdStatusChangedTimeline({ workspace_id: relationshipWorkspaceResult.rows[0].id, title: requestInfo.rows[0].title, status });
          }
        }
      } catch (_) {}

      return NextResponse.json({ success: true });
    }

    if (action === "add_note") {
      const { content, note_type } = payload;
      if (!content) return NextResponse.json({ success: false, error: "content required" }, { status: 400 });

      const session = await getSession();
      // Get investor profile
      const profileResult = await getInvestorProfileIdByUserIdForNotes(session.cid || session.id);

      const noteResult = await insertInvestorNote({ investor_id: profileResult.rows[0]?.id, pipeline_id, note_type, content });

      return NextResponse.json({ success: true, note: noteResult.rows[0] });
    }

    if (action === "complete") {
      await completeDiligenceWorkspace(pipeline_id);
      return NextResponse.json({ success: true });
    }

    if (action === "add_followup") {
      const { request_id, question } = payload;
      if (!question) return NextResponse.json({ success: false, error: "question required" }, { status: 400 });

      const session = await getSession();
      const followUpQuestionsResult = await getDdRequestFollowUpQuestionsByRequestId(request_id);

      let questions = followUpQuestionsResult.rows[0]?.follow_up_questions || [];
      if (typeof questions === "string") questions = JSON.parse(questions);
      if (!Array.isArray(questions)) questions = [];
      questions.push({
        question,
        asked_by: session?.cid || session?.id || "investor",
        asked_at: new Date().toISOString(),
        response: null,
      });

      await updateDdRequestFollowUpQuestions({ questions, request_id });

      return NextResponse.json({ success: true, follow_up_questions: questions });
    }

    if (action === "respond_followup") {
      const { request_id, question_index, response } = payload;
      const followUpQuestionsResult = await getDdRequestFollowUpQuestionsForRespond(request_id);

      let questions = followUpQuestionsResult.rows[0]?.follow_up_questions || [];
      if (typeof questions === "string") questions = JSON.parse(questions);
      if (!Array.isArray(questions)) questions = [];
      if (questions[question_index]) {
        questions[question_index].response = response;
        questions[question_index].responded_at = new Date().toISOString();
      }

      await updateDdRequestFollowUpQuestionsForRespond({ questions, request_id });

      return NextResponse.json({ success: true, follow_up_questions: questions });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
