/**
 * DELIVERABLE SUBMISSIONS — the score use-case.
 *
 * Writes a score / evaluation to one submission (by id) or to every submission
 * of a participant in a program.
 *
 * See docs/LAYER_SPLIT.md.
 */

import {
  ensureSubmissionEvaluationScoreColumn,
  ensureSubmissionScoresColumn,
  updateSubmissionScoreById,
  updateSubmissionsScoreForParticipant,
} from "@/models/forms";

/**
 * Write a score / evaluation to one submission (by id) or to every submission of
 * a participant in a program. Ensures both score columns exist first.
 */
export async function saveSubmissionScore({ id, participantId, programId, score, evaluationData }) {
  // Ensure both score columns exist (migration safety).
  try { await ensureSubmissionScoresColumn(); } catch (_) {}
  try { await ensureSubmissionEvaluationScoreColumn(); } catch (_) {}

  const payload = {
    score: score != null ? parseInt(score) : null,
    evaluation_score: score != null ? parseInt(score) : null,
    evaluation_data: evaluationData ? JSON.stringify(evaluationData) : null,
  };

  if (id) {
    await updateSubmissionScoreById({ ...payload, id });
  } else {
    await updateSubmissionsScoreForParticipant({
      ...payload,
      participant_id: participantId,
      program_id: programId,
    });
  }
}
