/**
 * DATA BANK — document versions and who may sign off.
 *
 * Two contracts are pinned here:
 *
 *   1. VERSIONS. A Data bank document row is the LIVE pointer; every upload —
 *      the first one included — is also recorded in
 *      venture_verification_document_versions, so the history runs from version
 *      1 to the newest. A document filed before versioning existed reports its
 *      live file as version 1, and its next upload first archives that file as
 *      version 1 so nothing is lost.
 *
 *   2. SIGN-OFF. Approve/reject belongs to whoever leads the WHOLE Venture: a
 *      Super Admin (or verification officer), or a delegated LEAD MANAGER. A
 *      milestone/task-scoped coach reviews their own milestones, not the
 *      Venture's compliance file.
 */

const inserts = [];
const updates = [];
const flags = {
  document: null,
  versions: [],
  maxVersion: 0,
  createdDocumentId: 42,
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql, args = [] }) => {
      if (/FROM venture_verification_documents vvd/.test(sql)) {
        return { rows: flags.document ? [flags.document] : [] };
      }
      if (/CREATE TABLE IF NOT EXISTS venture_verification_document_versions/.test(sql)) {
        return { rows: [] };
      }
      if (/FROM venture_verification_document_versions\s+WHERE document_id = \? ORDER BY version_number ASC/.test(sql)) {
        return { rows: flags.versions };
      }
      if (/SELECT COALESCE\(MAX\(version_number\), 0\)/.test(sql)) {
        return { rows: [{ max_version: flags.maxVersion }] };
      }
      if (/INSERT INTO venture_verification_documents/.test(sql)) {
        inserts.push({ sql, args });
        return { rows: [{ id: flags.createdDocumentId }] };
      }
      if (/INSERT INTO venture_verification_document_versions/.test(sql)) {
        inserts.push({ sql, args });
        return { rows: [] };
      }
      if (/UPDATE venture_verification_documents/.test(sql)) {
        updates.push({ sql, args });
        return { rows: [] };
      }
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/services/ventures/ventureDocumentTypes", () => ({
  listActiveVentureDocumentTypesOrDefaults: jest.fn(async () => [{ code: "legal_documents" }]),
  canManageVentureDocumentTypes: jest.fn(),
}));

const { uploadVerificationDocument, listVerificationDocumentVersions, addVerificationDocumentVersion, canManageVerification } = require("@/services/ventures/verification");
const {
  canManageVentureDocumentTypes,
} = require("@/services/ventures/ventureDocumentTypes");

const DOCUMENT = {
  id: 11,
  verification_id: 5,
  category: "legal_documents",
  file_name: "old.pdf",
  file_size: 100,
  file_type: "application/pdf",
  file_url: "deliverables/old.pdf",
  uploaded_by: "F1",
  uploaded_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  inserts.length = 0;
  updates.length = 0;
  flags.document = DOCUMENT;
  flags.versions = [];
  flags.maxVersion = 0;
  flags.createdDocumentId = 42;
});

describe("uploadVerificationDocument — the first upload is version 1", () => {
  test("records the document and its version 1 in one call", async () => {
    const result = await uploadVerificationDocument({
      ventureId: "VNT-1",
      verificationId: 5,
      category: "legal_documents",
      documentType: "pdf",
      fileName: "id.pdf",
      fileSize: 10,
      fileType: "application/pdf",
      fileUrl: "deliverables/id.pdf",
      uploadedBy: "F1",
    });

    expect(result).toEqual({ success: true });
    const versionInsert = inserts.find((entry) => /INTO venture_verification_document_versions/.test(entry.sql));
    expect(versionInsert).toBeTruthy();
    // document_id 42 (the created row) bound as version 1.
    expect(versionInsert.args[0]).toBe(42);
    expect(versionInsert.sql).toMatch(/VALUES \(\?, 1,/);
  });
});

describe("listVerificationDocumentVersions", () => {
  test("returns every version, oldest first", async () => {
    flags.versions = [
      { id: 1, document_id: 11, version_number: 1, file_url: "deliverables/v1.pdf" },
      { id: 2, document_id: 11, version_number: 2, file_url: "deliverables/v2.pdf" },
    ];

    const result = await listVerificationDocumentVersions({ ventureId: "VNT-1", documentId: 11 });

    expect(result.document.id).toBe(11);
    expect(result.versions.map((version) => version.version_number)).toEqual([1, 2]);
  });

  test("a pre-versioning document reports its live file as version 1", async () => {
    flags.versions = [];

    const result = await listVerificationDocumentVersions({ ventureId: "VNT-1", documentId: 11 });

    expect(result.versions).toHaveLength(1);
    expect(result.versions[0]).toMatchObject({ version_number: 1, file_url: "deliverables/old.pdf" });
  });

  test("a document from another Venture is not found (null)", async () => {
    flags.document = null;

    const result = await listVerificationDocumentVersions({ ventureId: "VNT-1", documentId: 11 });

    expect(result).toBeNull();
  });
});

describe("addVerificationDocumentVersion", () => {
  test("appends the next version and points the document at it", async () => {
    flags.maxVersion = 1;

    const result = await addVerificationDocumentVersion({
      ventureId: "VNT-1",
      documentId: 11,
      fileUrl: "deliverables/v2.pdf",
      fileName: "v2.pdf",
      fileSize: 200,
      fileType: "application/pdf",
      uploadedBy: "F1",
    });

    expect(result).toEqual({ success: true, version_number: 2 });
    const insert = inserts.find((entry) => /INTO venture_verification_document_versions/.test(entry.sql));
    expect(insert.args).toEqual(expect.arrayContaining([11, 2]));
    expect(updates).toHaveLength(1);
    expect(updates[0].sql).toMatch(/UPDATE venture_verification_documents/);
  });

  test("a pre-versioning document has its live file archived as version 1 first", async () => {
    flags.maxVersion = 0;

    const result = await addVerificationDocumentVersion({
      ventureId: "VNT-1",
      documentId: 11,
      fileUrl: "deliverables/v2.pdf",
      fileName: "v2.pdf",
      fileSize: 200,
      fileType: "application/pdf",
      uploadedBy: "F1",
    });

    expect(result.version_number).toBe(2);
    const versionInserts = inserts.filter((entry) => /INTO venture_verification_document_versions/.test(entry.sql));
    // version 1 (backfilled live file), then version 2 (the new upload).
    expect(versionInserts).toHaveLength(2);
    // v1 stores its number as a SQL literal; v2 binds it as an argument.
    expect(versionInserts[0].sql).toMatch(/VALUES \(\?, 1,/);
    expect(versionInserts[0].args[0]).toBe(11);
    expect(versionInserts[1].args[1]).toBe(2);
  });

  test("a document from another Venture is not touched (null)", async () => {
    flags.document = null;

    const result = await addVerificationDocumentVersion({
      ventureId: "VNT-1",
      documentId: 11,
      fileUrl: "deliverables/v2.pdf",
      fileName: "v2.pdf",
    });

    expect(result).toBeNull();
    expect(updates).toHaveLength(0);
  });
});

describe("canManageVerification — the sign-off belongs to the Venture lead", () => {
  test("a Super Admin always may", async () => {
    const result = await canManageVerification("VNT-1", { role: "super_admin", cid: "SA-1" });
    expect(result).toMatchObject({ allowed: true, isReviewer: true });
  });

  test("a delegated Lead Manager may", async () => {
    canManageVentureDocumentTypes.mockResolvedValue(true);
    const result = await canManageVerification("VNT-1", { role: "staff", cid: "LM-1" });
    expect(result).toMatchObject({ allowed: true, isReviewer: true });
  });

  test("a scoped coach who does not lead the Venture may not", async () => {
    canManageVentureDocumentTypes.mockResolvedValue(false);
    const result = await canManageVerification("VNT-1", { role: "staff", cid: "COACH-1" });
    expect(result).toEqual({ allowed: false });
  });

  test("no session is refused outright", async () => {
    const result = await canManageVerification("VNT-1", null);
    expect(result).toEqual({ allowed: false });
  });
});
