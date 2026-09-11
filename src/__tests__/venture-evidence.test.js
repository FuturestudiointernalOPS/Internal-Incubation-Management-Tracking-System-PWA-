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
