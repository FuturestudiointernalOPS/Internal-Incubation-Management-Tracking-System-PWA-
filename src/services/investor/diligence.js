/**
 * Investor service — the due-diligence workspace.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — the own-scope
 * binding, the per-role status transitions, the version-history and
 * follow-up-question manipulation, and the whole POST action dispatch. Every
 * statement lives in `@/models/investor`. No SQL, no HTTP: a refusal is a value
 * ({ ok: false, error, status }) the HTTP boundary turns into a response.
 */

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
import {
  resolveInvestorScope,
  investorOwnsPipeline,
  investorOwnsDdRequest,
} from "@/models/authorization/investorScope";

/** Parse a JSON column that may arrive as a string, a value, or nothing. */
function toArray(value) {
  let parsed = value || [];
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch (_) {
      parsed = [];
    }
  }
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Which status transitions a caller may make on a diligence request.
 *
 * A caller with investor CONTEXT (investor role, or a baseline member holding
 * an investor profile) must not receive the Venture-side transitions. This was
 * previously decided on the role STRING, so a member-with-profile slipped
 * through as if they were a founder.
 */
export function canTransitionDiligenceStatus({
  status,
  isAdmin,
  isRM,
  isIM,
  isInvestorContext,
}) {
  const allowedTransitions = {
    under_review: isAdmin || isRM,
    documents_uploaded: isAdmin || isRM || !isInvestorContext,
    verified: isAdmin || isIM,
    completed: isAdmin || isIM,
    responded: isAdmin || isRM || isIM || !isInvestorContext,
    closed: isAdmin || isRM || isIM,
  };
  return Boolean(allowedTransitions[status]) || isAdmin;
}

/** The refusal message a blocked transition shows. */
export function diligenceTransitionRefusal(status) {
  const who =
    status === "under_review"
      ? "Relationship Manager"
      : status === "verified" || status === "completed"
        ? "Investment Manager"
        : "authorized staff";
  return `Only the ${who} can perform this action.`;
}

/** Append a status-change entry to the request's version history. */
export function appendTransitionHistory(row, { toStatus, changedBy, notes, now }) {
  const history = toArray(row?.version_history);
  history.push({
    from_status: row?.status,
    to_status: toStatus,
    changed_at: now || new Date().toISOString(),
    changed_by: changedBy || "system",
    notes: notes || null,
  });
  return history;
}

/** Append an unanswered follow-up question. */
export function appendFollowUpQuestion(rawQuestions, { question, askedBy, now }) {
  const questions = toArray(rawQuestions);
  questions.push({
    question,
    asked_by: askedBy,
    asked_at: now || new Date().toISOString(),
    response: null,
  });
  return questions;
}

/** Record the answer to one follow-up question. */
export function answerFollowUpQuestion(rawQuestions, { index, response, now }) {
  const questions = toArray(rawQuestions);
  if (questions[index]) {
    questions[index].response = response;
    questions[index].responded_at = now || new Date().toISOString();
  }
  return questions;
}

/** Whether the caller may read this pipeline's diligence. */
export async function canViewDiligencePipeline(scope, pipelineId) {
  if (scope.management) return true;
  return investorOwnsPipeline(pipelineId, scope.profileId);
}

/** Read the diligence workspace, its requests, notes and pipeline. */
export async function loadDiligence(pipelineId) {
  let workspace = null;
  const workspaceResult = await getDiligenceWorkspaceByPipelineId(pipelineId);
  if (workspaceResult.rows.length > 0) workspace = workspaceResult.rows[0];

  let requests = [];
  if (workspace) {
    const requestsResult = await listDdInformationRequestsByWorkspaceId(workspace.id);
    requests = requestsResult.rows;
  }

  const notesResult = await listInvestorNotesByPipelineId(pipelineId);
  const pipelineResult = await getPipelineWithVentureById(pipelineId);

  return {
    workspace,
    requests,
    notes: notesResult.rows,
    pipeline: pipelineResult.rows[0] || null,
  };
}

/** Whether the caller may read the diligence of a pipeline. */
export async function buildDiligenceForViewer({ pipelineId, session }) {
  const scope = await resolveInvestorScope(session);
  if (!(await canViewDiligencePipeline(scope, pipelineId))) {
    return { ok: false, error: "errors.notFound", status: 404 };
  }
  return { ok: true, ...(await loadDiligence(pipelineId)) };
}

/**
 * Run one POST action on the diligence workspace. Returns `{ ok: true, ...data }`
 * or a refusal `{ ok: false, error, status }`.
 */
export async function runDiligenceAction({ action, payload, session, pipelineId }) {
  const scope = await resolveInvestorScope(session);

  // Own-scope: every action below keys on this pipeline (or on a request that
  // resolves to it), so bind it to the caller's investor profile first.
  const ownsPipeline =
    scope.management || (await investorOwnsPipeline(pipelineId, scope.profileId));
  if (!ownsPipeline) return { ok: false, error: "errors.notFound", status: 404 };

  const ownsRequest = async (requestId) =>
    scope.management || (await investorOwnsDdRequest(requestId, scope.profileId));

  const actor = session?.cid || session?.id;

  if (action === "create_workspace") {
    const workspaceResult = await upsertDiligenceWorkspace(pipelineId);
    await updatePipelineStageToDueDiligence(pipelineId);
    return { ok: true, workspace: workspaceResult.rows[0] };
  }

  if (action === "add_request") {
    const { title, description, category, priority, due_date, owner_id } = payload;
    if (!title) return { ok: false, error: "title required", status: 400 };

    const workspaceLookup = await getDiligenceWorkspaceIdByPipelineId(pipelineId);
    if (workspaceLookup.rows.length === 0) {
      return { ok: false, error: "Workspace not found. Create it first.", status: 404 };
    }

    const requestResult = await insertDdInformationRequest({
      workspace_id: workspaceLookup.rows[0].id,
      title,
      description,
      category,
      priority,
      due_date,
      owner_id,
    });

    try {
      const relationshipWorkspaceResult =
        await getRelationshipWorkspaceIdByPipelineId(pipelineId);
      if (relationshipWorkspaceResult.rows.length > 0) {
        await insertDdRequestAddedTimeline({
          workspace_id: relationshipWorkspaceResult.rows[0].id,
          title,
          category,
        });
      }
    } catch (_) {}

    return { ok: true, request: requestResult.rows[0] };
  }

  if (action === "update_request") {
    const { request_id, status, response_text, response_file_url } = payload;
    if (!(await ownsRequest(request_id))) {
      return { ok: false, error: "errors.notFound", status: 404 };
    }

    const requestInfo = await getDdRequestInfoByRequestId(request_id);
    if (requestInfo.rows.length === 0) {
      return { ok: false, error: "Request not found", status: 404 };
    }
    const requestPipelineId = requestInfo.rows[0].pipeline_id;

    const relationshipWorkspaceResult =
      await getRelationshipWorkspaceAssigneesByPipelineId(requestPipelineId);
    const relationshipWorkspace = relationshipWorkspaceResult.rows[0] || {};
    const isRM = relationshipWorkspace.relationship_manager_id === actor;
    const isIM = relationshipWorkspace.investment_manager_id === actor;
    const isAdmin = session?.role === "super_admin";
    const isInvestorContext =
      !scope.management && scope.profileId !== null && scope.profileId !== undefined;

    if (!canTransitionDiligenceStatus({ status, isAdmin, isRM, isIM, isInvestorContext })) {
      return {
        ok: false,
        error: diligenceTransitionRefusal(status),
        status: 403,
      };
    }

    const versionHistoryResult = await getDdRequestVersionHistoryByRequestId(request_id);
    const newHistory = appendTransitionHistory(versionHistoryResult.rows[0], {
      toStatus: status,
      changedBy: actor,
      notes: response_text,
    });

    await updateDdRequestResponse({
      status,
      response_text,
      response_file_url,
      version_history: JSON.stringify(newHistory),
      request_id,
    });

    try {
      const timelineInfo = await getDdRequestInfoForTimeline(request_id);
      if (timelineInfo.rows.length > 0) {
        const relationshipWorkspaceForTimeline =
          await getRelationshipWorkspaceIdForStatusTimeline(timelineInfo.rows[0].pipeline_id);
        if (relationshipWorkspaceForTimeline.rows.length > 0) {
          await insertDdStatusChangedTimeline({
            workspace_id: relationshipWorkspaceForTimeline.rows[0].id,
            title: timelineInfo.rows[0].title,
            status,
          });
        }
      }
    } catch (_) {}

    return { ok: true };
  }

  if (action === "add_note") {
    const { content, note_type } = payload;
    if (!content) return { ok: false, error: "content required", status: 400 };

    const profileResult = await getInvestorProfileIdByUserIdForNotes(actor);
    const noteResult = await insertInvestorNote({
      investor_id: profileResult.rows[0]?.id,
      pipeline_id: pipelineId,
      note_type,
      content,
    });
    return { ok: true, note: noteResult.rows[0] };
  }

  if (action === "complete") {
    await completeDiligenceWorkspace(pipelineId);
    return { ok: true };
  }

  if (action === "add_followup") {
    const { request_id, question } = payload;
    if (!question) return { ok: false, error: "question required", status: 400 };
    if (!(await ownsRequest(request_id))) {
      return { ok: false, error: "errors.notFound", status: 404 };
    }

    const followUpQuestionsResult = await getDdRequestFollowUpQuestionsByRequestId(request_id);
    const questions = appendFollowUpQuestion(
      followUpQuestionsResult.rows[0]?.follow_up_questions,
      { question, askedBy: actor || "investor" },
    );
    await updateDdRequestFollowUpQuestions({ questions, request_id });
    return { ok: true, follow_up_questions: questions };
  }

  if (action === "respond_followup") {
    const { request_id, question_index, response } = payload;
    if (!(await ownsRequest(request_id))) {
      return { ok: false, error: "errors.notFound", status: 404 };
    }

    const followUpQuestionsResult = await getDdRequestFollowUpQuestionsForRespond(request_id);
    const questions = answerFollowUpQuestion(
      followUpQuestionsResult.rows[0]?.follow_up_questions,
      { index: question_index, response },
    );
    await updateDdRequestFollowUpQuestionsForRespond({ questions, request_id });
    return { ok: true, follow_up_questions: questions };
  }

  return { ok: false, error: "Unknown action", status: 400 };
}
