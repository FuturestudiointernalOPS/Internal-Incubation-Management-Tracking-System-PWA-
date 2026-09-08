import db from "@/lib/db";
import { LmsError } from "./errors";
import { nextPosition } from "./helpers";
import { getCourse } from "./courses";
import { getSection } from "./sections";

/**
 * Assessment authoring (V1 types: multiple_choice, true_false).
 * Phase 2 is authoring-only — the scoring engine and attempts UI are later.
 */

export async function getAssessment(assessmentId) {
  const res = await db.execute({
    sql: "SELECT * FROM lms_assessments WHERE id = ?",
    args: [assessmentId],
  });
  return res.rows[0] || null;
}

export async function getQuestion(questionId) {
  const res = await db.execute({
    sql: "SELECT * FROM lms_assessment_questions WHERE id = ?",
    args: [questionId],
  });
  return res.rows[0] || null;
}

function normalizePassMark(passMark) {
  if (passMark == null || passMark === "") return null;
  const n = Number(passMark);
  if (Number.isNaN(n) || n < 0 || n > 100) {
    throw new LmsError("lms.errors.invalidPassMark", 400);
  }
  return Math.round(n);
}

const QUESTION_TYPES = ["multiple_choice", "true_false"];

/**
 * Question type is chosen at ASSESSMENT level: every question added to an
 * assessment shares the assessment's type. Defaults to multiple_choice for
 * rows created before the column existed.
 */
function normalizeQuestionType(value) {
  const type = value == null || value === "" ? "multiple_choice" : String(value);
  if (!QUESTION_TYPES.includes(type)) {
    throw new LmsError("lms.errors.invalidQuestionType", 400);
  }
  return type;
}

export async function createAssessment({
  courseId,
  sectionId,
  title,
  description,
  passMark,
  isRequired,
  questionType,
}) {
  const course = await getCourse(courseId);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);
  if (!title || !String(title).trim()) {
    throw new LmsError("lms.errors.assessmentTitleRequired", 400);
  }
  if (sectionId) {
    const section = await getSection(sectionId);
    if (!section || String(section.course_id) !== String(courseId)) {
      throw new LmsError("lms.errors.sectionNotFound", 400);
    }
  }
  const position = await nextPosition("lms_assessments", "course_id", courseId);
  const res = await db.execute({
    sql: `INSERT INTO lms_assessments (course_id, section_id, title, description, question_type, position, is_required, pass_mark)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [
      courseId,
      sectionId || null,
      String(title).trim(),
      description || null,
      normalizeQuestionType(questionType),
      position,
      isRequired !== false,
      normalizePassMark(passMark),
    ],
  });
  return res.rows[0];
}

export async function updateAssessment(
  assessmentId,
  { title, description, passMark, isRequired, sectionId, questionType } = {},
) {
  const assessment = await getAssessment(assessmentId);
  if (!assessment) throw new LmsError("lms.errors.assessmentNotFound", 404);

  const sets = [];
  const args = [];

  if (title !== undefined) {
    if (!String(title).trim()) throw new LmsError("lms.errors.assessmentTitleRequired", 400);
    sets.push("title = ?");
    args.push(String(title).trim());
  }
  if (description !== undefined) {
    sets.push("description = ?");
    args.push(description || null);
  }
  if (passMark !== undefined) {
    sets.push("pass_mark = ?");
    args.push(normalizePassMark(passMark));
  }
  if (isRequired !== undefined) {
    sets.push("is_required = ?");
    args.push(isRequired !== false);
  }
  if (sectionId !== undefined) {
    if (sectionId) {
      const section = await getSection(sectionId);
      if (!section || String(section.course_id) !== String(assessment.course_id)) {
        throw new LmsError("lms.errors.sectionNotFound", 400);
      }
    }
    sets.push("section_id = ?");
    args.push(sectionId || null);
  }
  if (questionType !== undefined) {
    const nextType = normalizeQuestionType(questionType);
    if (nextType !== (assessment.question_type || "multiple_choice")) {
      // Changing the type would invalidate already-authored questions.
      const existing = await db.execute({
        sql: "SELECT 1 FROM lms_assessment_questions WHERE assessment_id = ? LIMIT 1",
        args: [assessmentId],
      });
      if (existing.rows.length > 0) {
        throw new LmsError("lms.errors.assessmentTypeLocked", 400);
      }
      sets.push("question_type = ?");
      args.push(nextType);
    }
  }

  if (sets.length === 0) return assessment;
  sets.push("updated_at = NOW()");
  args.push(assessmentId);
  await db.execute({
    sql: `UPDATE lms_assessments SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
  return getAssessment(assessmentId);
}

export async function deleteAssessment(assessmentId) {
  const assessment = await getAssessment(assessmentId);
  if (!assessment) throw new LmsError("lms.errors.assessmentNotFound", 404);

  const attempts = await db.execute({
    sql: "SELECT 1 FROM lms_assessment_attempts WHERE assessment_id = ? LIMIT 1",
    args: [assessmentId],
  });
  if (attempts.rows.length > 0) {
    throw new LmsError("lms.errors.cannotDeleteWithAttempts", 409);
  }
  await db.execute({
    sql: "DELETE FROM lms_assessments WHERE id = ?",
    args: [assessmentId],
  });
  return { success: true };
}

// ─── Questions ──────────────────────────────────────────────────────────────

function validateQuestionData({ question_type, options, correct_answer }) {
  if (question_type === "multiple_choice") {
    const opts = Array.isArray(options) ? options : [];
    if (opts.length < 2) throw new LmsError("lms.errors.mcOptionsRequired", 400);
    const keys = opts.map((o) => String(o.key));
    if (!Array.isArray(correct_answer) || correct_answer.length === 0) {
      throw new LmsError("lms.errors.correctAnswerRequired", 400);
    }
    for (const c of correct_answer) {
      if (!keys.includes(String(c))) {
        throw new LmsError("lms.errors.correctAnswerRequired", 400);
      }
    }
  } else if (question_type === "true_false") {
    if (
      !Array.isArray(correct_answer) ||
      correct_answer.length === 0 ||
      !["true", "false"].includes(String(correct_answer[0]))
    ) {
      throw new LmsError("lms.errors.correctAnswerRequired", 400);
    }
  } else {
    throw new LmsError("lms.errors.invalidQuestionType", 400);
  }
}

export async function createQuestion({
  assessmentId,
  question,
  options,
  correctAnswer,
  points,
}) {
  const assessment = await getAssessment(assessmentId);
  if (!assessment) throw new LmsError("lms.errors.assessmentNotFound", 404);
  if (!question || !String(question).trim()) {
    throw new LmsError("lms.errors.questionTextRequired", 400);
  }
  // New questions always inherit the assessment's chosen type.
  const type = assessment.question_type || "multiple_choice";
  validateQuestionData({
    question_type: type,
    options,
    correct_answer: correctAnswer,
  });

  const position = await nextPosition(
    "lms_assessment_questions",
    "assessment_id",
    assessmentId,
  );
  const res = await db.execute({
    sql: `INSERT INTO lms_assessment_questions (assessment_id, question, question_type, options, correct_answer, points, position)
          VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?, ?) RETURNING *`,
    args: [
      assessmentId,
      String(question).trim(),
      type,
      JSON.stringify(options || []),
      JSON.stringify(correctAnswer || []),
      points || 1,
      position,
    ],
  });
  return res.rows[0];
}

export async function updateQuestion(
  questionId,
  { question, options, correctAnswer, points } = {},
) {
  const existing = await getQuestion(questionId);
  if (!existing) throw new LmsError("lms.errors.questionNotFound", 404);

  // Type is immutable per question — it always matches the assessment's type.
  const type = existing.question_type || "multiple_choice";
  const opts = options !== undefined ? options : existing.options;
  const answer = correctAnswer !== undefined ? correctAnswer : existing.correct_answer;
  validateQuestionData({ question_type: type, options: opts, correct_answer: answer });

  const sets = [];
  const args = [];
  if (question !== undefined) {
    if (!String(question).trim()) throw new LmsError("lms.errors.questionTextRequired", 400);
    sets.push("question = ?");
    args.push(String(question).trim());
  }
  if (options !== undefined) {
    sets.push("options = ?::jsonb");
    args.push(JSON.stringify(opts));
  }
  if (correctAnswer !== undefined) {
    sets.push("correct_answer = ?::jsonb");
    args.push(JSON.stringify(answer));
  }
  if (points !== undefined) {
    sets.push("points = ?");
    args.push(points || 1);
  }
  if (sets.length === 0) return existing;

  sets.push("updated_at = NOW()");
  args.push(questionId);
  await db.execute({
    sql: `UPDATE lms_assessment_questions SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
  return getQuestion(questionId);
}

/** Swap a question with its up/down neighbour within the same assessment. */
export async function moveQuestion(questionId, direction) {
  const question = await getQuestion(questionId);
  if (!question) throw new LmsError("lms.errors.questionNotFound", 404);
  if (direction !== "up" && direction !== "down") {
    throw new LmsError("lms.errors.invalidDirection", 400);
  }
  const neighbor = await db.execute({
    sql:
      direction === "up"
        ? `SELECT id, position FROM lms_assessment_questions
           WHERE assessment_id = ? AND position < ? ORDER BY position DESC LIMIT 1`
        : `SELECT id, position FROM lms_assessment_questions
           WHERE assessment_id = ? AND position > ? ORDER BY position ASC LIMIT 1`,
    args: [question.assessment_id, question.position],
  });
  if (neighbor.rows.length === 0) return { success: true, moved: false };
  const target = neighbor.rows[0];

  await db.transaction(async (query) => {
    await query("UPDATE lms_assessment_questions SET position = -1 WHERE id = ?", [question.id]);
    await query("UPDATE lms_assessment_questions SET position = ? WHERE id = ?", [
      question.position,
      target.id,
    ]);
    await query("UPDATE lms_assessment_questions SET position = ? WHERE id = ?", [
      target.position,
      question.id,
    ]);
  });
  return { success: true, moved: true };
}

export async function deleteQuestion(questionId) {
  const question = await getQuestion(questionId);
  if (!question) throw new LmsError("lms.errors.questionNotFound", 404);
  await db.execute({
    sql: "DELETE FROM lms_assessment_questions WHERE id = ?",
    args: [questionId],
  });
  return { success: true };
}
