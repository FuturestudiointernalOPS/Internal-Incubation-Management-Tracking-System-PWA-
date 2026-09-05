import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
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

/** GET /api/investor/diligence?pipeline_id=X */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get("pipeline_id");

    if (!pipelineId) {
      return NextResponse.json({ success: false, error: "pipeline_id required" }, { status: 400 });
    }

    // Workspace
    let workspace = null;
    const wsRes = await getDiligenceWorkspaceByPipelineId(pipelineId);
    if (wsRes.rows.length > 0) workspace = wsRes.rows[0];

    // Information requests
    let requests = [];
    if (workspace) {
      const reqRes = await listDdInformationRequestsByWorkspaceId(workspace.id);
      requests = reqRes.rows;
    }

    // Notes
    const notesRes = await listInvestorNotesByPipelineId(pipelineId);

    // Pipeline info
    const pipeRes = await getPipelineWithVentureById(pipelineId);

    return NextResponse.json({
      success: true,
      workspace,
      requests,
      notes: notesRes.rows,
      pipeline: pipeRes.rows[0] || null,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST /api/investor/diligence — create/update workspace */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "create");
    if (capError) return capError;

    const { pipeline_id, action, ...data } = await req.json();

    if (!pipeline_id) {
      return NextResponse.json({ success: false, error: "pipeline_id required" }, { status: 400 });
    }

    if (action === "create_workspace") {
      // Create workspace
      const res = await upsertDiligenceWorkspace(pipeline_id);

      // Update pipeline stage
      await updatePipelineStageToDueDiligence(pipeline_id);

      return NextResponse.json({ success: true, workspace: res.rows[0] });
    }

    if (action === "add_request") {
      const { title, description, category, priority, due_date, owner_id } = data;
      if (!title) return NextResponse.json({ success: false, error: "title required" }, { status: 400 });

      // Get workspace
      const ws = await getDiligenceWorkspaceIdByPipelineId(pipeline_id);
      if (ws.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Workspace not found. Create it first." }, { status: 404 });
      }

      const res = await insertDdInformationRequest({ workspace_id: ws.rows[0].id, title, description, category, priority, due_date, owner_id });

      // Timeline entry in relationship workspace
      try {
        const relWs = await getRelationshipWorkspaceIdByPipelineId(pipeline_id);
        if (relWs.rows.length > 0) {
          await insertDdRequestAddedTimeline({ workspace_id: relWs.rows[0].id, title, category });
        }
      } catch (_) {}

      return NextResponse.json({ success: true, request: res.rows[0] });
    }

    if (action === "update_request") {
      const { request_id, status, response_text, response_file_url } = data;
      const session = await getSession();
      const userCid = session?.cid || session?.id;
      const userRole = session?.role;

      // Get the pipeline_id and relationship workspace assignments for this request
      const reqInfo = await getDdRequestInfoByRequestId(request_id);
      if (reqInfo.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
      }

      const pipelineId = reqInfo.rows[0].pipeline_id;

      // Get relationship workspace assignments (RM, IM)
      const relWs = await getRelationshipWorkspaceAssigneesByPipelineId(pipelineId);
      const rw = relWs.rows[0] || {};
      const isRM = rw.relationship_manager_id === userCid;
      const isIM = rw.investment_manager_id === userCid;
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
      const current = await getDdRequestVersionHistoryByRequestId(request_id);

      // Append to version history
      let newHistory = current.rows[0]?.version_history || [];
      if (typeof newHistory === "string") newHistory = JSON.parse(newHistory);
      if (!Array.isArray(newHistory)) newHistory = [];
      newHistory.push({
        from_status: current.rows[0]?.status,
        to_status: status,
        changed_at: new Date().toISOString(),
        changed_by: session?.cid || session?.id || "system",
        notes: response_text || null,
      });

      await updateDdRequestResponse({ status, response_text, response_file_url, version_history: JSON.stringify(newHistory), request_id });

      // Timeline entry in relationship workspace
      try {
        const reqInfo = await getDdRequestInfoForTimeline(request_id);
        if (reqInfo.rows.length > 0) {
          const relWs = await getRelationshipWorkspaceIdForStatusTimeline(reqInfo.rows[0].pipeline_id);
          if (relWs.rows.length > 0) {
            await insertDdStatusChangedTimeline({ workspace_id: relWs.rows[0].id, title: reqInfo.rows[0].title, status });
          }
        }
      } catch (_) {}

      return NextResponse.json({ success: true });
    }

    if (action === "add_note") {
      const { content, note_type } = data;
      if (!content) return NextResponse.json({ success: false, error: "content required" }, { status: 400 });

      const session = await getSession();
      // Get investor profile
      const prof = await getInvestorProfileIdByUserIdForNotes(session.cid || session.id);

      const res = await insertInvestorNote({ investor_id: prof.rows[0]?.id, pipeline_id, note_type, content });

      return NextResponse.json({ success: true, note: res.rows[0] });
    }

    if (action === "complete") {
      await completeDiligenceWorkspace(pipeline_id);
      return NextResponse.json({ success: true });
    }

    if (action === "add_followup") {
      const { request_id, question } = data;
      if (!question) return NextResponse.json({ success: false, error: "question required" }, { status: 400 });

      const session = await getSession();
      const current = await getDdRequestFollowUpQuestionsByRequestId(request_id);

      let questions = current.rows[0]?.follow_up_questions || [];
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
      const { request_id, question_index, response } = data;
      const current = await getDdRequestFollowUpQuestionsForRespond(request_id);

      let questions = current.rows[0]?.follow_up_questions || [];
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
