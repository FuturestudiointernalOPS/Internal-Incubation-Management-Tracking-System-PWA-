/**
 * Investor service — the diligence history + follow-up manipulations.
 *
 * The pure array edits behind a diligence request's version history and its
 * follow-up questions: append a transition, ask a question, answer a question.
 * The reads and writes live in `@/models/investor`.
 */

import { toArray } from "./json";

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