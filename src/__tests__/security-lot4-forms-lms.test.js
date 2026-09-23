/**
 * SECURITY — regression tests for Lot 4 (forms / LMS / uploads).
 *
 * Source-level invariants for the holes removed in this lot: the raw-SQL action,
 * the enumerable certificate number, the upload OR-logic, the client-chosen
 * responsibility at coach-invite, the member role/permissions mass-assignment,
 * the LMS answer key leaked to view-only callers, and the missing program scope
 * on the LMS program surfaces.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("no arbitrary SQL over HTTP", () => {
  test("the form-runs migrate action is gone", () => {
    const src = read("src/app/api/platform/form-runs/route.js");
    expect(src).not.toMatch(/action === "migrate"/);
    expect(src).not.toMatch(/executeRawMigrationSql/);
  });
});

describe("the public certificate verification is not enumerable", () => {
  test("only the random verification token is accepted", () => {
    const src = read("src/models/lms/certificates.js");
    expect(src).toMatch(/WHERE verification_token = \?/);
    expect(src).not.toMatch(/certificate_number = \?/);
  });
});

describe("uploads require an extension AND a compatible content type", () => {
  test.each([
    "src/app/api/upload/route.js",
    "src/app/api/profile/photo/route.js",
    "src/app/api/lms/courses/thumbnail/route.js",
    "src/lib/storage.js",
  ])("%s no longer accepts MIME-or-extension", (file) => {
    const src = read(file);
    expect(src).not.toMatch(/!isMimeValid && !isExtensionValid/);
    expect(src).toMatch(/!isExtensionValid \|\| \(!isMimeValid && !isMimeUnknown\)/);
  });

  test("LMS section resources apply the same rule", () => {
    const src = read("src/lib/lms/sectionResourceFiles.js");
    expect(src).not.toMatch(/!mimeOk && !extensionOk/);
    expect(src).toMatch(/!extensionOk \|\| \(!mimeOk && !mimeUnknown\)/);
  });
});

describe("privilege fields are validated server-side", () => {
  test("coach-invite allows only coach/facilitator and a venture-wide scope", () => {
    const src = read("src/app/api/ventures/[id]/coach-invite/route.js");
    expect(src).toMatch(/COACH_INVITE_RESPONSIBILITIES/);
    expect(src).toMatch(/requestedScope === "venture_wide"/);
    // The body must no longer be trusted verbatim.
    expect(src).not.toMatch(/responsibilityCode: body\.responsibility_code \? String\(body\.responsibility_code\)/);
  });

  test("venture members validate role and permissions", () => {
    const src = read("src/app/api/ventures/[id]/members/route.js");
    expect(src).toMatch(/MEMBER_ROLES/);
    expect(src).toMatch(/permissions must be an object/);
  });
});

describe("LMS read surfaces do not leak more than they should", () => {
  test("the answer key is stripped for callers who cannot edit", () => {
    const src = read("src/app/api/lms/courses/[id]/route.js");
    expect(src).toMatch(/stripAnswerKeys/);
    expect(src).toMatch(/requireAuthorization\("lms", "edit"\)/);
  });

  test("program learning surfaces are program-scoped", () => {
    for (const file of [
      "src/app/api/lms/program-requirements/route.js",
      "src/app/api/lms/coaching-requests/route.js",
    ]) {
      const src = read(file);
      expect(src).toMatch(/requireProgramScope\(\{ programId/);
    }
  });
});
