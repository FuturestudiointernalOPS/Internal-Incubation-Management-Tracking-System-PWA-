/**
 * PHASE I5/I6A/I6B — Legacy gate-bridge contract.
 *
 * Locks the conversion pattern on the program/venture/investor-surface API
 * cohorts:
 *
 *   The role pre-filter is NOT the security decision — the membership /
 *   capability / own-scope gate is. Converted handlers therefore call bare
 *   requireAuth() (any authenticated session) and rely on the downstream
 *   decision. That is what lets a MEMBER who holds a legitimate contextual
 *   relationship operate that surface, while unassigned sessions stay denied
 *   at the same gates as before.
 *
 * Deferred handlers still carry documented role lists (legacy-trust reads,
 * self-service writes, or missing downstream gates) and are listed here so
 * their migration is a conscious future step — this test fails if a deferred
 * list disappears without updating this contract, and if a converted handler
 * regrows a role list.
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

describe("I5/I6B converted handlers — bare requireAuth + assignment machinery", () => {
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

  test("attendance: POST + GET are bare (assignment + own-scope decide)", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/app/api/attendance/route.js"), "utf8");
    expect(bareAuthCount("src/app/api/attendance/route.js")).toBe(2); // POST + GET
    expect(authBlocks("src/app/api/attendance/route.js")).toHaveLength(0);
    // Own-scope fallback present for no-programId reads.
    expect(src).toMatch(/participantId = session\.cid/);
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

  test("submissions: POST/PATCH/GET bare — membership binding + assignment/own-scope decide", () => {
    expect(bareAuthCount("src/app/api/submissions/route.js")).toBe(3);
    const src = fs.readFileSync(path.join(ROOT, "src/app/api/submissions/route.js"), "utf8");
    const lists = authBlocks("src/app/api/submissions/route.js");
    expect(lists).toHaveLength(1); // one pure-global handler stays listed
    expect(containsContextual(lists[0])).toBe(false);
    // Own-scope fallback for no-programId reads + self-service identity binding.
    expect(src).toMatch(/participant_id = session\.cid/);
    expect(src).toMatch(/body\.participant_id = session\.cid/);
    expect(src).toMatch(/body\.team_id = session\.cid/);
  });

  test("phase 1.1: ventures/[id]/history — bare + unified membership/assignment gate", () => {
    const file = "src/app/api/ventures/[id]/history/route.js";
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    expect(bareAuthCount(file)).toBe(1);
    expect(authBlocks(file)).toHaveLength(0);
    expect(src).toMatch(/hasActiveVentureAssignment/);
    expect(src).toMatch(/venture_members WHERE venture_id/);
  });

  test("phase 1.1: pm/teams GET — bare + program-context gate (management/capability/assignment)", () => {
    const file = "src/app/api/pm/teams/route.js";
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    expect(bareAuthCount(file)).toBe(1);
    const lists = authBlocks(file);
    expect(lists).toHaveLength(0);
    expect(src).toMatch(/program_id required/);
    expect(src).toMatch(/requireAssignmentAccess/);
    expect(src).toMatch(/authorize\(ctx, "programs", "view"\)/);
  });

  test("phase 1.2: contacts GET — bare + capability gate with universal own-record read", () => {
    const file = "src/app/api/contacts/route.js";
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    expect(bareAuthCount(file)).toBe(1);
    const lists = authBlocks(file);
    expect(lists).toHaveLength(0); // no contextual-role list remains
    expect(src).toMatch(/requireAuthorization\("contacts", "view"\)/);
    expect(src).toMatch(/getContactByCid\(cidFilter \|\| session\.cid\)/);
  });

  test("phase 1.2: contacts/search GET — bare + membership-keyed branch + capability gate", () => {
    const file = "src/app/api/contacts/search/route.js";
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    expect(bareAuthCount(file)).toBe(1);
    const lists = authBlocks(file);
    expect(lists).toHaveLength(0);
    expect(src).toMatch(/isParticipantInProgram/);
    expect(src).toMatch(/isVentureFounderInProgram/);
    expect(src).toMatch(/requireAuthorization\("contacts", "view"\)/);
  });

  test("phase 1.2: programs GET — bare + directory capability, assignment-scoped ?id=", () => {
    const file = "src/app/api/programs/route.js";
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    expect(bareAuthCount(file)).toBe(1); // GET
    const lists = authBlocks(file);
    expect(lists).toHaveLength(2); // POST + PUT [staff, super_admin] — global-only
    for (const l of lists) expect(containsContextual(l)).toBe(false);
    expect(src).toMatch(/requireAuthorization\("programs", "view"\)/);
    expect(src).toMatch(/requireAssignmentAccess/);
  });

  test("pm/full-state: bare (assigned-PM / requireProgramFacilitator decide)", () => {
    expect(bareAuthCount("src/app/api/pm/full-state/route.js")).toBe(1);
    expect(authBlocks("src/app/api/pm/full-state/route.js")).toHaveLength(0);
  });

  test("pm/programs: GET + PUT bare (model scope / programs.edit decide); POST stays global-only", () => {
    expect(bareAuthCount("src/app/api/pm/programs/route.js")).toBe(2);
    const lists = authBlocks("src/app/api/pm/programs/route.js");
    expect(lists).toHaveLength(1); // POST [staff, super_admin]
    expect(lists[0]).toMatch(/staff/);
    expect(containsContextual(lists[0])).toBe(false);
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

describe("I6A/I6B backlog watchlist — deferred contextual-role lists (need downstream gates first)", () => {
  // Each file's allowlists stay role-listed until a real downstream
  // membership/capability gate exists for the contextual holder. Removing a
  // list here without building the gate = widening access: this test fails.
  const deferred = [
    "src/app/api/families/route.js", // GET unscoped family list
    "src/app/api/participant-programs/route.js", // GET cross-participant read
    "src/app/api/platform/ai/route.js", // AI spend, no context in request
    "src/app/api/platform/ai/analyze/route.js",
    "src/app/api/platform/ai/evaluate-submission/route.js", // auto-approve + emails
    "src/app/api/platform/ai/evaluation-scores/route.js", // PII read
    "src/app/api/platform/form-runs/route.js", // review + send_result_emails actions
    "src/app/api/teacher/reports/route.js", // client-supplied teacher identity
    "src/app/api/v2/teacher/fulfillment/route.js", // program-scoped PII read
    "src/app/api/v2/teacher/full-state/route.js", // client-supplied cid scope key
    "src/app/api/v2/teacher/reports/route.js",
    "src/app/api/investor/campaigns/route.js", // GET unscoped campaign list
    "src/app/api/investor/pipeline/route.js", // GET: unscoped venture_id branch
    "src/app/api/teams/route.js", // GET: own-team scope exists only in comments
    "src/app/api/upload/route.js", // no context; eligibility question
  ];

  test.each(deferred)("%s keeps its documented role list (locked deferral)", (file) => {
    const blocks = authBlocks(file);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.some((b) => containsContextual(b))).toBe(true);
  });
});

describe("I6B — pm/* converted, no facilitator/teacher lists may return", () => {
  test("pm/full-state and pm/programs no longer list facilitator/teacher", () => {
    for (const file of [
      "src/app/api/pm/full-state/route.js",
      "src/app/api/pm/programs/route.js",
    ]) {
      const src = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect(src).not.toMatch(/requireAuth\(\s*\[[^\]]*facilitator/);
      expect(src).not.toMatch(/requireAuth\(\s*\[[^\]]*teacher/);
    }
  });
});
