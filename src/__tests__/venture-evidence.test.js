/**
 * Deliverable evidence — private storage helpers.
 *
 * Stored values are either an external link the author pasted (http/https) or
 * a storage path that must be signed on read. These tests lock the
 * discrimination rules and the fail-closed signing behaviour.
 */
const {
  isExternalEvidenceLink,
  evidenceStoragePath,
  signEvidencePath,
  evidenceDownloadUrl,
  EVIDENCE_BUCKET,
  isAllowedEvidenceDocument,
  isAllowedEvidenceImage,
  EVIDENCE_DOCUMENT_ERROR,
  EVIDENCE_IMAGE_ERROR,
} = require("@/lib/ventureEvidence");

describe("evidence value discrimination", () => {
  test("http(s) links are external and pass through untouched", async () => {
    expect(isExternalEvidenceLink("https://example.com/deck.pdf")).toBe(true);
    expect(isExternalEvidenceLink("http://example.com")).toBe(true);
    expect(await evidenceDownloadUrl("https://example.com/deck.pdf")).toBe("https://example.com/deck.pdf");
  });

  test("storage paths are recognised, never treated as links", () => {
    expect(isExternalEvidenceLink("deliverables/VNT-1/dv-1/123_deck.pdf")).toBe(false);
    expect(evidenceStoragePath("deliverables/VNT-1/dv-1/123_deck.pdf")).toBe("deliverables/VNT-1/dv-1/123_deck.pdf");
  });

  test("a marked form (supabase://bucket/path) resolves to the plain path", () => {
    expect(evidenceStoragePath("supabase://deliverable-evidence/deliverables/VNT-1/x.pdf")).toBe("deliverables/VNT-1/x.pdf");
  });

  test("leading slashes are stripped", () => {
    expect(evidenceStoragePath("/deliverables/VNT-1/x.pdf")).toBe("deliverables/VNT-1/x.pdf");
  });

  test("empty / whitespace values yield nothing", async () => {
    expect(evidenceStoragePath("")).toBe(null);
    expect(evidenceStoragePath("   ")).toBe(null);
    expect(await evidenceDownloadUrl("")).toBe(null);
  });
});

describe("signing fails closed", () => {
  test("external links are never signed", async () => {
    expect(await signEvidencePath("https://example.com/deck.pdf")).toBe(null);
  });

  test("without storage credentials a path yields null (no leak, no crash)", async () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      expect(await signEvidencePath("deliverables/VNT-1/x.pdf")).toBe(null);
      expect(await evidenceDownloadUrl("deliverables/VNT-1/x.pdf")).toBe(null);
    } finally {
      if (prevUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
      if (prevKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
    }
  });

  test("evidence lives in a dedicated bucket", () => {
    expect(EVIDENCE_BUCKET).toBe("deliverable-evidence");
  });
});

describe("evidence is a document or a URL", () => {
  test("PDF and Office documents are accepted", () => {
    expect(isAllowedEvidenceDocument({ name: "deck.pdf", type: "application/pdf" })).toBe(true);
    expect(isAllowedEvidenceDocument({ name: "plan.docx", type: "" })).toBe(true);
    expect(isAllowedEvidenceDocument({ name: "model.xlsx", type: "" })).toBe(true);
    expect(isAllowedEvidenceDocument({ name: "pitch.pptx", type: "" })).toBe(true);
    expect(isAllowedEvidenceDocument({ name: "notes.doc", type: "application/msword" })).toBe(true);
  });

  test("images and other files are rejected", () => {
    expect(isAllowedEvidenceDocument({ name: "screenshot.png", type: "image/png" })).toBe(false);
    expect(isAllowedEvidenceDocument({ name: "photo.jpg", type: "image/jpeg" })).toBe(false);
    expect(isAllowedEvidenceDocument({ name: "archive.zip", type: "application/zip" })).toBe(false);
    expect(isAllowedEvidenceDocument({ name: "clip.mp4", type: "video/mp4" })).toBe(false);
    expect(isAllowedEvidenceDocument(null)).toBe(false);
  });
});

describe("verification documents accept images; deliverable evidence does not", () => {
  test("isAllowedEvidenceImage accepts PNG / JPG, by MIME or extension", () => {
    expect(isAllowedEvidenceImage({ name: "id-card.png", type: "image/png" })).toBe(true);
    expect(isAllowedEvidenceImage({ name: "id-card.png", type: "" })).toBe(true);
    expect(isAllowedEvidenceImage({ name: "card.jpg", type: "image/jpeg" })).toBe(true);
    expect(isAllowedEvidenceImage({ name: "card.jpeg", type: "image/jpg" })).toBe(true);
    expect(isAllowedEvidenceImage({ name: "deck.pdf", type: "application/pdf" })).toBe(true);
    expect(isAllowedEvidenceImage({ name: "plan.docx", type: "" })).toBe(true);
  });

  test("isAllowedEvidenceImage still rejects everything else", () => {
    expect(isAllowedEvidenceImage({ name: "installer.exe", type: "application/x-msdownload" })).toBe(false);
    expect(isAllowedEvidenceImage({ name: "installer.exe", type: "" })).toBe(false);
    expect(isAllowedEvidenceImage({ name: "archive.zip", type: "application/zip" })).toBe(false);
    expect(isAllowedEvidenceImage({ name: "clip.mp4", type: "video/mp4" })).toBe(false);
    expect(isAllowedEvidenceImage(null)).toBe(false);
  });

  test("deliverable evidence is unchanged: the document allow-list still rejects an image", () => {
    expect(isAllowedEvidenceDocument({ name: "id-card.png", type: "image/png" })).toBe(false);
    expect(isAllowedEvidenceDocument({ name: "card.jpg", type: "image/jpeg" })).toBe(false);
    expect(EVIDENCE_DOCUMENT_ERROR).toContain("Only documents");
    expect(EVIDENCE_IMAGE_ERROR).toContain("documents or images");
  });
});
