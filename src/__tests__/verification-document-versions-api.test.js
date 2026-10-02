/**
 * /api/ventures/[id]/verification/documents/[docId]/versions — route contract.
 *
 *   GET  — a version is readable only by someone who may already read the
 *          Venture's Data bank; each version carries a short-lived signed URL
 *          because the files live in a PRIVATE bucket. A document id that is
 *          not part of the Venture is a 404, never another Venture's history.
 *   POST — filing a new version keeps the SAME gate as the first upload (a
 *          founder, or a Super Admin). A refusal never reaches the write.
 */

const mockDb = { execute: jest.fn(async () => ({ rows: [] })) };

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  __esModule: true,
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn(),
}));

jest.mock("@/lib/ventureAuth", () => ({
  __esModule: true,
  hasActiveVentureAssignment: jest.fn(),
}));

jest.mock("@/lib/ventureEvidence", () => ({
  __esModule: true,
  signEvidencePath: jest.fn(),
}));

jest.mock("@/services/ventures/verification", () => ({
  listVerificationDocumentVersions: jest.fn(),
  addVerificationDocumentVersion: jest.fn(),
  canSubmitVerification: jest.fn(),
}));

const { getSession } = require("@/lib/auth");
const { hasActiveVentureAssignment } = require("@/lib/ventureAuth");
const { signEvidencePath } = require("@/lib/ventureEvidence");
const { listVerificationDocumentVersions, addVerificationDocumentVersion, canSubmitVerification } = require("@/services/ventures/verification");
const { GET, POST } = require("@/app/api/ventures/[id]/verification/documents/[docId]/versions/route");

const VENTURE_ID = "VNT-1";
const DOC_ID = 11;
const ctx = { params: { id: VENTURE_ID, docId: String(DOC_ID) } };
const url = `http://localhost/api/ventures/${VENTURE_ID}/verification/documents/${DOC_ID}/versions`;

const readJson = async (res) => res.json();

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.execute.mockResolvedValue({ rows: [] });
  hasActiveVentureAssignment.mockResolvedValue(false);
});

describe("GET versions", () => {
  test("401 without a session", async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(new Request(url), ctx);
    expect(res.status).toBe(401);
    expect(listVerificationDocumentVersions).not.toHaveBeenCalled();
  });

  test("404 when the viewer may not read the Venture's Data bank", async () => {
    getSession.mockResolvedValue({ cid: "X-1", role: "participant" });
    hasActiveVentureAssignment.mockResolvedValue(false);
    const res = await GET(new Request(url), ctx);
    expect(res.status).toBe(404);
    expect((await readJson(res)).error).toBe("errors.notFound");
    expect(listVerificationDocumentVersions).not.toHaveBeenCalled();
  });

  test("404 when the document is not part of the Venture", async () => {
    getSession.mockResolvedValue({ cid: "SA-1", role: "super_admin" });
    listVerificationDocumentVersions.mockResolvedValue(null);
    const res = await GET(new Request(url), ctx);
    expect(res.status).toBe(404);
  });

  test("returns versions, oldest first, each with a signed URL", async () => {
    getSession.mockResolvedValue({ cid: "SA-1", role: "super_admin" });
    listVerificationDocumentVersions.mockResolvedValue({
      document: { id: DOC_ID },
      versions: [
        { id: 1, document_id: DOC_ID, version_number: 1, file_url: "deliverables/v1.pdf" },
        { id: 2, document_id: DOC_ID, version_number: 2, file_url: "deliverables/v2.pdf" },
      ],
    });
    signEvidencePath.mockImplementation(async (value) => (value ? `signed:${value}` : null));

    const res = await GET(new Request(url), ctx);

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.versions.map((version) => version.version_number)).toEqual([1, 2]);
    expect(body.versions[0].file_url_signed).toBe("signed:deliverables/v1.pdf");
    expect(signEvidencePath).toHaveBeenCalledTimes(2);
  });
});

describe("POST a new version", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ cid: "F1", role: "founder" });
  });

  test("403 when the caller may not file documents", async () => {
    canSubmitVerification.mockResolvedValue(false);
    const res = await POST(
      new Request(url, { method: "POST", body: JSON.stringify({ file_url: "deliverables/v2.pdf" }) }),
      ctx,
    );
    expect(res.status).toBe(403);
    expect(addVerificationDocumentVersion).not.toHaveBeenCalled();
  });

  test("400 without a file_url", async () => {
    canSubmitVerification.mockResolvedValue(true);
    const res = await POST(new Request(url, { method: "POST", body: JSON.stringify({}) }), ctx);
    expect(res.status).toBe(400);
    expect(addVerificationDocumentVersion).not.toHaveBeenCalled();
  });

  test("404 when the document is not part of the Venture", async () => {
    canSubmitVerification.mockResolvedValue(true);
    addVerificationDocumentVersion.mockResolvedValue(null);
    const res = await POST(
      new Request(url, { method: "POST", body: JSON.stringify({ file_url: "deliverables/v2.pdf" }) }),
      ctx,
    );
    expect(res.status).toBe(404);
  });

  test("files the version and reports its number", async () => {
    canSubmitVerification.mockResolvedValue(true);
    addVerificationDocumentVersion.mockResolvedValue({ success: true, version_number: 3 });

    const res = await POST(
      new Request(url, {
        method: "POST",
        body: JSON.stringify({ file_url: "deliverables/v3.pdf", file_name: "v3.pdf", file_size: 300, file_type: "application/pdf" }),
      }),
      ctx,
    );

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ success: true, version_number: 3 });
    expect(addVerificationDocumentVersion).toHaveBeenCalledWith(
      expect.objectContaining({ ventureId: VENTURE_ID, documentId: String(DOC_ID), fileUrl: "deliverables/v3.pdf", uploadedBy: "F1" }),
    );
  });
});
