/**
 * LMS certificates — the HTTP surface (Phase 5), against the shared fake LMS DB.
 *
 * Covers the Phase 5 spec:
 *   - learner ownership / authorization (no cross-user access)
 *   - PDF download is server-built from the authoritative record
 *   - public verification exposes ONLY public fields (valid + revoked)
 *   - minimal revocation keeps the record and flips the status
 *   - security: issuance requires completion; client cannot fake state
 *   - the certificates migration is still in sync with the model
 *
 * The service side — issuance, idempotency and lazy issuance — is in
 * lms-certificates.test.js. The seeds live in
 * ./helpers/lmsCertificateFixtures.
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");
const mockFake = createFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => ({ cid: "U-LEARNER", name: "Jane Learner", role: "participant" })),
}));
jest.mock("@/server/auth/guards", () => ({
  requireAuth: jest.fn(async () => null),
}));

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuth } = require("@/server/auth/guards");
const { requireAuthorization } = require("@/models/authorization/index");
const { getSession } = require("@/server/auth/session");
const {
  getLearnerCertificate,
  revokeCertificate,
} = require("@/models/lms/certificates");
const { completeLesson } = require("@/services/lms/learning");
const { buildCertificatePdf } = require("@/models/lms/certificate-pdf");

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

const {
  seedCourse,
  seedEnrollment,
  seedContact,
  seedCertificate,
  certRows,
} = require("./helpers/lmsCertificateFixtures")(mockFake);


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

  test("the sequential certificate number is refused (not enumerable)", async () => {
    seedCertificate();
    const res = await verifyGET(new Request("http://localhost/x"), {
      params: { token: "CERT-2026-000001" },
    });
    // The number is sequential, so accepting it made the public URL enumerable.
    expect(res.status).toBe(404);
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
    const { LMS_CERTIFICATE_STATUSES } = require("@/models/lms");
    for (const status of LMS_CERTIFICATE_STATUSES) expect(MIGRATION).toContain(`'${status}'`);
  });
});
