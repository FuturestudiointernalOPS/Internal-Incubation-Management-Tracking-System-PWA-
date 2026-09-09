/**
 * PHASE I5 — Legacy facilitator-gate bridge contract.
 *
 * Locks the I5 conversion pattern on the facilitator-surface API cohort:
 *
 *   The role pre-filter is NOT the security decision — the program
 *   assignment gate is. Converted handlers therefore call bare requireAuth()
 *   (any authenticated session) and rely on requireAssignmentAccess /
 *   hasProgramManagementAccess downstream. That is what lets a MEMBER who
 *   holds a facilitator assignment operate the facilitator surface, while
 *   unassigned sessions stay denied at the assignment gate.
 *
 * Deferred handlers still carry documented role lists (legacy-trust reads or
 * self-service writes) and are listed here so their migration is a conscious
 * future step — this test fails if a deferred list changes without updating
 * this contract, and if a converted handler regrows a role list.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");

/** All requireAuth([...]) blocks in a file (multiline). */
function authBlocks(file) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  return [...src.matchAll(/requireAuth\(\s*\[([^\]]*)\]\)/gs)].map((m) =>
    m[1].replace(/\s+/g, " ").trim(),
  );
}

/** Number of bare requireAuth() calls (no allowlist). */
function bareAuthCount(file) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  return [...src.matchAll(/requireAuth\(\s*\)/gs)].length;
}

const CONTEXTUAL_ROLES = [
  "facilitator",
  "teacher",
  "participant",
  "founder",
  "investor",
  "team",
];

const containsContextual = (list) =>
  CONTEXTUAL_ROLES.some((r) => list.split(",").map((s) => s.trim().replace(/"/g, "")).includes(r));

describe("I5 converted handlers — bare requireAuth + assignment machinery", () => {
  const converted = [
    "src/app/api/attendance/route.js",
    "src/app/api/facilitator-reviews/route.js",
    "src/app/api/participants/route.js",
    "src/app/api/submissions/route.js",
  ];

  test.each(converted)("%s keeps the assignment machinery imported", (file) => {
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    expect(src).toMatch(/requireAssignmentAccess/);
    expect(src).toMatch(/hasProgramManagementAccess/);
  });

  test("attendance: POST is bare (assignment-gated); GET keeps its documented legacy list", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/app/api/attendance/route.js"), "utf8");
    const blocks = [...src.matchAll(/requireAuth\(\s*\[([^\]]*)\]\)/gs)].map((m) => m[1]);
    expect(bareAuthCount("src/app/api/attendance/route.js")).toBe(1); // POST only
    expect(blocks).toHaveLength(1); // GET deferred
    expect(blocks[0]).toMatch(/participant/); // participant self-view list preserved
  });

  test("facilitator-reviews: GET+POST bare; PUT stays [SA, PM, staff]", () => {
    expect(bareAuthCount("src/app/api/facilitator-reviews/route.js")).toBe(2);
    const lists = authBlocks("src/app/api/facilitator-reviews/route.js");
    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatch(/super_admin/);
    expect(lists[0]).toMatch(/program_manager/);
    expect(lists[0]).toMatch(/staff/);
    expect(containsContextual(lists[0])).toBe(false);
  });

  test("participants: GET bare; POST stays [staff, super_admin]", () => {
    expect(bareAuthCount("src/app/api/participants/route.js")).toBe(1);
    const lists = authBlocks("src/app/api/participants/route.js");
    expect(lists).toHaveLength(1); // POST
    expect(lists[0]).toMatch(/staff/);
    expect(containsContextual(lists[0])).toBe(false);
  });

  test("submissions: PATCH bare; POST (self-service) and GET (legacy-trust) stay listed", () => {
    expect(bareAuthCount("src/app/api/submissions/route.js")).toBe(1);
    const lists = authBlocks("src/app/api/submissions/route.js");
    expect(lists).toHaveLength(3);
    // POST — participant/team self-service list preserved.
    expect(lists[0]).toMatch(/participant/);
    expect(lists[0]).toMatch(/team/);
    // GET — deferred legacy-trust read; documented here, not converted.
    expect(lists[1]).toMatch(/facilitator/);
    // Third handler — pure global roles, no contextual roles.
    expect(containsContextual(lists[2])).toBe(false);
  });
});

describe("I5 completed pattern (sessions + followups) stays clean", () => {
  test.each(["src/app/api/sessions/route.js", "src/app/api/followups/route.js"])(
    "%s uses no role-list requireAuth at all",
    (file) => {
      const src = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect(src).not.toMatch(/requireAuth\(\s*\[/);
      expect(src).toMatch(/requireAssignmentAccess/);
    },
  );
});

describe("I5 backlog watchlist — deferred facilitator role lists (conscious migration later)", () => {
  test.each([
    "src/app/api/pm/full-state/route.js",
    "src/app/api/pm/programs/route.js",
  ])("%s still lists facilitator (PM-console legacy over-grant, needs product decision)", (file) => {
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    expect(src).toMatch(/requireAuth\(\s*\[[^\]]*facilitator/);
  });
});
