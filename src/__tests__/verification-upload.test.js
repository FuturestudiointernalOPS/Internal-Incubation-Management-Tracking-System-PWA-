/**
 * Venture verification documents — upload + private read contract.
 *
 * The verification screens used to POST JSON ({ action: "upload", … }) to the
 * shared /api/upload route, which expects multipart `file` — so the handshake
 * could never succeed and the screens silently stored "pending". Even had it
 * succeeded, /api/upload writes to the PUBLIC submissions bucket, which is
 * wrong for compliance documents.
 *
 * Verification documents therefore follow the deliverable-evidence pattern:
 * a Venture-access gated multipart route uploads into the PRIVATE
 * `deliverable-evidence` bucket, the database records the storage path, and
 * reads mint short-lived signed URLs (external links stay untouched).
 */

const fs = require("fs");
const path = require("path");

const mockRead = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

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
  requireVentureAccess: jest.fn(),
}));

jest.mock("@/lib/storage", () => ({
  __esModule: true,
  uploadDeliverableEvidence: jest.fn(),
}));

jest.mock("@/lib/ventureEvidence", () => ({
  __esModule: true,
  signEvidencePath: jest.fn(),
}));

jest.mock("@/lib/ventures", () => ({
  __esModule: true,
  getOrCreateVerification: jest.fn(),
  submitVerification: jest.fn(),
  resubmitVerification: jest.fn(),
  uploadVerificationDocument: jest.fn(),
  deleteVerificationDocument: jest.fn(),
  addVerificationComment: jest.fn(),
  canSubmitVerification: jest.fn(),
  canManageVerification: jest.fn(),
}));

const { getSession } = require("@/lib/auth");
const { requireVentureAccess } = require("@/lib/ventureAuth");
const { uploadDeliverableEvidence } = require("@/lib/storage");
const { signEvidencePath } = require("@/lib/ventureEvidence");
const { getOrCreateVerification } = require("@/lib/ventures");
const { POST: uploadVerificationDocument } = require("@/app/api/ventures/[id]/verification/upload/route");
const { GET: getVerification } = require("@/app/api/ventures/[id]/verification/route");

const VENTURE_ID = "VNT-1";
const ctx = { params: { id: VENTURE_ID } };
const STORAGE_PATH = "deliverables/VNT-1/verification-legal_documents/1700000000000_id.pdf";
const PNG_STORAGE_PATH = "deliverables/VNT-1/verification-legal_documents/1700000000001_id-card.png";

const multipartRequest = ({ file, fileType = "application/pdf", ...fields } = {}) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  // `file` is the FILE NAME — the body carries a real Blob under that name.
  if (file) form.append("file", new Blob(["%PDF-1.4"], { type: fileType }), file);
  return new Request(`http://localhost/api/ventures/${VENTURE_ID}/verification/upload`, { method: "POST", body: form });
};

beforeEach(() => {
  jest.clearAllMocks();
  requireVentureAccess.mockResolvedValue({ session: { cid: "F1", role: "founder" } });
});

describe("POST /api/ventures/[id]/verification/upload", () => {
  test("rejects a request with no file (400)", async () => {
    const res = await uploadVerificationDocument(multipartRequest({ category: "legal_documents" }), ctx);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("No file provided");
    expect(uploadDeliverableEvidence).not.toHaveBeenCalled();
  });

  test("returns the private storage path from the upload helper", async () => {
    uploadDeliverableEvidence.mockResolvedValue({ success: true, path: STORAGE_PATH, name: "id.pdf" });

    const res = await uploadVerificationDocument(
      multipartRequest({ file: "id.pdf", category: "legal_documents" }),
      ctx,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, path: STORAGE_PATH, name: "id.pdf" });
    // The second argument namespaces the path so verification documents are
    // identifiable in the shared private evidence bucket.
    expect(uploadDeliverableEvidence.mock.calls[0][1]).toEqual({
      ventureId: VENTURE_ID,
      deliverableId: "verification-legal_documents",
      // Verification accepts photos (founder ID, scanned cards) — unlike
      // deliverable evidence, which stays documents-only.
      allowImages: true,
    });
  });

  test("accepts a PNG (founder ID photo) and asks the helper to allow images", async () => {
    uploadDeliverableEvidence.mockResolvedValue({ success: true, path: PNG_STORAGE_PATH, name: "id-card.png" });

    const res = await uploadVerificationDocument(
      multipartRequest({ file: "id-card.png", fileType: "image/png", category: "legal_documents" }),
      ctx,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, path: PNG_STORAGE_PATH, name: "id-card.png" });
    expect(uploadDeliverableEvidence.mock.calls[0][1]).toEqual({
      ventureId: VENTURE_ID,
      deliverableId: "verification-legal_documents",
      allowImages: true,
    });
  });

  test("is gated by Venture access (founders upload), not the staff capability gate", async () => {
    requireVentureAccess.mockResolvedValue({ session: null });

    const res = await uploadVerificationDocument(multipartRequest({ file: "id.pdf" }), ctx);

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("errors.notFound");
    expect(uploadDeliverableEvidence).not.toHaveBeenCalled();
  });
});

describe("GET /api/ventures/[id]/verification — signed document URLs", () => {
  const documents = [
    { id: "d1", file_url: STORAGE_PATH },
    { id: "d2", file_url: "https://example.com/pasted-link.pdf" },
    { id: "d3", file_url: "pending" },
  ];

  beforeEach(() => {
    getSession.mockResolvedValue({ cid: "SA-1", role: "super_admin" });
    getOrCreateVerification.mockResolvedValue({
      verification: { id: "VER-1", status: "draft" },
      items: [],
      documents,
      history: [],
      reviews: [],
      comments: [],
    });
    signEvidencePath.mockImplementation(async (value) =>
      value === STORAGE_PATH ? "https://signed.example/id.pdf" : null,
    );
  });

  test("a storage path gains file_url_signed while the stored value is untouched", async () => {
    const res = await getVerification(new Request(`http://localhost/api/ventures/${VENTURE_ID}/verification`), ctx);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.documents[0].file_url_signed).toBe("https://signed.example/id.pdf");
    expect(body.documents[0].file_url).toBe(STORAGE_PATH);
    expect(signEvidencePath).toHaveBeenCalledTimes(documents.length);
  });

  test("an external link passes through unchanged, and a failed signature stays null", async () => {
    const res = await getVerification(new Request(`http://localhost/api/ventures/${VENTURE_ID}/verification`), ctx);
    const body = await res.json();

    expect(body.documents[1].file_url).toBe("https://example.com/pasted-link.pdf");
    expect(body.documents[1].file_url_signed).toBeNull();
    expect(body.documents[2].file_url).toBe("pending");
    expect(body.documents[2].file_url_signed).toBeNull();
  });

  test("is additive — the payload keeps its shape and the documents array is not duplicated", async () => {
    const res = await getVerification(new Request(`http://localhost/api/ventures/${VENTURE_ID}/verification`), ctx);
    const body = await res.json();

    expect(Object.keys(body)).toEqual([
      "success",
      "verification",
      "items",
      "documents",
      "history",
      "reviews",
      "comments",
    ]);
    expect(body.documents).toHaveLength(documents.length);
  });
});

describe("verification screens — no public bucket handshake left", () => {
  const ADMIN_PAGE = "src/app/admin/ventures/[id]/verification/page.js";
  const FOUNDER_TAB = "src/components/ventures/workspace/tabs/VerificationTab.js";

  test("both screens upload multipart through the Venture verification route", () => {
    for (const file of [ADMIN_PAGE, FOUNDER_TAB]) {
      const src = mockRead(file);
      expect(src).toContain("/verification/upload");
      expect(src).toContain("new FormData()");
      // The public /api/upload handshake is gone, and nothing stores "pending".
      expect(src).not.toContain('"/api/upload"');
      expect(src).not.toContain('file_url: fileUrl || "pending"');
    }
  });
});
