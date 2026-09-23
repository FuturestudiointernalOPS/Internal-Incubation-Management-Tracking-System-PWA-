/**
 * FACILITATOR CAPABILITY COVERAGE CONTRACT
 *
 * The facilitator vocabulary is declared in three places that must agree
 * exactly, and it is ENFORCED in a fourth place (the route layer). This test
 * locks all four together so the two failure modes this repo has already hit
 * cannot recur silently:
 *
 *   - DRIFT: `reviews.submit` lived in PERMISSION_MODULES and the catalog but
 *     not in FACILITATOR_CAPABILITY_KEYS, so the PM UI could not render it and
 *     "full facilitator access" never granted it.
 *   - SILENT GAPS: a capability no route consults looks configurable but
 *     changing it does nothing. The unenforced remainder is listed below WITH
 *     its current enforcement mechanism, so adding or removing enforcement
 *     fails this test until the contract is updated deliberately.
 *
 * Enforcement census (route layer, `capability:` argument of
 * requireAssignmentAccess / requireFacilitatorCapability):
 *
 *   ENFORCED (level-based, per program)
 *     attendance.record   api/attendance/route.js          (POST)
 *     attendance.view     api/attendance/route.js          (GET)
 *     participants.view   api/participants/route.js        (GET)
 *     sessions.conduct    api/sessions/route.js            (POST + GET)
 *     assignments.grade   api/submissions/route.js         (PATCH)
 *     assignments.view    api/submissions/route.js         (GET)
 *     reviews.submit      api/facilitator-reviews/route.js  (POST)
 *
 *   ASSIGNMENT-ONLY (the per-program level is not consulted yet)
 *     participants.manage, assignments.review, sessions.record, progress.view,
 *     groups.view, groups.manage
 *
 *   The remaining six are assignment-only because their routes are gated on a
 *   role allowlist that never admits a facilitator at all (participants POST,
 *   v2 groups) or because no dedicated route exists (sessions.record,
 *   progress.view). Wiring them means loosening or adding a route, which is a
 *   product decision, not an enforcement fix.
 *
 * Migrating the assignment-only remainder to level-based enforcement requires a
 * data backfill of the legacy v2_program_staff.permissions rows first —
 * `getFacilitatorPermissionLevel` answers 0 for a key a row does not carry, so
 * flipping a route before the backfill would deny existing facilitators. That
 * is a product/deploy step, documented in docs/AUTHZ_CURRENT_STATE.md.
 */
const fs = require("node:fs");
const path = require("node:path");

const { FACILITATOR_CAPABILITY_KEYS } = require("@/lib/facilitator-permissions");
const { PERMISSION_MODULES } = require("@/lib/auth");
const { CAPABILITY_CATALOG } = require("@/models/authorization/capability-catalog");

const ROOT = path.join(__dirname, "..", "..");
const API_ROOT = path.join(ROOT, "src", "app", "api");

/** Level-based enforcement sites (capability keys passed to a program guard). */
const ENFORCED = {
  "attendance.record": "src/app/api/attendance/route.js",
  "attendance.view": "src/app/api/attendance/route.js",
  "participants.view": "src/app/api/participants/route.js",
  "sessions.conduct": "src/app/api/sessions/route.js",
  "assignments.grade": "src/app/api/submissions/route.js",
  "assignments.view": "src/app/api/submissions/route.js",
  "reviews.submit": "src/app/api/facilitator-reviews/route.js",
};

/** Declared but not yet consulted at request level (assignment-only today). */
const ASSIGNMENT_ONLY = [
  "participants.manage",
  "assignments.review",
  "sessions.record",
  "progress.view",
  "groups.view",
  "groups.manage",
];

/** Every `capability: "<key>"` argument found in the API routes. */
function capabilityArgsInRoutes() {
  const found = new Set();
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.name === "route.js") {
        const src = fs.readFileSync(fullPath, "utf8");
        for (const match of src.matchAll(/capability:\s*"([a-z_.]+)"/g)) found.add(match[1]);
      }
    }
  })(API_ROOT);
  return found;
}

const sorted = (values) => [...values].sort();

describe("facilitator vocabulary — one list, three declarations", () => {
  test("FACILITATOR_CAPABILITY_KEYS matches PERMISSION_MODULES.facilitator", () => {
    expect(sorted(FACILITATOR_CAPABILITY_KEYS)).toEqual(
      sorted(PERMISSION_MODULES.facilitator.capabilities),
    );
  });

  test("FACILITATOR_CAPABILITY_KEYS matches the capability catalog", () => {
    expect(sorted(FACILITATOR_CAPABILITY_KEYS)).toEqual(
      sorted(Object.keys(CAPABILITY_CATALOG.facilitator.capabilities)),
    );
  });

  test("no key is declared twice", () => {
    expect(new Set(FACILITATOR_CAPABILITY_KEYS).size).toBe(FACILITATOR_CAPABILITY_KEYS.length);
  });
});

describe("facilitator capability enforcement census", () => {
  test("every documented-enforced key has a real call site", () => {
    const used = capabilityArgsInRoutes();
    for (const [key, file] of Object.entries(ENFORCED)) {
      expect(used.has(key)).toBe(true);
      const src = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect(src).toContain(`capability: "${key}"`);
    }
  });

  test("the unenforced remainder is exactly the documented list", () => {
    const used = capabilityArgsInRoutes();
    const actuallyEnforced = FACILITATOR_CAPABILITY_KEYS.filter((key) => used.has(key));
    expect(sorted(actuallyEnforced)).toEqual(sorted(Object.keys(ENFORCED)));

    const notEnforced = FACILITATOR_CAPABILITY_KEYS.filter((key) => !used.has(key));
    expect(sorted(notEnforced)).toEqual(sorted(ASSIGNMENT_ONLY));
  });
});

describe("buildFullFacilitatorPermissions covers the whole vocabulary", () => {
  const { buildFullFacilitatorPermissions } = require("@/lib/facilitator-permissions");

  test("every declared key is granted by the full-access default", () => {
    const permissions = buildFullFacilitatorPermissions();
    for (const key of FACILITATOR_CAPABILITY_KEYS) {
      expect(typeof permissions[key]).toBe("number");
      expect(permissions[key]).toBeGreaterThan(0);
    }
  });
});
