/**
 * Investor service — the diligence follow-up questions.
 *
 * `add_followup` and `respond_followup`: ask a question on an owned request, or
 * record its answer. The JSON-column edits are the pure helpers in `./questions`;
 * every statement lives in `@/models/investor`. No SQL, no HTTP.
 */

import {
  getDdRequestFollowUpQuestionsByRequestId,
  getDdRequestFollowUpQuestionsForRespond,
  updateDdRequestFollowUpQuestions,
  updateDdRequestFollowUpQuestionsForRespond,
} from "@/models/investor";
import { answerFollowUpQuestion, appendFollowUpQuestion } from "./questions";

/** Ask an unanswered follow-up question on an owned request. */
export async function addFollowUpQuestion({ payload, ownsRequest, actor }) {
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

/** Record the answer to a follow-up question on an owned request. */
export async function respondToFollowUpQuestion({ payload, ownsRequest }) {
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