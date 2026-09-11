/**
 * Deliverable evidence — ACCESS wiring contract.
 *
 * The Venture side (founders/team) must be able to attach evidence, so the
 * upload route is gated by VENTURE ACCESS — never by the staff capability gate
 * (which refuses founders without a program enrollment).
 *
 * Evidence is PRIVATE: the upload returns a storage path, the database stores
 * that path (never a public URL), and reads mint short-lived signed URLs for
 * viewers who already passed a Venture access gate. Review stays on the agreed
 * authority helpers.
 */
const fs = require("fs");
const path = require("path");

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("deliverable evidence upload access", () => {
  const UPLOAD = "src/app/api/ventures/[id]/deliverables/upload/route.js";
  const ROUTE = "src/app/api/ventures/[id]/deliverables/route.js";
  const STORAGE = "src/lib/storage.js";
  const JOURNEY = "src/app/api/ventures/[id]/journey/route.js";

  test("the upload route is gated by Venture access (founders included)", () => {
    const src = read(UPLOAD);
    expect(src).toContain("requireVentureAccess");
    // The staff-only gate would 403 the Venture's own members.
    expect(src).not.toContain("requireVentureScopedAccess");
  });

  test("uploads are capped, private, and return a storage path — never a public URL", () => {
    const src = read(UPLOAD);
    expect(src).toContain("uploadDeliverableEvidence");
    expect(src).toContain("path: result.path");

    const storage = read(STORAGE);
    expect(storage).toContain("uploadDeliverableEvidence");
    expect(storage).toContain("MAX_FILE_SIZE");
    expect(storage).toContain("deliverable-evidence");
    expect(storage).toContain("public: false");
    // The deliverable helper must not mint public URLs (other helpers may).
    const helper = storage.slice(storage.indexOf("uploadDeliverableEvidence"));
    expect(helper).not.toContain("getPublicUrl");
  });

  test("reads sign private evidence for authorized viewers only", () => {
    const src = read(JOURNEY);
    expect(src).toContain("evidenceDownloadUrl");
    expect(src).toContain("evidence_download_url");
  });

  test("definition and review stay on the agreed authority helpers", () => {
    const src = read(ROUTE);
    expect(src).toContain("canDefineDeliverables");
    expect(src).toContain("canReviewDeliverable");
    expect(src).toContain('capability: "review"');
  });

  test("evidence submissions are recorded on the deliverable (url + name)", () => {
    const src = read(ROUTE);
    expect(src).toContain("attachment_url");
    expect(src).toContain("attachment_name");
  });
});
