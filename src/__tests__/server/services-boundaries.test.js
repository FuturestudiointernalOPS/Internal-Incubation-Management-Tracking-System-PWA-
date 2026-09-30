/**
 * SERVICE LAYER — boundaries.
 *
 * The split introduced a service layer (`src/services/**`) that decides, and a
 * repository (`src/models/**`) that only reads and writes. The rule that makes
 * the split worth having is simple: a service must never run SQL. If it did,
 * the decision could not be tested without a database, and we would be back to
 * the module this split was created to break up.
 *
 * This suite pins that rule, and pins that the compatibility facades still
 * expose the decision surface, so a rename cannot silently break importers.
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "..");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const relative = (file) => path.relative(SRC, file).split(path.sep).join("/");

describe("services never touch the database directly", () => {
  const serviceFiles = walk(path.join(SRC, "services"));

  it("finds the service layer", () => {
    expect(serviceFiles.length).toBeGreaterThan(0);
  });

  it.each(serviceFiles.map(relative))("%s runs no SQL", (rel) => {
    const source = fs.readFileSync(path.join(SRC, rel), "utf8");
    expect(source).not.toMatch(/\bdb\.execute\b/);
    expect(source).not.toMatch(/import\s+db\s+from/);
    expect(source).not.toMatch(/require\(\s*["']@\/lib\/db["']\s*\)\.default/);
  });
});

describe("services are HTTP-free", () => {
  const serviceFiles = walk(path.join(SRC, "services"));

  // The decision is a value ({ allowed, status, errorKey }); turning it into a
  // response is the HTTP boundary's job (@/server/authz/responses).
  it.each(serviceFiles.map(relative))("%s imports no HTTP layer", (rel) => {
    const source = fs.readFileSync(path.join(SRC, rel), "utf8");
    expect(source).not.toMatch(/from\s+["']next\/server["']/);
    expect(source).not.toMatch(/\bNextResponse\b/);
  });
});

describe("repositories stay HTTP-free", () => {
  it.each([
    "models/authorization/contextReads.js",
    "models/authorization/contextGrantReadinessReads.js",
    "models/authorization/scopeReads.js",
    "models/authorization/eligibilityAdminReads.js",
    "models/authorization/contextAssignmentReads.js",
    "models/authorization/contextGrantsStore.js",
    "models/authorization/programAssignmentReads.js",
    "models/finance/ingestStore.js",
    "models/finance/queriesStore.js",
    "models/kpiProgressStore.js",
    "models/contactGroupSyncStore.js",
    "models/ventureDocumentTypesStore.js",
    "models/authorization/programScopeReadinessReads.js",
    "models/lms/learningStore.js",
    "models/lms/checkoutStore.js",
    "models/workspaceCalendarStore.js",
    "models/venturePlanImportStore.js",
    "models/platform/ai/reportStore.js",
  ])("%s imports no HTTP layer", (rel) => {
    const source = fs.readFileSync(path.join(SRC, rel), "utf8");
    expect(source).not.toMatch(/from\s+["']next\/server["']/);
    expect(source).not.toMatch(/\bNextResponse\b/);
  });
});

describe("the decision surface survives the move", () => {
  const DECISION_EXPORTS = [
    "authorize",
    "can",
    "getAuthorizationContext",
    "resolveAuthorizationContext",
    "invalidateAuthorizationContext",
    "invalidateAllAuthorizationContexts",
    "mergeEffectiveCapabilities",
    "effectivePermissionsFromContext",
    "buildPermissionExplanation",
    "rowsToCaps",
    "rowsToRestrictions",
    "restrictionsToJson",
  ];

  it.each(DECISION_EXPORTS)("is exported by the service module (%s)", (name) => {
    const service = require("@/services/authorization");
    expect(service[name]).toBeDefined();
  });

  it.each(DECISION_EXPORTS)("is still exported by the model facade (%s)", (name) => {
    const facade = require("@/models/authorization/resolver");
    expect(facade[name]).toBeDefined();
  });
});

describe("the HTTP boundary owns the refusal responses", () => {
  it.each(["requireAuthorization", "requireScopedAccess"])(
    "is exported by @/server/authz (%s)",
    (name) => {
      expect(require("@/server/authz")[name]).toBeDefined();
    },
  );

  it.each(["requireAuthorization", "requireScopedAccess"])(
    "stays reachable from the authorization barrel (%s)",
    (name) => {
      expect(require("@/models/authorization/index")[name]).toBeDefined();
    },
  );

  it("is no longer implemented in the service layer", () => {
    const service = require("@/services/authorization");
    expect(service.requireAuthorization).toBeUndefined();
    expect(service.requireScopedAccess).toBeUndefined();
  });
});
