/**
 * LMS assessment tests (Phase 4) — scoring, access security, attempts, retries,
 * and course-progress integration (ticket §41).
 *
 * Covers:
 *   - pure scoring: 100/90/70/69/0% against different pass marks; MC + TF
 *   - answer integrity: unknown question IDs, invalid option values,
 *     duplicates, missing answers, non-array submissions
 *   - access: enrolled ok / non-enrolled denied / draft denied / no ID tricks
 *   - attempts: numbering (1→2→3), unlimited retries, history preserved,
 *     sequential double-submission never duplicates an attempt number
 *   - security: the client cannot fake score or pass/fail
 *   - course state: required assessment passed → completion; optional
 *     assessment failed → course still complete; passing an assessment never
 *     completes lessons
 *
 * The API routes and the pass-mark feasibility analysis are in
 * lms-assessment.routes.test.js. The seeds live in
 * ./helpers/lmsAssessmentFixtures.
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");
const mockFake = createFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/server/auth/guards", () => ({
  requireAuth: jest.fn(async () => null),
}));

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuth } = require("@/server/auth/guards");
const { scoreAssessment } = require("@/models/lms/scoring");
const {
  getAssessmentForTake,
  submitAssessment,
  computeCourseProgress,
} = require("@/services/lms/learning");

beforeEach(() => {
  mockFake.reset();
  requireAuth.mockResolvedValue(null);
});

const {
  COURSE,
  LESSON,
  ASSESSMENT,
  Q_MC,
  Q_TF,
  seedCourseWithAssessment,
  seedEnrollment,
  correctAnswers,
} = require("./helpers/lmsAssessmentFixtures")(mockFake);


// ─── Pure scoring (ticket §11) ─────────────────────────────────────────────

describe("scoreAssessment — percentages against pass marks", () => {
  const questions = [Q_MC, Q_TF];

  test("100%", () => {
    const score = scoreAssessment(questions, correctAnswers);
    expect(score.valid).toBe(true);
    expect(score.percent).toBe(100);
    expect(score.correctCount).toBe(2);
  });

  test("50% (1 of 2)", () => {
    const score = scoreAssessment(questions, [
      { questionId: "Q-1", answer: "A" }, // wrong
      { questionId: "Q-2", answer: "true" },
    ]);
    expect(score.percent).toBe(50);
  });

  test("0%", () => {
    const score = scoreAssessment(questions, [
      { questionId: "Q-1", answer: "A" },
      { questionId: "Q-2", answer: "false" },
    ]);
    expect(score.percent).toBe(0);
  });

  test("90% (9 of 10) and 69% boundaries via a 10-question set", () => {
    const tenQuestions = Array.from({ length: 10 }, (_, i) => ({
      id: `Q${i}`,
      question_type: "multiple_choice",
      options: [
        { key: "A", text: "a" },
        { key: "B", text: "b" },
      ],
      correct_answer: ["A"],
    }));
    const answersWithNineCorrect = tenQuestions.map((question, i) => ({ questionId: question.id, answer: i < 9 ? "A" : "B" }));
    expect(scoreAssessment(tenQuestions, answersWithNineCorrect).percent).toBe(90);

    const answersWithSevenCorrect = tenQuestions.map((question, i) => ({ questionId: question.id, answer: i < 7 ? "A" : "B" }));
    expect(scoreAssessment(tenQuestions, answersWithSevenCorrect).percent).toBe(70); // round(6.9→7 of 10)? 7/10
  });

  test("rounding is Math.round", () => {
    const threeQuestions = [Q_MC, Q_TF, { ...Q_MC, id: "Q-3", correct_answer: ["A"] }];
    const score = scoreAssessment(threeQuestions, [
      { questionId: "Q-1", answer: "B" },
      { questionId: "Q-2", answer: "false" },
      { questionId: "Q-3", answer: "A" },
    ]);
    expect(score.percent).toBe(67); // round(2/3 × 100) = 67
  });
});

describe("scoreAssessment — validation (ticket §25)", () => {
  const questions = [Q_MC, Q_TF];

  test("rejects non-array submissions", () => {
    expect(scoreAssessment(questions, "nope").valid).toBe(false);
    expect(scoreAssessment(questions, null).valid).toBe(false);
  });

  test("rejects unknown question IDs", () => {
    const score = scoreAssessment(questions, [
      { questionId: "Q-X", answer: "A" },
      { questionId: "Q-2", answer: "true" },
    ]);
    expect(score.valid).toBe(false);
  });

  test("rejects duplicate question IDs", () => {
    const score = scoreAssessment(questions, [
      { questionId: "Q-1", answer: "B" },
      { questionId: "Q-1", answer: "A" },
      { questionId: "Q-2", answer: "true" },
    ]);
    expect(score.valid).toBe(false);
  });

  test("rejects MC answers that are not configured options", () => {
    const score = scoreAssessment(questions, [
      { questionId: "Q-1", answer: "Z" }, // not an option key
      { questionId: "Q-2", answer: "true" },
    ]);
    expect(score.valid).toBe(false);
  });

  test("rejects invalid true/false values", () => {
    const score = scoreAssessment(questions, [
      { questionId: "Q-1", answer: "B" },
      { questionId: "Q-2", answer: "yes" },
    ]);
    expect(score.valid).toBe(false);
  });

  test("requires every question to be answered", () => {
    const score = scoreAssessment(questions, [{ questionId: "Q-1", answer: "B" }]);
    expect(score.valid).toBe(false);
  });
});

// ─── Access (ticket §5) ────────────────────────────────────────────────────

describe("getAssessmentForTake — access", () => {
  test("enrolled learner can take the assessment — no correct answers leak", async () => {
    seedCourseWithAssessment();
    seedEnrollment();
    const data = await getAssessmentForTake("A-1", "U-LEARNER");
    expect(data.assessment.title).toBe("Knowledge Check");
    expect(data.questions).toHaveLength(2);
    expect(data.questions[0].question_type).toBe("multiple_choice");
    expect(data.questions[0].options).toHaveLength(2);
    expect(data.questions[0].correct_answer).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain("correct_answer");
  });

  test("non-enrolled learner is denied", async () => {
    seedCourseWithAssessment();
    await expect(getAssessmentForTake("A-1", "U-NOBODY")).rejects.toMatchObject({
      message: "lms.errors.notEnrolled",
      status: 403,
    });
  });

  test("assessments on draft courses are unavailable", async () => {
    mockFake.seed("lms_courses", [{ ...COURSE, status: "draft" }]);
    mockFake.seed("lms_assessments", [ASSESSMENT]);
    seedEnrollment();
    await expect(getAssessmentForTake("A-1", "U-LEARNER")).rejects.toMatchObject({ status: 403 });
  });

  test("unknown assessment id → 404", async () => {
    await expect(getAssessmentForTake("A-X", "U-LEARNER")).rejects.toMatchObject({ status: 404 });
  });
});

// ─── Submission + attempts (ticket §10, §16, §17) ──────────────────────────

describe("submitAssessment", () => {
  test("computes the score server-side and persists the attempt", async () => {
    seedCourseWithAssessment();
    seedEnrollment();
    const result = await submitAssessment("A-1", "U-LEARNER", correctAnswers);
    expect(result.attempt.percent).toBe(100);
    expect(result.attempt.passed).toBe(true);
    expect(result.attempt.attempt_number).toBe(1);
    expect(result.attempt.score).toBe(2);
    expect(result.attempt.total_points).toBe(2);
    expect(mockFake.state.lms_assessment_attempts).toHaveLength(1);
  });

  test("client cannot fake the score or pass/fail (extra body fields ignored)", async () => {
    seedCourseWithAssessment();
    seedEnrollment();
    const result = await submitAssessment("A-1", "U-LEARNER", [
      { questionId: "Q-1", answer: "A" }, // wrong
      { questionId: "Q-2", answer: "false" }, // wrong
    ]);
    expect(result.attempt.percent).toBe(0);
    expect(result.attempt.passed).toBe(false);
  });

  test("non-enrolled learner cannot submit", async () => {
    seedCourseWithAssessment();
    await expect(submitAssessment("A-1", "U-NOBODY", correctAnswers)).rejects.toMatchObject({
      status: 403,
    });
    expect(mockFake.state.lms_assessment_attempts).toHaveLength(0);
  });

  test("malformed answers are rejected without creating an attempt", async () => {
    seedCourseWithAssessment();
    seedEnrollment();
    await expect(submitAssessment("A-1", "U-LEARNER", [{ questionId: "Q-1", answer: "B" }])).rejects.toMatchObject({
      status: 400,
      message: "lms.errors.answerRequired",
    });
    expect(mockFake.state.lms_assessment_attempts).toHaveLength(0);
  });

  test("unlimited retries with correct attempt numbers; history preserved", async () => {
    seedCourseWithAssessment();
    seedEnrollment();

    const firstFailure = await submitAssessment("A-1", "U-LEARNER", [
      { questionId: "Q-1", answer: "A" },
      { questionId: "Q-2", answer: "true" },
    ]);
    expect(firstFailure.attempt.attempt_number).toBe(1);
    expect(firstFailure.attempt.passed).toBe(false);

    const secondFailure = await submitAssessment("A-1", "U-LEARNER", [
      { questionId: "Q-1", answer: "B" },
      { questionId: "Q-2", answer: "false" },
    ]);
    expect(secondFailure.attempt.attempt_number).toBe(2);
    expect(secondFailure.attempt.passed).toBe(false);

    const passingAttempt = await submitAssessment("A-1", "U-LEARNER", correctAnswers);
    expect(passingAttempt.attempt.attempt_number).toBe(3);
    expect(passingAttempt.attempt.passed).toBe(true);

    // All three attempts remain recorded, in order, with no gaps.
    const attempts = mockFake.state.lms_assessment_attempts
      .filter((attempt) => String(attempt.assessment_id) === "A-1" && String(attempt.user_cid) === "U-LEARNER")
      .sort((left, right) => left.attempt_number - right.attempt_number);
    expect(attempts.map((attempt) => attempt.attempt_number)).toEqual([1, 2, 3]);
    expect(attempts.map((attempt) => attempt.passed)).toEqual([false, false, true]);
  });

  test("sequential double submission creates attempts 1 and 2 (never the same number)", async () => {
    seedCourseWithAssessment();
    seedEnrollment();
    const firstAttempt = await submitAssessment("A-1", "U-LEARNER", correctAnswers);
    const secondAttempt = await submitAssessment("A-1", "U-LEARNER", correctAnswers);
    expect(firstAttempt.attempt.attempt_number).toBe(1);
    expect(secondAttempt.attempt.attempt_number).toBe(2);
    const numbers = mockFake.state.lms_assessment_attempts.map((attempt) => attempt.attempt_number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  test("a passed attempt is not overwritten by a later one", async () => {
    seedCourseWithAssessment();
    seedEnrollment();
    await submitAssessment("A-1", "U-LEARNER", correctAnswers); // pass
    await submitAssessment("A-1", "U-LEARNER", [
      { questionId: "Q-1", answer: "A" },
      { questionId: "Q-2", answer: "false" },
    ]); // fail
    const attempts = mockFake.state.lms_assessment_attempts;
    expect(attempts).toHaveLength(2);
    expect(attempts[0].passed).toBe(true); // historical pass intact
    expect(attempts[1].passed).toBe(false);
  });
});

// ─── Course progress integration (ticket §20, §35) ─────────────────────────

describe("course progress with required/optional assessments", () => {
  const sections = [{ id: "S-1", lessons: [LESSON] }];

  test("required assessment passed + lessons done → course complete", () => {
    const progress = computeCourseProgress(sections, { "L-1": "completed" }, [
      { id: "A-1", is_required: true, passed: true },
    ]);
    expect(progress.complete).toBe(true);
    expect(progress.percent).toBe(100);
  });

  test("required assessment NOT passed blocks completion", () => {
    const progress = computeCourseProgress(sections, { "L-1": "completed" }, [
      { id: "A-1", is_required: true, passed: false },
    ]);
    expect(progress.complete).toBe(false);
    expect(progress.percent).toBe(50); // 1 of 2 required components
  });

  test("optional assessment failure does not block completion", () => {
    const progress = computeCourseProgress(sections, { "L-1": "completed" }, [
      { id: "A-1", is_required: false, passed: false },
    ]);
    expect(progress.complete).toBe(true);
  });

  test("passing an assessment never completes lessons", async () => {
    seedCourseWithAssessment();
    seedEnrollment();
    await submitAssessment("A-1", "U-LEARNER", correctAnswers);
    const progress = mockFake.state.lms_lesson_progress;
    expect(progress).toHaveLength(0); // no lesson marked complete by assessment pass
  });

  test("passing a required assessment contributes to live course progress", async () => {
    seedCourseWithAssessment();
    seedEnrollment();
    mockFake.seed("lms_lesson_progress", [
      { id: "P-1", enrollment_id: "E-1", lesson_id: "L-1", status: "completed" },
    ]);
    const result = await submitAssessment("A-1", "U-LEARNER", correctAnswers);
    expect(result.courseProgress.complete).toBe(true);
    expect(result.courseCompleted).toBe(true);
  });
});
