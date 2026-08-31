/**
 * LMS assessment scoring — PURE (no DB access).
 *
 * V1 scoring (ticket §11):
 *   percent = round(correct count / question count × 100)
 *   pass when percent >= pass mark
 * Each question counts 1 point (the Phase 1 `points` column is persisted for
 * future use but does not weight V1 scoring, matching the approved formula).
 *
 * Also validates the submission (ticket §25): every question must be answered,
 * question IDs must belong to the assessment, no duplicates, and MC answers
 * must be a configured option key / TF answers must be `true`|`false`.
 */

const TRUE_FALSE_ANSWERS = ["true", "false"];

/**
 * @param {Array<{id, question_type, options?: Array<{key}>, correct_answer?: Array}>} questions
 * @param {Array<{questionId, answer}>} submittedAnswers
 * @returns {{valid: boolean, error?: string, correctCount?: number, total?: number, percent?: number}}
 */
export function scoreAssessment(questions, submittedAnswers) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { valid: false, error: "lms.errors.assessmentUnavailable" };
  }
  if (!Array.isArray(submittedAnswers)) {
    return { valid: false, error: "lms.errors.invalidSubmission" };
  }

  const questionById = new Map(questions.map((q) => [String(q.id), q]));

  // Every question must be answered exactly once.
  const seen = new Set();
  for (const item of submittedAnswers) {
    if (!item || !item.questionId) return { valid: false, error: "lms.errors.invalidSubmission" };
    const key = String(item.questionId);
    if (seen.has(key)) return { valid: false, error: "lms.errors.invalidSubmission" };
    seen.add(key);
    const question = questionById.get(key);
    if (!question) return { valid: false, error: "lms.errors.invalidSubmission" };
    if (!isValidAnswer(question, item.answer)) {
      return { valid: false, error: "lms.errors.invalidSubmission" };
    }
  }
  if (seen.size !== questions.length) {
    return { valid: false, error: "lms.errors.answerRequired" };
  }

  let correctCount = 0;
  for (const item of submittedAnswers) {
    const question = questionById.get(String(item.questionId));
    const correct = Array.isArray(question.correct_answer) ? question.correct_answer : [];
    if (String(item.answer) === String(correct[0])) correctCount += 1;
  }

  const total = questions.length;
  const percent = Math.round((correctCount / total) * 100);
  return { valid: true, correctCount, total, percent };
}

function isValidAnswer(question, answer) {
  if (answer == null || String(answer).trim() === "") return false;
  if (question.question_type === "true_false") {
    return TRUE_FALSE_ANSWERS.includes(String(answer));
  }
  // multiple_choice: the answer must be one of the author-configured option keys.
  const options = Array.isArray(question.options) ? question.options : [];
  return options.some((o) => String(o.key) === String(answer));
}
