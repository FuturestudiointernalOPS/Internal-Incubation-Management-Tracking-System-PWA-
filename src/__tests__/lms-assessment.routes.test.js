/**
 * LMS assessment — the HTTP surface and the authoring aid (Phase 4).
 *
 * Covers:
 *   - take/submit: 401 without a session, 403 for a learner who is not enrolled
 *   - a malformed answer set is a 400 and writes no attempt
 *   - the submitted result is the server-computed one (percent, passed,
 *     attempt_number)
 *   - analyzePassMark: whether the pass mark is reachable with the points the
 *     author has written
 *
 * The scoring, access, attempt and course-progress behaviour is in
 * lms-assessment.test.js. The seeds live in ./helpers/lmsAssessmentFixtures.
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

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuth } = require("@/lib/auth");
const { analyzePassMark, DEFAULT_PASS_MARK } = require("@/models/lms/scoring");
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

const {
  Q_MC,
  Q_TF,
  seedCourseWithAssessment,
  seedEnrollment,
  correctAnswers,
} = require("./helpers/lmsAssessmentFixtures")(mockFake);

// ─── Routes (ticket §41 authentication) ────────────────────────────────────

describe("Assessment API routes", () => {
  test("unauthenticated users get 401 from take and submit", async () => {
    requireAuth.mockResolvedValueOnce({ status: 401 });
    const takeResponse = await takeGET(new Request("http://localhost/x"), { params: { id: "A-1" } });
    expect(takeResponse.status).toBe(401);

    requireAuth.mockResolvedValueOnce({ status: 401 });
    const submitResponse = await submitPOST(jsonReq({ answers: correctAnswers }), { params: { id: "A-1" } });
    expect(submitResponse.status).toBe(401);
  });

  test("take returns 200 for an enrolled learner and 403 otherwise", async () => {
    seedCourseWithAssessment();
    seedEnrollment();
    const allowedResponse = await takeGET(new Request("http://localhost/x"), { params: { id: "A-1" } });
    expect(allowedResponse.status).toBe(200);

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

describe("analyzePassMark — pass-mark feasibility for authoring", () => {
  test("no questions → unreachable, no minimum", () => {
    const analysis = analyzePassMark(70, []);
    expect(analysis.reachable).toBe(false);
    expect(analysis.count).toBe(0);
    expect(analysis.totalPoints).toBe(0);
    expect(analysis.minCorrect).toBeNull();
    expect(analysis.perfectScoreRequired).toBe(false);
  });

  test("null/empty pass mark uses the shared default (70)", () => {
    expect(DEFAULT_PASS_MARK).toBe(70);
    expect(analyzePassMark(null, [Q_MC, Q_TF]).threshold).toBe(DEFAULT_PASS_MARK);
    expect(analyzePassMark("", [Q_MC, Q_TF]).threshold).toBe(DEFAULT_PASS_MARK);
    expect(analyzePassMark(null, [Q_MC, Q_TF]).usesDefault).toBe(true);
    expect(analyzePassMark(80, [Q_MC, Q_TF]).usesDefault).toBe(false);
  });

  test("2 questions at the default 70% pass mark need a perfect score", () => {
    const analysis = analyzePassMark(null, [Q_MC, Q_TF]);
    expect(analysis.minCorrect).toBe(2); // 1/2 → 50%, below 70
    expect(analysis.percentAtMinCorrect).toBe(100);
    expect(analysis.perfectScoreRequired).toBe(true);
    expect(analysis.reachable).toBe(true);
  });

  test("10 questions at 70% need 7 correct — not a perfect score", () => {
    const tenQuestions = Array.from({ length: 10 }, (_, i) => ({ ...Q_MC, id: `Q-${i}` }));
    const analysis = analyzePassMark(70, tenQuestions);
    expect(analysis.minCorrect).toBe(7);
    expect(analysis.percentAtMinCorrect).toBe(70);
    expect(analysis.perfectScoreRequired).toBe(false);
  });

  test("3 questions at 60% pass with 2 correct (rounds to 67%)", () => {
    const threeQuestions = [Q_MC, Q_TF, { ...Q_MC, id: "Q-3" }];
    const analysis = analyzePassMark(60, threeQuestions);
    expect(analysis.minCorrect).toBe(2);
    expect(analysis.percentAtMinCorrect).toBe(67);
    expect(analysis.perfectScoreRequired).toBe(false);
  });

  test("3 questions at 70% again require a perfect score (rounding trap)", () => {
    const threeQuestions = [Q_MC, Q_TF, { ...Q_MC, id: "Q-3" }];
    const analysis = analyzePassMark(70, threeQuestions);
    expect(analysis.minCorrect).toBe(3);
    expect(analysis.percentAtMinCorrect).toBe(100);
    expect(analysis.perfectScoreRequired).toBe(true);
  });

  test("0% pass mark is met from zero correct answers", () => {
    const analysis = analyzePassMark(0, [Q_MC, Q_TF]);
    expect(analysis.reachable).toBe(true);
    expect(analysis.minCorrect).toBe(0);
    expect(analysis.perfectScoreRequired).toBe(false);
  });

  test("sums question points for display (each clamped to at least 1)", () => {
    const mixed = [Q_MC, { ...Q_TF, points: 3 }, { ...Q_MC, id: "Q-3", points: 0 }];
    const analysis = analyzePassMark(70, mixed);
    expect(analysis.count).toBe(3);
    expect(analysis.totalPoints).toBe(5); // 1 + 3 + 1 (0 is clamped up)
  });
});
