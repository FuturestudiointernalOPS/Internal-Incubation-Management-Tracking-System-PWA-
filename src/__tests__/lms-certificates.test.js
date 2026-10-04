/**
 * LMS certificates — issuance (Phase 5), against the shared fake LMS DB.
 *
 * Covers the Phase 5 spec:
 *   - completion → certificate issuance (only after real completion)
 *   - idempotent issuance (one certificate per completed enrollment)
 *   - certificate record: number format, snapshots, status
 *   - lazy issuance (pre-Phase 5 completions)
 *
 * The routes — ownership, PDF download, public verification, revocation,
 * security hardening and the schema drift guard — are in
 * lms-certificates.routes.test.js. The seeds live in
 * ./helpers/lmsCertificateFixtures.
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");
const mockFake = createFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => ({ cid: "U-LEARNER", name: "Jane Learner", role: "participant" })),
  requireAuth: jest.fn(async () => null),
}));

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuth } = require("@/lib/auth");
const { requireAuthorization } = require("@/models/authorization/index");
const { getSession } = require("@/lib/auth");
const { issueCertificate } = require("@/models/lms/certificates");
const {
  completeLesson,
  submitAssessment,
  getLearnerCourses,
} = require("@/services/lms/learning");

beforeEach(() => {
  mockFake.reset();
  requireAuth.mockResolvedValue(null);
  requireAuthorization.mockResolvedValue(null);
  getSession.mockResolvedValue({ cid: "U-LEARNER", name: "Jane Learner", role: "participant" });
});

const {
  PUBLISHED,
  LESSON_1,
  LESSON_2,
  LESSON_OPT,
  seedCourse,
  seedEnrollment,
  seedContact,
  certRows,
} = require("./helpers/lmsCertificateFixtures")(mockFake);


describe("issueCertificate (server-side, idempotent)", () => {
  test("rejects issuance before completion — client can never force a certificate", async () => {
    seedCourse();
    seedEnrollment({ status: "active" });
    await expect(
      issueCertificate({
        enrollment: { id: "E-1", user_cid: "U-LEARNER", status: "active" },
        course: PUBLISHED,
        learnerName: "Jane Learner",
      }),
    ).rejects.toMatchObject({ status: 409, message: "lms.errors.notCompleted" });
    expect(certRows()).toHaveLength(0);
  });

  test("issues a certificate with a CERT-<YYYY>-<NNNNNN> number + snapshots", async () => {
    seedCourse();
    seedEnrollment({ status: "completed" });
    seedContact();
    const { certificate, created } = await issueCertificate({
      enrollment: { id: "E-1", user_cid: "U-LEARNER", status: "completed" },
      course: PUBLISHED,
      learnerName: "Jane Learner",
    });
    expect(created).toBe(true);
    expect(certificate.certificate_number).toMatch(/^CERT-\d{4}-\d{6}$/);
    expect(certificate.learner_name).toBe("Jane Learner");
    expect(certificate.course_title).toBe("Customer Discovery");
    expect(certificate.status).toBe("valid");
    expect(certificate.verification_token).toHaveLength(24);
    expect(certRows()).toHaveLength(1);
  });

  test("is idempotent — a retry returns the existing certificate, no duplicate row", async () => {
    seedCourse();
    seedEnrollment({ status: "completed" });
    seedContact();
    const enrollment = { id: "E-1", user_cid: "U-LEARNER", status: "completed" };
    const first = await issueCertificate({ enrollment, course: PUBLISHED, learnerName: "Jane Learner" });
    const second = await issueCertificate({ enrollment, course: PUBLISHED, learnerName: "Jane Learner" });
    expect(second.created).toBe(false);
    expect(second.certificate.id).toBe(first.certificate.id);
    expect(certRows()).toHaveLength(1);
  });

  test("produces unique numbers across enrollments", async () => {
    seedCourse();
    seedEnrollment({ status: "completed", id: "E-1" });
    mockFake.seed("lms_enrollments", [
      { id: "E-2", course_id: "C-1", user_cid: "U-OTHER", source: "admin", status: "completed" },
    ]);
    seedContact();
    const firstCertificate = await issueCertificate({
      enrollment: { id: "E-1", user_cid: "U-LEARNER", status: "completed" },
      course: PUBLISHED,
      learnerName: "Jane Learner",
    });
    const secondCertificate = await issueCertificate({
      enrollment: { id: "E-2", user_cid: "U-OTHER", status: "completed" },
      course: PUBLISHED,
      learnerName: "Other Learner",
    });
    expect(firstCertificate.certificate.certificate_number).not.toBe(secondCertificate.certificate.certificate_number);
  });
});

// ─── Completion → issuance (through the authoritative engine) ──────────────

describe("completion → certificate (spec §38)", () => {
  test("all required lessons complete → enrollment completed + certificate issued", async () => {
    seedCourse();
    seedEnrollment();
    seedContact();
    const first = await completeLesson("L-1", "U-LEARNER");
    expect(first.courseCompleted).toBe(false);
    expect(first.certificate).toBeNull();
    expect(certRows()).toHaveLength(0);

    const second = await completeLesson("L-2", "U-LEARNER");
    expect(second.courseCompleted).toBe(true);
    expect(second.certificate).not.toBeNull();
    expect(second.certificate.certificate_number).toMatch(/^CERT-\d{4}-\d{6}$/);
    expect(mockFake.state.lms_enrollments[0].status).toBe("completed");
    expect(certRows()).toHaveLength(1);
  });

  test("optional lessons never block completion or certificate", async () => {
    seedCourse({ lessons: [LESSON_1, LESSON_2, LESSON_OPT] });
    seedEnrollment();
    seedContact();
    await completeLesson("L-1", "U-LEARNER");
    const result = await completeLesson("L-2", "U-LEARNER");
    expect(result.courseCompleted).toBe(true);
    expect(result.certificate).not.toBeNull();
  });

  test("lessons complete + required assessment NOT passed → not completed, no certificate", async () => {
    seedCourse({
      assessments: [{ id: "A-1", course_id: "C-1", section_id: null, title: "Final", is_required: true, position: 0 }],
    });
    mockFake.seed("lms_assessment_questions", [
      {
        id: "Q-1",
        assessment_id: "A-1",
        question: "Is customer discovery important?",
        question_type: "true_false",
        options: [],
        correct_answer: ["true"],
        points: 1,
        position: 0,
      },
    ]);
    seedEnrollment();
    seedContact();
    mockFake.seed("lms_lesson_progress", [
      { id: "P-1", enrollment_id: "E-1", lesson_id: "L-1", status: "completed" },
      { id: "P-2", enrollment_id: "E-1", lesson_id: "L-2", status: "completed" },
    ]);
    // A valid but FAILED attempt does not satisfy the required assessment.
    const result = await submitAssessment("A-1", "U-LEARNER", [
      { questionId: "Q-1", answer: "false" },
    ]);
    expect(result.attempt.passed).toBe(false);
    expect(result.courseCompleted).toBe(false);
    expect(result.certificate).toBeNull();
    expect(certRows()).toHaveLength(0);
  });

  test("required assessment passed completes the course and issues the certificate", async () => {
    seedCourse({
      assessments: [{ id: "A-1", course_id: "C-1", section_id: null, title: "Final", is_required: true, position: 0 }],
    });
    mockFake.seed("lms_assessment_questions", [
      {
        id: "Q-1",
        assessment_id: "A-1",
        question: "Is customer discovery important?",
        question_type: "true_false",
        options: [],
        correct_answer: ["true"],
        points: 1,
        position: 0,
      },
    ]);
    seedEnrollment();
    seedContact();
    mockFake.seed("lms_lesson_progress", [
      { id: "P-1", enrollment_id: "E-1", lesson_id: "L-1", status: "completed" },
      { id: "P-2", enrollment_id: "E-1", lesson_id: "L-2", status: "completed" },
    ]);
    const result = await submitAssessment("A-1", "U-LEARNER", [
      { questionId: "Q-1", answer: "true" },
    ]);
    expect(result.courseCompleted).toBe(true);
    expect(result.certificate).not.toBeNull();
    expect(result.certificate.course_title).toBe("Customer Discovery");
    expect(certRows()).toHaveLength(1);
  });

  test("optional assessment failure never blocks completion", async () => {
    seedCourse({
      assessments: [{ id: "A-1", course_id: "C-1", section_id: null, title: "Bonus", is_required: false, position: 0 }],
    });
    seedEnrollment();
    seedContact();
    const result = await completeLesson("L-1", "U-LEARNER");
    expect(result.courseCompleted).toBe(false);
    const second = await completeLesson("L-2", "U-LEARNER");
    expect(second.courseCompleted).toBe(true);
    expect(second.certificate).not.toBeNull();
  });

  test("a retake after completion keeps the same certificate (spec §25)", async () => {
    seedCourse();
    seedEnrollment();
    seedContact();
    await completeLesson("L-1", "U-LEARNER");
    const done = await completeLesson("L-2", "U-LEARNER");
    expect(done.certificate).not.toBeNull();

    // Retake an already-passed assessment path: completing the same lessons
    // again must not duplicate or invalidate the certificate.
    const again = await completeLesson("L-1", "U-LEARNER");
    expect(again.certificate.id).toBe(done.certificate.id);
    expect(certRows()).toHaveLength(1);
    expect(mockFake.state.lms_enrollments[0].status).toBe("completed");
  });
});

// ─── Lazy issuance for pre-existing completions ────────────────────────────

describe("lazy issuance (pre-Phase 5 completions)", () => {
  test("an already-completed enrollment receives its certificate on first read", async () => {
    seedCourse();
    seedEnrollment({ status: "completed" });
    seedContact();
    mockFake.seed("lms_lesson_progress", [
      { id: "P-1", enrollment_id: "E-1", lesson_id: "L-1", status: "completed" },
      { id: "P-2", enrollment_id: "E-1", lesson_id: "L-2", status: "completed" },
    ]);
    const courses = await getLearnerCourses("U-LEARNER");
    expect(courses).toHaveLength(1);
    expect(courses[0].certificate).not.toBeNull();
    expect(certRows()).toHaveLength(1);
  });

  test("active enrollments never get a certificate", async () => {
    seedCourse();
    seedEnrollment({ status: "active" });
    const courses = await getLearnerCourses("U-LEARNER");
    expect(courses[0].certificate).toBeNull();
    expect(certRows()).toHaveLength(0);
  });
});
