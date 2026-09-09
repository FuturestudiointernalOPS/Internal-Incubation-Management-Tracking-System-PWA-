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

describe("I6A converted handlers — bare requireAuth + downstream membership machinery", () => {
  test("ventures/[id]/members: GET/POST/PATCH bare; checkAccess/checkMutateAccess present", () => {
    const file = "src/app/api/ventures/[id]/members/route.js";
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    expect(bareAuthCount(file)).toBe(3);
    expect(authBlocks(file)).toHaveLength(0); // no role list remains anywhere
    expect(src).toMatch(/checkAccess\(/);
    expect(src).toMatch(/checkMutateAccess\(/);
    expect(src).toMatch(/requireOperationalVentureAccess/);
  });

  test("investor/profile: GET bare (own-profile read), POST/PUT gates untouched", () => {
    const file = "src/app/api/investor/profile/route.js";
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    expect(bareAuthCount(file)).toBe(1); // GET
    const lists = authBlocks(file);
    // PUT keeps its pure-global list [super_admin, staff]
    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatch(/super_admin/);
    expect(lists[0]).toMatch(/staff/);
    expect(containsContextual(lists[0])).toBe(false);
    // POST stays capability-gated (no requireAuth allowlist)
    expect(src).toMatch(/requireAuthorization\("investor", "create"\)/);
  });
});

describe("I6A backlog watchlist — deferred contextual-role lists (need downstream gates first)", () => {
  // Each file's allowlists stay role-listed until a real downstream
  // membership/capability gate exists for the contextual holder. Removing a
  // list here without building the gate = widening access: this test fails.
  const deferred = [
    "src/app/api/contacts/route.js", // GET directory: role=scope; cidFilter over-read
    "src/app/api/contacts/search/route.js", // role-keyed branch split (not membership-keyed)
    "src/app/api/families/route.js", // GET unscoped family list
    "src/app/api/participant-programs/route.js", // GET cross-participant read
    "src/app/api/platform/ai/route.js", // AI spend, no context in request
    "src/app/api/platform/ai/analyze/route.js",
    "src/app/api/platform/ai/evaluate-submission/route.js", // auto-approve + emails
    "src/app/api/platform/ai/evaluation-scores/route.js", // PII read
    "src/app/api/platform/form-runs/route.js", // review + send_result_emails actions
    "src/app/api/programs/route.js", // GET whole-directory read
    "src/app/api/teacher/reports/route.js", // client-supplied teacher identity
    "src/app/api/v2/teacher/fulfillment/route.js", // program-scoped PII read
    "src/app/api/v2/teacher/full-state/route.js", // client-supplied cid scope key
    "src/app/api/v2/teacher/reports/route.js",
    "src/app/api/investor/campaigns/route.js", // GET unscoped campaign list
    "src/app/api/investor/pipeline/route.js", // GET: unscoped venture_id branch
    "src/app/api/teams/route.js", // GET: own-team scope exists only in comments
    "src/app/api/upload/route.js", // no context; eligibility question
    "src/app/api/ventures/[id]/history/route.js", // founder unchecked; staff gate broken (db)
  ];

  test.each(deferred)("%s keeps its documented role list (locked deferral)", (file) => {
    const blocks = authBlocks(file);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.some((b) => containsContextual(b))).toBe(true);
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
