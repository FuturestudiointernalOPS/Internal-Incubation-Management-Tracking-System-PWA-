/**
 * LMS certificates tests (Phase 5) against the shared fake LMS DB.
 *
 * Covers the Phase 5 spec:
 *   - completion → certificate issuance (only after real completion)
 *   - idempotent issuance (one certificate per completed enrollment)
 *   - certificate record: number format, snapshots, status
 *   - learner ownership / authorization (no cross-user access)
 *   - PDF download is server-built from the authoritative record
 *   - public verification exposes ONLY public fields (valid + revoked)
 *   - minimal revocation keeps the record and flips the status
 *   - security: issuance requires completion; client cannot fake state
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

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuth } = require("@/lib/auth");
const { requireAuthorization } = require("@/lib/authorization");
const { getSession } = require("@/lib/auth");

const {
  issueCertificate,
  getCertificatesForLearner,
  getLearnerCertificate,
  getCertificatePublic,
  revokeCertificate,
} = require("@/lib/lms/certificates");
const {
  completeLesson,
  submitAssessment,
  getLearnerCourses,
  getLearnerCourse,
} = require("@/lib/lms/learning");
const { buildCertificatePdf } = require("@/lib/lms/certificate-pdf");

const { GET: certificatesGET } = require("@/app/api/lms/certificates/route");
const { GET: certificateGET } = require("@/app/api/lms/certificates/[id]/route");
const { GET: downloadGET } = require("@/app/api/lms/certificates/[id]/download/route");
const { POST: revokePOST } = require("@/app/api/lms/certificates/[id]/revoke/route");
const { GET: verifyGET } = require("@/app/api/verify/certificate/[token]/route");

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
  requireAuthorization.mockResolvedValue(null);
  getSession.mockResolvedValue({ cid: "U-LEARNER", name: "Jane Learner", role: "participant" });
});

// ─── Fixtures ──────────────────────────────────────────────────────────────
const PUBLISHED = {
  id: "C-1",
  title: "Customer Discovery",
  description: "Learn customer discovery.",
  status: "published",
  is_free: true,
  visibility: "public",
  updated_at: "2026-08-27T00:00:00Z",
};
const SECTION_1 = { id: "S-1", course_id: "C-1", title: "Introduction", position: 0 };
const LESSON_1 = {
  id: "L-1",
  section_id: "S-1",
  title: "Lesson 1",
  content_type: "video",
  youtube_video_id: "aaaaaaaaaaa",
  is_required: true,
  position: 0,
};
const LESSON_2 = {
  id: "L-2",
  section_id: "S-1",
  title: "Lesson 2",
  content_type: "video",
  youtube_video_id: "bbbbbbbbbbb",
  is_required: true,
  position: 1,
};
const LESSON_OPT = {
  id: "L-3",
  section_id: "S-1",
  title: "Optional extra",
  content_type: "video",
  youtube_video_id: "ccccccccccc",
  is_required: false,
  position: 2,
};

function seedCourse({ lessons = [LESSON_1, LESSON_2], assessments = [] } = {}) {
  mockFake.seed("lms_courses", [PUBLISHED]);
  mockFake.seed("lms_course_sections", [SECTION_1]);
  mockFake.seed("lms_lessons", lessons);
  mockFake.seed("lms_assessments", assessments);
}

function seedEnrollment({ status = "active", id = "E-1", userCid = "U-LEARNER" } = {}) {
  mockFake.seed("lms_enrollments", [
    { id, course_id: "C-1", user_cid: userCid, source: "admin", status, completed_at: null },
  ]);
}

function seedContact(userCid = "U-LEARNER", name = "Jane Learner") {
  mockFake.seed("contacts", [{ cid: userCid, name, email: "jane@future.studio" }]);
}

function seedCertificate({
  id = "CRT-1",
  number = "CERT-2026-000001",
  token = "abc123def456abc123def456",
  enrollmentId = "E-1",
  courseId = "C-1",
  userCid = "U-LEARNER",
  learnerName = "Jane Learner",
  courseTitle = "Customer Discovery",
  issuedAt = "2026-08-31T14:35:00Z",
  status = "valid",
} = {}) {
  mockFake.seed("lms_certificates", [
    {
      id,
      certificate_number: number,
      verification_token: token,
      enrollment_id: enrollmentId,
      course_id: courseId,
      user_cid: userCid,
      learner_name: learnerName,
      course_title: courseTitle,
      issued_at: issuedAt,
      status,
      revoked_at: null,
      created_at: "2026-08-31T14:35:00Z",
      updated_at: "2026-08-31T14:35:00Z",
    },
  ]);
}

const certRows = () => mockFake.state.lms_certificates;

// ─── Certificate service ───────────────────────────────────────────────────

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
    const a = await issueCertificate({
      enrollment: { id: "E-1", user_cid: "U-LEARNER", status: "completed" },
      course: PUBLISHED,
      learnerName: "Jane Learner",
    });
    const b = await issueCertificate({
      enrollment: { id: "E-2", user_cid: "U-OTHER", status: "completed" },
      course: PUBLISHED,
      learnerName: "Other Learner",
    });
    expect(a.certificate.certificate_number).not.toBe(b.certificate.certificate_number);
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

// ─── Ownership / authorization ─────────────────────────────────────────────

describe("certificate ownership (spec §27, §41)", () => {
  test("owner reads their certificate; another learner is denied (403)", async () => {
    seedCertificate();
    const mine = await getLearnerCertificate("CRT-1", "U-LEARNER");
    expect(mine.certificate_number).toBe("CERT-2026-000001");
    await expect(getLearnerCertificate("CRT-1", "U-EVIL")).rejects.toMatchObject({
      status: 403,
      message: "lms.errors.noCertificateAccess",
    });
  });

  test("route: a learner can never fetch another learner's certificate", async () => {
    seedCertificate();
    getSession.mockResolvedValue({ cid: "U-EVIL", name: "Evil", role: "participant" });
    const res = await certificateGET(new Request("http://localhost/x"), {
      params: { id: "CRT-1" },
    });
    expect(res.status).toBe(403);
  });

  test("route: unauthenticated users get 401", async () => {
    requireAuth.mockResolvedValueOnce({ status: 401 });
    const res = await certificatesGET();
    expect(res.status).toBe(401);
  });

  test("route: owner lists their own certificates", async () => {
    seedCertificate();
    const res = await certificatesGET();
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.certificates).toHaveLength(1);
    expect(data.certificates[0].certificate_number).toBe("CERT-2026-000001");
  });

  test("missing certificate → 404", async () => {
    const res = await certificateGET(new Request("http://localhost/x"), {
      params: { id: "NOPE" },
    });
    expect(res.status).toBe(404);
  });
});

// ─── PDF download (server-controlled content) ──────────────────────────────

describe("certificate PDF download (spec §16-17)", () => {
  test("buildCertificatePdf produces PDF bytes from the authoritative record", () => {
    const bytes = buildCertificatePdf({
      certificate_number: "CERT-2026-000001",
      learner_name: "Jane Learner",
      course_title: "Customer Discovery",
      issued_at: "2026-08-31T14:35:00Z",
      status: "valid",
    });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);
    const header = new TextDecoder().decode(bytes.slice(0, 4));
    expect(header).toBe("%PDF");
  });

  test("owner downloads a PDF; headers + body are a real PDF", async () => {
    seedCertificate();
    const res = await downloadGET(new Request("http://localhost/x"), {
      params: { id: "CRT-1" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("CERT-2026-000001.pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("non-owner cannot download another learner's certificate", async () => {
    seedCertificate();
    getSession.mockResolvedValue({ cid: "U-EVIL", name: "Evil", role: "participant" });
    const res = await downloadGET(new Request("http://localhost/x"), {
      params: { id: "CRT-1" },
    });
    expect(res.status).toBe(403);
  });

  test("a revoked certificate cannot be downloaded", async () => {
    seedCertificate({ status: "revoked", revoked_at: "2026-09-01T10:00:00Z" });
    const res = await downloadGET(new Request("http://localhost/x"), {
      params: { id: "CRT-1" },
    });
    expect(res.status).toBe(409);
  });
});

// ─── Public verification ───────────────────────────────────────────────────

describe("public verification (spec §19-20, §28)", () => {
  test("valid certificate verifies with ONLY public fields", async () => {
    seedCertificate();
    const res = await verifyGET(new Request("http://localhost/x"), {
      params: { token: "abc123def456abc123def456" },
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    const data = JSON.parse(body);
    expect(data.certificate.certificate_number).toBe("CERT-2026-000001");
    expect(data.certificate.learner_name).toBe("Jane Learner");
    expect(data.certificate.course_title).toBe("Customer Discovery");
    expect(data.certificate.status).toBe("valid");
    // Private data is NEVER exposed:
    for (const forbidden of ["user_cid", "enrollment_id", "course_id", "verification_token", "CRT-1", "jane@future.studio"]) {
      expect(body).not.toContain(forbidden);
    }
    expect(data.certificate.id).toBeUndefined();
    expect(data.certificate.revoked_at).toBeUndefined();
  });

  test("certificate number also verifies (convenience lookup)", async () => {
    seedCertificate();
    const res = await verifyGET(new Request("http://localhost/x"), {
      params: { token: "CERT-2026-000001" },
    });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.certificate.status).toBe("valid");
  });

  test("unknown token → 404, never leaks existence of other data", async () => {
    seedCertificate();
    const res = await verifyGET(new Request("http://localhost/x"), {
      params: { token: "zzz-unknown" },
    });
    expect(res.status).toBe(404);
  });

  test("revoked certificate still verifies as revoked (record is never deleted)", async () => {
    seedCertificate({ status: "revoked", revoked_at: "2026-09-01T10:00:00Z" });
    const res = await verifyGET(new Request("http://localhost/x"), {
      params: { token: "abc123def456abc123def456" },
    });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.certificate.status).toBe("revoked");
    expect(certRows()).toHaveLength(1);
  });
});

// ─── Revocation (minimal V1) ───────────────────────────────────────────────

describe("revocation (spec §21-22, §40)", () => {
  test("revoking flips the status and keeps the record", async () => {
    seedCertificate();
    const result = await revokeCertificate("CRT-1");
    expect(result.certificate.status).toBe("revoked");
    expect(certRows()).toHaveLength(1);
    expect(certRows()[0].status).toBe("revoked");
  });

  test("revoking an already-revoked certificate is idempotent", async () => {
    seedCertificate({ status: "revoked" });
    const result = await revokeCertificate("CRT-1");
    expect(result.certificate.status).toBe("revoked");
    expect(certRows()).toHaveLength(1);
  });

  test("revoke route requires the lms.edit capability", async () => {
    seedCertificate();
    requireAuthorization.mockResolvedValueOnce({ status: 403 });
    const res = await revokePOST(jsonReq({}), { params: { id: "CRT-1" } });
    expect(res.status).toBe(403);
    expect(certRows()[0].status).toBe("valid"); // untouched
  });

  test("authorized admin can revoke", async () => {
    seedCertificate();
    const res = await revokePOST(jsonReq({}), { params: { id: "CRT-1" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.certificate.status).toBe("revoked");
  });
});

// ─── Security (spec §41) ───────────────────────────────────────────────────

describe("security hardening", () => {
  test("client can never supply a certificate via fake completion data", async () => {
    seedCourse();
    seedEnrollment();
    seedContact();
    // The lesson-complete route only accepts a lesson id; the body is ignored
    // and completion state is derived server-side from progress rows.
    const { POST: completePOST } = require("@/app/api/lms/lessons/[id]/complete/route");
    const res = await completePOST(
      jsonReq({ status: "completed", completed: true, certificate: { id: "FAKE" } }),
      { params: { id: "L-1" } },
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.certificate).toBeNull(); // only ONE lesson of two done
    expect(certRows()).toHaveLength(0);
  });

  test("a lesson that does not exist cannot be completed (404)", async () => {
    seedCourse();
    seedEnrollment();
    await expect(completeLesson("L-999", "U-LEARNER")).rejects.toMatchObject({ status: 404 });
  });
});

// ─── Migration schema guard (mirrors lms-foundation.test.js) ───────────────

describe("LMS certificates migration (schema drift guard)", () => {
  const fs = require("fs");
  const path = require("path");
  const MIGRATION = fs.readFileSync(
    path.join(__dirname, "../../supabase/migrations/20260901_lms_certificates.sql"),
    "utf8",
  );

  test("creates lms_certificates with the required constraints", () => {
    const block = MIGRATION.match(
      /CREATE TABLE IF NOT EXISTS lms_certificates \(([\s\S]*?)\);/,
    )[1];
    expect(block).toMatch(/certificate_number TEXT NOT NULL UNIQUE/);
    expect(block).toMatch(/verification_token TEXT NOT NULL UNIQUE/);
    expect(block).toMatch(
      /enrollment_id UUID NOT NULL UNIQUE REFERENCES lms_enrollments\(id\) ON DELETE CASCADE/,
    );
    expect(block).toMatch(/user_cid TEXT NOT NULL REFERENCES contacts\(cid\) ON DELETE CASCADE/);
    expect(block).toMatch(/learner_name TEXT NOT NULL/);
    expect(block).toMatch(/course_title TEXT NOT NULL/);
    expect(block).toMatch(/CHECK \(status IN \('valid', 'revoked'\)\)/);
  });

  test("migration is additive — no ALTER/DROP on existing tables", () => {
    expect(MIGRATION).not.toMatch(/\bALTER TABLE\b/);
    expect(MIGRATION).not.toMatch(/\bDROP TABLE\b/);
  });

  test("domain constant matches the CHECK values", () => {
    const { LMS_CERTIFICATE_STATUSES } = require("@/lib/lms");
    for (const v of LMS_CERTIFICATE_STATUSES) expect(MIGRATION).toContain(`'${v}'`);
  });
});
