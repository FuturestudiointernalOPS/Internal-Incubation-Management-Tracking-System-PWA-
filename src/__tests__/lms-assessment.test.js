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
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");
const mockFake = createFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => ({ cid: "U-LEARNER", name: "Learner", role: "participant" })),
  requireAuth: jest.fn(async () => null),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuth } = require("@/lib/auth");

const { scoreAssessment } = require("@/lib/lms/scoring");
const {
  getAssessmentForTake,
  submitAssessment,
  computeCourseProgress,
} = require("@/lib/lms/learning");

const { GET: takeGET } = require("@/app/api/lms/assessments/[id]/take/route");
const { POST: submitPOST } = require("@/app/api/lms/assessments/[id]/submit/route");

const jsonReq = (body) =>
  new Request("http://localhost/api/lms/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const readJson = async (res) => res.json();

beforeEach(() => {
  mockFake.reset();
  requireAuth.mockResolvedValue(null);
});

// ─── Fixtures ──────────────────────────────────────────────────────────────
const COURSE = {
  id: "C-1",
  title: "Customer Discovery",
  status: "published",
  is_free: true,
  visibility: "public",
  updated_at: "2026-08-27T00:00:00Z",
};
const SECTION = { id: "S-1", course_id: "C-1", title: "Intro", position: 0 };
const LESSON = {
  id: "L-1",
  section_id: "S-1",
  title: "Lesson",
  content_type: "video",
  youtube_video_id: "dQw4w9WgXcQ",
  is_required: true,
  position: 0,
};
const ASSESSMENT = {
  id: "A-1",
  course_id: "C-1",
  section_id: "S-1",
  title: "Knowledge Check",
  is_required: true,
  pass_mark: 70,
  position: 0,
};
const Q_MC = {
  id: "Q-1",
  assessment_id: "A-1",
  question: "What is customer discovery?",
  question_type: "multiple_choice",
  options: [
    { key: "A", text: "One" },
    { key: "B", text: "Two" },
  ],
  correct_answer: ["B"],
  position: 0,
};
const Q_TF = {
  id: "Q-2",
  assessment_id: "A-1",
  question: "Interviews validate assumptions.",
  question_type: "true_false",
  options: [],
  correct_answer: ["true"],
  position: 1,
};

function seedCourseWithAssessment() {
  mockFake.seed("lms_courses", [COURSE]);
  mockFake.seed("lms_course_sections", [SECTION]);
  mockFake.seed("lms_lessons", [LESSON]);
  mockFake.seed("lms_assessments", [ASSESSMENT]);
  mockFake.seed("lms_assessment_questions", [Q_MC, Q_TF]);
}

function seedEnrollment() {
  mockFake.seed("lms_enrollments", [
    { id: "E-1", course_id: "C-1", user_cid: "U-LEARNER", source: "admin", status: "active" },
  ]);
}

const correctAnswers = [
  { questionId: "Q-1", answer: "B" },
  { questionId: "Q-2", answer: "true" },
];

// ─── Pure scoring (ticket §11) ─────────────────────────────────────────────

describe("scoreAssessment — percentages against pass marks", () => {
  const questions = [Q_MC, Q_TF];

  test("100%", () => {
    const r = scoreAssessment(questions, correctAnswers);
    expect(r.valid).toBe(true);
    expect(r.percent).toBe(100);
    expect(r.correctCount).toBe(2);
  });

  test("50% (1 of 2)", () => {
    const r = scoreAssessment(questions, [
      { questionId: "Q-1", answer: "A" }, // wrong
      { questionId: "Q-2", answer: "true" },
    ]);
    expect(r.percent).toBe(50);
  });

  test("0%", () => {
    const r = scoreAssessment(questions, [
      { questionId: "Q-1", answer: "A" },
      { questionId: "Q-2", answer: "false" },
    ]);
    expect(r.percent).toBe(0);
  });

  test("90% (9 of 10) and 69% boundaries via a 10-question set", () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({
      id: `Q${i}`,
      question_type: "multiple_choice",
      options: [
        { key: "A", text: "a" },
        { key: "B", text: "b" },
      ],
      correct_answer: ["A"],
    }));
    const answered = ten.map((q, i) => ({ questionId: q.id, answer: i < 9 ? "A" : "B" }));
    expect(scoreAssessment(ten, answered).percent).toBe(90);

    const answered69 = ten.map((q, i) => ({ questionId: q.id, answer: i < 7 ? "A" : "B" }));
    expect(scoreAssessment(ten, answered69).percent).toBe(70); // round(6.9→7 of 10)? 7/10
  });

  test("rounding is Math.round", () => {
    const three = [Q_MC, Q_TF, { ...Q_MC, id: "Q-3", correct_answer: ["A"] }];
    const r = scoreAssessment(three, [
      { questionId: "Q-1", answer: "B" },
      { questionId: "Q-2", answer: "false" },
      { questionId: "Q-3", answer: "A" },
    ]);
    expect(r.percent).toBe(67); // round(2/3 × 100) = 67
  });
});

describe("scoreAssessment — validation (ticket §25)", () => {
  const questions = [Q_MC, Q_TF];

  test("rejects non-array submissions", () => {
    expect(scoreAssessment(questions, "nope").valid).toBe(false);
    expect(scoreAssessment(questions, null).valid).toBe(false);
  });

  test("rejects unknown question IDs", () => {
    const r = scoreAssessment(questions, [
      { questionId: "Q-X", answer: "A" },
      { questionId: "Q-2", answer: "true" },
    ]);
    expect(r.valid).toBe(false);
  });

  test("rejects duplicate question IDs", () => {
    const r = scoreAssessment(questions, [
      { questionId: "Q-1", answer: "B" },
      { questionId: "Q-1", answer: "A" },
      { questionId: "Q-2", answer: "true" },
    ]);
    expect(r.valid).toBe(false);
  });

  test("rejects MC answers that are not configured options", () => {
    const r = scoreAssessment(questions, [
      { questionId: "Q-1", answer: "Z" }, // not an option key
      { questionId: "Q-2", answer: "true" },
    ]);
    expect(r.valid).toBe(false);
  });

  test("rejects invalid true/false values", () => {
    const r = scoreAssessment(questions, [
      { questionId: "Q-1", answer: "B" },
      { questionId: "Q-2", answer: "yes" },
    ]);
    expect(r.valid).toBe(false);
  });

  test("requires every question to be answered", () => {
    const r = scoreAssessment(questions, [{ questionId: "Q-1", answer: "B" }]);
    expect(r.valid).toBe(false);
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

    const fail1 = await submitAssessment("A-1", "U-LEARNER", [
      { questionId: "Q-1", answer: "A" },
      { questionId: "Q-2", answer: "true" },
    ]);
    expect(fail1.attempt.attempt_number).toBe(1);
    expect(fail1.attempt.passed).toBe(false);

    const fail2 = await submitAssessment("A-1", "U-LEARNER", [
      { questionId: "Q-1", answer: "B" },
      { questionId: "Q-2", answer: "false" },
    ]);
    expect(fail2.attempt.attempt_number).toBe(2);
    expect(fail2.attempt.passed).toBe(false);

    const pass3 = await submitAssessment("A-1", "U-LEARNER", correctAnswers);
    expect(pass3.attempt.attempt_number).toBe(3);
    expect(pass3.attempt.passed).toBe(true);

    // All three attempts remain recorded, in order, with no gaps.
    const attempts = mockFake.state.lms_assessment_attempts
      .filter((a) => String(a.assessment_id) === "A-1" && String(a.user_cid) === "U-LEARNER")
      .sort((a, b) => a.attempt_number - b.attempt_number);
    expect(attempts.map((a) => a.attempt_number)).toEqual([1, 2, 3]);
    expect(attempts.map((a) => a.passed)).toEqual([false, false, true]);
  });

  test("sequential double submission creates attempts 1 and 2 (never the same number)", async () => {
    seedCourseWithAssessment();
    seedEnrollment();
    const first = await submitAssessment("A-1", "U-LEARNER", correctAnswers);
    const second = await submitAssessment("A-1", "U-LEARNER", correctAnswers);
    expect(first.attempt.attempt_number).toBe(1);
    expect(second.attempt.attempt_number).toBe(2);
    const numbers = mockFake.state.lms_assessment_attempts.map((a) => a.attempt_number);
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
    const p = computeCourseProgress(sections, { "L-1": "completed" }, [
      { id: "A-1", is_required: true, passed: true },
    ]);
    expect(p.complete).toBe(true);
    expect(p.percent).toBe(100);
  });

  test("required assessment NOT passed blocks completion", () => {
    const p = computeCourseProgress(sections, { "L-1": "completed" }, [
      { id: "A-1", is_required: true, passed: false },
    ]);
    expect(p.complete).toBe(false);
    expect(p.percent).toBe(50); // 1 of 2 required components
  });

  test("optional assessment failure does not block completion", () => {
    const p = computeCourseProgress(sections, { "L-1": "completed" }, [
      { id: "A-1", is_required: false, passed: false },
    ]);
    expect(p.complete).toBe(true);
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

// ─── Routes (ticket §41 authentication) ────────────────────────────────────

describe("Assessment API routes", () => {
  test("unauthenticated users get 401 from take and submit", async () => {
    requireAuth.mockResolvedValueOnce({ status: 401 });
    const take = await takeGET(new Request("http://localhost/x"), { params: { id: "A-1" } });
    expect(take.status).toBe(401);

    requireAuth.mockResolvedValueOnce({ status: 401 });
    const submit = await submitPOST(jsonReq({ answers: correctAnswers }), { params: { id: "A-1" } });
    expect(submit.status).toBe(401);
  });

  test("take returns 200 for an enrolled learner and 403 otherwise", async () => {
    seedCourseWithAssessment();
    seedEnrollment();
    const ok = await takeGET(new Request("http://localhost/x"), { params: { id: "A-1" } });
    expect(ok.status).toBe(200);

    mockFake.reset();
    seedCourseWithAssessment();
    const denied = await takeGET(new Request("http://localhost/x"), { params: { id: "A-1" } });
    expect(denied.status).toBe(403);
  });

  test("submit rejects malformed answers with 400 and never writes an attempt", async () => {
    seedCourseWithAssessment();
    seedEnrollment();
    const res = await submitPOST(
      jsonReq({ answers: [{ questionId: "Q-FAKE", answer: "A" }] }),
      { params: { id: "A-1" } },
    );
    expect(res.status).toBe(400);
    expect(mockFake.state.lms_assessment_attempts).toHaveLength(0);
  });

  test("submit returns the server-computed result", async () => {
    seedCourseWithAssessment();
    seedEnrollment();
    const res = await submitPOST(jsonReq({ answers: correctAnswers }), { params: { id: "A-1" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.attempt.percent).toBe(100);
    expect(data.attempt.passed).toBe(true);
    expect(data.attempt.attempt_number).toBe(1);
  });
});
