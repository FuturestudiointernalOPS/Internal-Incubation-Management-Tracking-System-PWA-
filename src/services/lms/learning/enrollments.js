/**
 * LMS learner experience — the admin enrollment enabler.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions here, every statement in
 * `@/models/lms/learningStore`.
 */

import { loadStructure } from "./structure";
import { computeCourseProgress } from "./progress";
import { LmsError } from "@/models/lms/errors";
import { getCourse } from "@/models/lms/courses";
import {
  selectContactCidByEmail,
  insertEnrollment,
  selectEnrollmentsByCourse,
  selectContactsByCids,
  searchEnrollableContacts,
  selectLessonProgressByEnrollments,
  selectAttemptsByLearners,
  selectCourseLevelAssessments,
  selectEnrollmentOfCourse,
  selectLessonProgressDetail,
  selectAttemptsDetail,
  selectQuestionsByAssessments,
} from "@/models/lms/learningStore";

/**
 * Phase 8 — the LEARNER trigger, made INLINE (spec §8.2).
 *
 * An LMS enrollment is the business relation that justifies the `learner`
 * profile in the lms context. It had no inline call either, so the card only
 * appeared at the next connect / sweep. Best-effort: a reconcile failure never
 * fails the enrollment.
 */
async function reconcileLearnerContextGrants(cid) {
  if (!cid) return;
  try {
    const { syncContextGrantsForUser } = await import(
      "@/services/authorization/contextGrants"
    );
    await syncContextGrantsForUser(cid, { context: "lms", roleKey: "learner" });
  } catch (error) {
    console.error(
      `[lms] learner access reconcile failed for ${cid}:`,
      error.message,
    );
  }
}

export async function enrollLearner({ courseId, userCid, userEmail, source }) {
  const course = await getCourse(courseId);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);

  let cid = userCid;
  if (!cid && userEmail) {
    const res = await selectContactCidByEmail(userEmail);
    if (res.rows.length === 0) throw new LmsError("lms.errors.userNotFound", 404);
    cid = res.rows[0].cid;
  }
  if (!cid) throw new LmsError("lms.errors.userNotFound", 400);

  await insertEnrollment(courseId, cid, source);
  await reconcileLearnerContextGrants(cid);
  return { success: true, courseId, userCid: cid };
}

export async function listEnrollments(courseId) {
  const enrollRes = await selectEnrollmentsByCourse(courseId);
  const enrollments = enrollRes.rows;
  const cids = [...new Set(enrollments.map((enrollment) => enrollment.user_cid))];
  const byCid = new Map();
  if (cids.length > 0) {
    const contactsRes = await selectContactsByCids(cids);
    for (const contact of contactsRes.rows) byCid.set(String(contact.cid), contact);
  }

  // Progress and assessment results of every learner, read in bulk (one query
  // each) rather than once per learner: the roster stays fast on a remote DB.
  const structure = enrollments.length > 0 ? await loadStructure(courseId) : [];
  const assessments = structure.flatMap((section) => (section.assessment ? [section.assessment] : []));
  const finals = enrollments.length > 0 ? await selectCourseLevelAssessments(courseId) : [];
  const allAssessments = [...assessments, ...finals];
  const progressByEnrollment = new Map();
  const attemptsByLearner = new Map();
  if (enrollments.length > 0) {
    const progressRes = await selectLessonProgressByEnrollments(enrollments.map((e) => e.id));
    for (const row of progressRes.rows) {
      const map = progressByEnrollment.get(String(row.enrollment_id)) || {};
      map[String(row.lesson_id)] = row.status;
      progressByEnrollment.set(String(row.enrollment_id), map);
    }
    if (allAssessments.length > 0) {
      const attemptsRes = await selectAttemptsByLearners(cids, allAssessments.map((a) => a.id));
      for (const row of attemptsRes.rows) {
        const key = `${row.user_cid}|${row.assessment_id}`;
        (attemptsByLearner.get(key) || attemptsByLearner.set(key, []).get(key)).push(row);
      }
    }
  }

  return enrollments.map((enrollment) => {
    const progress = progressByEnrollment.get(String(enrollment.id)) || {};
    const results = allAssessments.map((assessment) => {
      const attempts = attemptsByLearner.get(`${enrollment.user_cid}|${assessment.id}`) || [];
      const percents = attempts.map((a) =>
        a.total_points > 0 ? Math.round((a.score / a.total_points) * 100) : 0,
      );
      return {
        id: assessment.id,
        title: assessment.title,
        is_required: assessment.is_required !== false,
        chapter: structure.find((s) => String(s.id) === String(assessment.section_id))?.title || null,
        attempts: attempts.length,
        bestPercent: percents.length ? Math.max(...percents) : null,
        state: attempts.some((a) => a.passed) ? "passed" : attempts.length ? "failed" : "todo",
      };
    });
    const courseProgress = computeCourseProgress(
      structure,
      progress,
      results.map((r) => ({ id: r.id, is_required: r.is_required, passed: r.state === "passed" })),
    );
    return {
      id: enrollment.id,
      user_cid: enrollment.user_cid,
      source: enrollment.source,
      status: enrollment.status,
      enrolled_at: enrollment.enrolled_at,
      completed_at: enrollment.completed_at,
      learner: byCid.get(String(enrollment.user_cid)) || null,
      progress: {
        percent: courseProgress.percent,
        completedLessons: courseProgress.completedLessons,
        totalLessons: courseProgress.totalLessons,
      },
      assessments: results,
    };
  });
}

/** Autocomplete for the enroll box: people matching `term` and still addable. */
export async function searchEnrollable(courseId, term) {
  const clean = String(term || "").trim();
  // One call returns everyone still addable (the browser filters as you type).
  const res = await searchEnrollableContacts(courseId, clean, 1000);
  return res.rows.map((row) => ({ cid: row.cid, name: row.name, email: row.email }));
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Everything the admin sees when opening one learner: lessons per chapter with
 * their completion, and every assessment attempt question by question (what was
 * answered, what was expected).
 */
export async function getEnrollmentDetail(courseId, enrollmentId) {
  const enrollRes = await selectEnrollmentOfCourse(courseId, enrollmentId);
  const enrollment = enrollRes.rows[0];
  if (!enrollment) throw new LmsError("lms.errors.notEnrolled", 404);

  const structure = await loadStructure(courseId);
  const finals = await selectCourseLevelAssessments(courseId);
  const assessments = [
    ...structure.flatMap((section) => (section.assessment ? [{ ...section.assessment, chapter: section.title }] : [])),
    ...finals.map((assessment) => ({ ...assessment, chapter: null })),
  ];
  const ids = assessments.map((assessment) => assessment.id);

  const [progressRes, contactRes, attemptsRes, questionsRes] = await Promise.all([
    selectLessonProgressDetail(enrollment.id),
    selectContactsByCids([enrollment.user_cid]),
    ids.length ? selectAttemptsDetail(enrollment.user_cid, ids) : { rows: [] },
    ids.length ? selectQuestionsByAssessments(ids) : { rows: [] },
  ]);
  const progress = new Map(progressRes.rows.map((row) => [String(row.lesson_id), row]));
  const questionsByAssessment = new Map();
  for (const row of questionsRes.rows) {
    const list = questionsByAssessment.get(String(row.assessment_id)) || [];
    list.push(row);
    questionsByAssessment.set(String(row.assessment_id), list);
  }

  const chapters = structure.map((section) => ({
    id: section.id,
    title: section.title,
    lessons: section.lessons.map((lesson) => {
      const row = progress.get(String(lesson.id));
      return {
        id: lesson.id,
        title: lesson.title,
        is_required: lesson.is_required !== false,
        completed: row?.status === "completed",
        completed_at: row?.status === "completed" ? row.completed_at : null,
      };
    }),
  }));

  const results = assessments.map((assessment) => {
    const questions = questionsByAssessment.get(String(assessment.id)) || [];
    const attempts = attemptsRes.rows
      .filter((row) => String(row.assessment_id) === String(assessment.id))
      .map((row) => {
        const answers = parseJson(row.answers, []);
        const answerByQuestion = new Map(answers.map((a) => [String(a.questionId), a.answer]));
        return {
          attempt_number: row.attempt_number,
          score: row.score,
          total_points: row.total_points,
          percent: row.total_points > 0 ? Math.round((row.score / row.total_points) * 100) : 0,
          passed: !!row.passed,
          completed_at: row.completed_at,
          questions: questions.map((question) => {
            const options = parseJson(question.options, []);
            const correct = String(parseJson(question.correct_answer, [])[0] ?? "");
            const given = answerByQuestion.has(String(question.id)) ? String(answerByQuestion.get(String(question.id))) : null;
            const label = (key) => {
              if (key == null) return null;
              const option = options.find((o) => String(o.key) === key);
              return option ? { key, text: option.text } : { key, text: null };
            };
            return {
              id: question.id,
              question: question.question,
              question_type: question.question_type,
              correct: given != null && given === correct,
              given: label(given),
              expected: label(correct),
            };
          }),
        };
      });
    return {
      id: assessment.id,
      title: assessment.title,
      chapter: assessment.chapter,
      pass_mark: assessment.pass_mark,
      is_required: assessment.is_required !== false,
      attempts,
    };
  });

  const contact = contactRes.rows[0] || null;
  return {
    id: enrollment.id,
    user_cid: enrollment.user_cid,
    status: enrollment.status,
    source: enrollment.source,
    enrolled_at: enrollment.enrolled_at,
    completed_at: enrollment.completed_at,
    learner: contact,
    chapters,
    assessments: results,
  };
}
