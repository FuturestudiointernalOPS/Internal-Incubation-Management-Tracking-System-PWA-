/**
 * Contract tests — assignment-scope enforcement for Venture review actions
 * (Vinance 3, item 2 of 3).
 *
 * Guards:
 *   - POST /api/ventures/[id]/tasks/[taskId]/submissions { action:"review" }:
 *     a delegated (non-global) reviewer may only review submissions whose task
 *     lies inside one of his ACTIVE assignment scopes on the Venture. Global
 *     roles and venture-wide / lead_manager assignments pass Venture-wide;
 *     actors WITHOUT assignment rows keep the legacy behavior; a scope
 *     resolution error FAILS CLOSED (403) so a bug can never over-grant.
 *   - GET /api/ventures/[id]/submissions/review-queue: delegated actors only
 *     see pending submissions whose task is in scope; global roles,
 *     venture-wide / lead_manager scopes and actors without assignment rows
 *     keep the existing full-Venture queue (LIMIT-20 semantics unchanged).
 */

const executed = [];

const VENTURE_DB_ID = "11111111-1111-4111-8111-111111111111";
const M1 = "33333333-3333-4333-8333-333333333333";
const M2 = "44444444-4444-4444-8444-444444444444";
const STAGE_1 = "55555555-5555-4555-8555-555555555555";
const STAGE_2 = "66666666-6666-4666-8666-666666666666";
const T1 = 101;
const T2 = 102;

const SUBMISSION_1 = { submission_id: 501, task_id: T1, version: 2, file_url: null, file_name: null, notes: "v2", submitted_by_name: "Founder A", created_at: "2026-01-02T10:00:00Z", task_title: "Pitch deck", milestone_title: "Raise" };
const SUBMISSION_2 = { submission_id: 502, task_id: T2, version: 1, file_url: null, file_name: null, notes: "v1", submitted_by_name: "Founder B", created_at: "2026-01-03T10:00:00Z", task_title: "Financial model", milestone_title: "Finance" };

function makeFakeDb() {
  const flags = {
    assignments: [],            // raw venture_staff_assignments rows ([] = no rows)
    assignmentsThrow: false,
    tasksByVenture: [
      { id: T1, milestone_id: M1, journey_stage_id: STAGE_1 },
      { id: T2, milestone_id: M2, journey_stage_id: STAGE_2 },
    ],
    taskRowById: {},
    queueRows: [SUBMISSION_1, SUBMISSION_2],
    submissionExists: true,
    submissionRows: [{ id: 501, task_id: T1, version: 2, status: "submitted", notes: "v2" }],
    stageLookup: { [M1]: STAGE_1, [M2]: STAGE_2 },
  };

  const execute = jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });

    // Venture code → internal db id (both routes)
    if (sql.includes("SELECT id FROM ventures WHERE venture_id = ?")) {
      return { rows: [{ id: VENTURE_DB_ID }] };
    }
    // getAssignmentScopes — active assignment rows for one actor
    if (sql.includes("FROM venture_staff_assignments") && sql.includes("staff_contact_id = ?")) {
      if (flags.assignmentsThrow) throw new Error("boom: assignments");
      return { rows: flags.assignments };
    }
    // listTaskScopeContexts — queue-scoping input set
    if (sql.includes("SELECT t.id, t.milestone_id, m.journey_stage_id")) {
      return { rows: flags.tasksByVenture };
    }
    // resolveTaskContext — milestone → journey stage (single task)
    if (sql.includes("SELECT journey_stage_id FROM venture_milestones WHERE id::text = ?")) {
      const stage = flags.stageLookup[String(args[0])];
      return { rows: stage ? [{ journey_stage_id: stage }] : [] };
    }
    // Review-queue main query (pending latest submission per task)
    if (sql.includes("FROM venture_task_submissions s") && sql.includes("review_decision IS NULL")) {
      return { rows: flags.queueRows };
    }
    // resolveTask — SELECT * from venture_tasks by id
    if (sql.includes("SELECT * FROM venture_tasks WHERE id = ?")) {
      const row = flags.taskRowById[String(args[0])];
      return { rows: row ? [row] : [] };
    }
    // Review decision write path
    if (sql.includes("UPDATE venture_task_submissions") && sql.includes("review_decision")) {
      return { rows: [] };
    }
    if (sql.includes("UPDATE venture_tasks SET status")) {
      return { rows: [] };
    }
    // Submission lookup for the decision
    if (sql.includes("FROM venture_task_submissions WHERE id = ? AND task_id = ?")) {
      return { rows: flags.submissionExists ? [{ id: 501, task_id: args[1], version: 2 }] : [] };
    }
    // notify context stage lookup (guarded in the route)
    if (sql.includes("SELECT journey_stage_id FROM venture_milestones WHERE id = ? AND journey_stage_id IS NOT NULL")) {
      return { rows: [] };
    }
    // listSubmissions — history read after a decision
    if (sql.includes("FROM venture_task_submissions WHERE task_id = ?") && sql.includes("ORDER BY version ASC")) {
      return { rows: flags.submissionRows };
    }
    return { rows: [] };
  });

  return { execute, flags };
}

const mockDb = makeFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn(),
}));

jest.mock("@/lib/ventureAuth", () => ({
  requireVentureAccess: jest.fn().mockResolvedValue({ session: { cid: "coach-1", name: "Coach One", role: "staff" } }),
  isStaffActorForVenture: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/ventureNotify", () => ({
  notifyAndEmailVentureFounders: jest.fn().mockResolvedValue({ success: true }),
}));

const mockVentureAuth = require("@/lib/ventureAuth");

const { POST: reviewPOST } = require("@/app/api/ventures/[id]/tasks/[taskId]/submissions/route");
const { GET: queueGET } = require("@/app/api/ventures/[id]/submissions/review-queue/route");
const { getAssignmentScopes, isTaskInScope, hasVentureWideReach } = require("@/lib/ventureScope");
const readJson = async (res) => res.json();

const reviewRequest = (taskId, body) =>
  new Request(`http://localhost/api/ventures/VNT-TEST/tasks/${taskId}/submissions`, {
    method: "POST",
    body: JSON.stringify(body),
  });

const REVIEW_BODY = { action: "review", submission_id: 501, decision: "approved", comment: "Nice work" };

function resetFixtures() {
  executed.length = 0;
  jest.clearAllMocks();
  mockDb.flags.assignments = [];
  mockDb.flags.assignmentsThrow = false;
  mockDb.flags.tasksByVenture = [
    { id: T1, milestone_id: M1, journey_stage_id: STAGE_1 },
    { id: T2, milestone_id: M2, journey_stage_id: STAGE_2 },
  ];
  mockDb.flags.queueRows = [SUBMISSION_1, SUBMISSION_2];
  mockDb.flags.submissionExists = true;
  mockDb.flags.submissionRows = [{ id: 501, task_id: T1, version: 2, status: "submitted", notes: "v2" }];
  mockDb.flags.stageLookup = { [M1]: STAGE_1, [M2]: STAGE_2 };
  mockDb.flags.taskRowById = {
    [T1]: { id: T1, venture_id: VENTURE_DB_ID, milestone_id: M1, title: "Pitch deck", status: "review", review_required: 1 },
    [T2]: { id: T2, venture_id: VENTURE_DB_ID, milestone_id: M2, title: "Financial model", status: "review", review_required: 1 },
  };
  mockVentureAuth.requireVentureAccess.mockReset();
  mockVentureAuth.requireVentureAccess.mockResolvedValue({ session: { cid: "coach-1", name: "Coach One", role: "staff" } });
  mockVentureAuth.isStaffActorForVenture.mockReset();
  mockVentureAuth.isStaffActorForVenture.mockResolvedValue(true);
}

const asRole = (role, cid = "coach-1") => {
  mockVentureAuth.requireVentureAccess.mockResolvedValue({ session: { cid, name: "Coach One", role } });
};

beforeEach(() => {
  resetFixtures();
});

// ─── Pure helpers ─────────────────────────────────────────────────────────

describe("ventureScope helpers — scope matching rules", () => {
  test("venture_wide passes any task", () => {
    expect(isTaskInScope([{ scope_type: "venture_wide", responsibility_code: "coach" }], { id: T1, milestone_id: M1 })).toBe(true);
  });

  test("milestone scope matches stringified milestone_id", () => {
    const scopes = [{ scope_type: "milestone", scope_ref_id: M1, responsibility_code: "coach" }];
    expect(isTaskInScope(scopes, { id: T1, milestone_id: M1 })).toBe(true);
    expect(isTaskInScope(scopes, { id: T2, milestone_id: M2 })).toBe(false);
    expect(isTaskInScope(scopes, { id: T1, milestone_id: M2 })).toBe(false);
  });

  test("task scope is the only pass for a task without milestone/journey linkage", () => {
    const taskScope = [{ scope_type: "task", scope_ref_id: String(T1), responsibility_code: "coach" }];
    expect(isTaskInScope(taskScope, { id: T1, milestone_id: null })).toBe(true);
    expect(isTaskInScope(taskScope, { id: T2, milestone_id: null })).toBe(false);
    expect(isTaskInScope([{ scope_type: "milestone", scope_ref_id: M1 }], { id: T1, milestone_id: null })).toBe(false);
  });

  test("journey_stage scope matches the task context's stage", () => {
    const scopes = [{ scope_type: "journey_stage", scope_ref_id: STAGE_1, responsibility_code: "coach" }];
    expect(isTaskInScope(scopes, { id: T1, milestone_id: M1, journey_stage_id: STAGE_1 })).toBe(true);
    expect(isTaskInScope(scopes, { id: T2, milestone_id: M2, journey_stage_id: STAGE_2 })).toBe(false);
  });

  test("empty/null scopes and unknown scope types never match", () => {
    expect(isTaskInScope([], { id: T1, milestone_id: M1 })).toBe(false);
    expect(isTaskInScope(null, { id: T1, milestone_id: M1 })).toBe(false);
    expect(isTaskInScope([{ scope_type: "workstream", scope_ref_id: "w1" }], { id: T1, milestone_id: M1 })).toBe(false);
  });

  test("lead_manager assignment implies Venture-wide reach even under a typed scope", () => {
    expect(hasVentureWideReach([{ scope_type: "milestone", scope_ref_id: M1, responsibility_code: "lead_manager" }])).toBe(true);
    expect(hasVentureWideReach([{ scope_type: "venture_wide", responsibility_code: "facilitator" }])).toBe(true);
    expect(hasVentureWideReach([{ scope_type: "milestone", scope_ref_id: M1, responsibility_code: "coach" }])).toBe(false);
  });

  test("getAssignmentScopes normalizes NULL/venture_wide rows and [] when none", async () => {
    mockDb.flags.assignments = [{ scope_type: null, scope_ref_type: null, scope_ref_id: null, responsibility_code: "coach" }];
    const scopes = await getAssignmentScopes(mockDb, { code: "VNT-TEST", cid: "coach-1" });
    expect(scopes).toEqual([{ scope_type: "venture_wide", scope_ref_type: null, scope_ref_id: null, responsibility_code: "coach" }]);

    mockDb.flags.assignments = [];
    const none = await getAssignmentScopes(mockDb, { code: "VNT-TEST", cid: "coach-1" });
    expect(none).toEqual([]);
  });
});

// ─── Review decision route ────────────────────────────────────────────────

describe("POST submissions {action:'review'} — assignment-scope gate", () => {
  test("global role (super_admin) passes review without scope rows", async () => {
    asRole("super_admin", "sa-1");
    const res = await reviewPOST(reviewRequest(T1, REVIEW_BODY), { params: { id: "VNT-TEST", taskId: String(T1) } });
    expect(res.status).toBe(200);
    expect(executed.some((q) => q.sql.includes("FROM venture_staff_assignments"))).toBe(false);
    expect(executed.some((q) => q.sql.includes("UPDATE venture_task_submissions"))).toBe(true);
  });

  test("venture_wide assignment passes review anywhere", async () => {
    mockDb.flags.assignments = [{ scope_type: "venture_wide", scope_ref_type: null, scope_ref_id: null, responsibility_code: "facilitator" }];
    const res = await reviewPOST(reviewRequest(T2, REVIEW_BODY), { params: { id: "VNT-TEST", taskId: String(T2) } });
    expect(res.status).toBe(200);
    expect(executed.some((q) => q.sql.includes("UPDATE venture_task_submissions"))).toBe(true);
  });

  test("milestone-scoped reviewer may review a task in that milestone", async () => {
    mockDb.flags.assignments = [{ scope_type: "milestone", scope_ref_type: "milestone", scope_ref_id: M1, responsibility_code: "coach" }];
    const res = await reviewPOST(reviewRequest(T1, REVIEW_BODY), { params: { id: "VNT-TEST", taskId: String(T1) } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(executed.some((q) => q.sql.includes("UPDATE venture_task_submissions"))).toBe(true);
  });

  test("milestone-scoped reviewer is 403 on a task in another milestone (and writes nothing)", async () => {
    mockDb.flags.assignments = [{ scope_type: "milestone", scope_ref_type: "milestone", scope_ref_id: M1, responsibility_code: "coach" }];
    const res = await reviewPOST(reviewRequest(T2, REVIEW_BODY), { params: { id: "VNT-TEST", taskId: String(T2) } });
    expect(res.status).toBe(403);
    const data = await readJson(res);
    expect(data.error).toBe("This review is outside your assigned scope.");
    expect(executed.some((q) => q.sql.includes("UPDATE venture_task_submissions"))).toBe(false);
  });

  test("journey_stage-scoped reviewer is confined to that stage", async () => {
    mockDb.flags.assignments = [{ scope_type: "journey_stage", scope_ref_type: "journey_stage", scope_ref_id: STAGE_1, responsibility_code: "coach" }];
    const inStage = await reviewPOST(reviewRequest(T1, REVIEW_BODY), { params: { id: "VNT-TEST", taskId: String(T1) } });
    expect(inStage.status).toBe(200);
    const outStage = await reviewPOST(reviewRequest(T2, REVIEW_BODY), { params: { id: "VNT-TEST", taskId: String(T2) } });
    expect(outStage.status).toBe(403);
  });

  test("lead_manager assignment may review anywhere in the Venture (typed scope)", async () => {
    mockDb.flags.assignments = [{ scope_type: "milestone", scope_ref_type: "milestone", scope_ref_id: M1, responsibility_code: "lead_manager" }];
    const res = await reviewPOST(reviewRequest(T2, REVIEW_BODY), { params: { id: "VNT-TEST", taskId: String(T2) } });
    expect(res.status).toBe(200);
  });

  test("founder / non-staff role still 403 (existing reviewer-role gate)", async () => {
    asRole("participant", "founder-1");
    const res = await reviewPOST(reviewRequest(T1, REVIEW_BODY), { params: { id: "VNT-TEST", taskId: String(T1) } });
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe("Only Future Studio staff can review submissions.");
    expect(executed.some((q) => q.sql.includes("UPDATE venture_task_submissions"))).toBe(false);
  });

  test("actor WITHOUT any assignment rows keeps the legacy allow behavior", async () => {
    mockDb.flags.assignments = [];
    const res = await reviewPOST(reviewRequest(T1, REVIEW_BODY), { params: { id: "VNT-TEST", taskId: String(T1) } });
    expect(res.status).toBe(200);
    expect(executed.some((q) => q.sql.includes("UPDATE venture_task_submissions"))).toBe(true);
  });

  test("scope-resolution error fails closed (403, no over-grant)", async () => {
    mockDb.flags.assignmentsThrow = true;
    const res = await reviewPOST(reviewRequest(T1, REVIEW_BODY), { params: { id: "VNT-TEST", taskId: String(T1) } });
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe("This review is outside your assigned scope.");
    expect(executed.some((q) => q.sql.includes("UPDATE venture_task_submissions"))).toBe(false);
  });

  test("unknown task returns 404 gracefully before any scope check", async () => {
    mockDb.flags.taskRowById = {};
    asRole("super_admin", "sa-1");
    const res = await reviewPOST(reviewRequest(999, REVIEW_BODY), { params: { id: "VNT-TEST", taskId: "999" } });
    expect(res.status).toBe(404);
  });
});

// ─── Review queue route ───────────────────────────────────────────────────

describe("GET submissions/review-queue — assignment-scoped attention list", () => {
  test("global role sees the full queue", async () => {
    asRole("super_admin", "sa-1");
    const res = await queueGET(new Request("http://localhost/api/ventures/VNT-TEST/submissions/review-queue"), { params: { id: "VNT-TEST" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.items.length).toBe(2);
    expect(executed.some((q) => q.sql.includes("FROM venture_staff_assignments"))).toBe(false);
    expect(executed.some((q) => q.sql.includes("SELECT t.id, t.milestone_id, m.journey_stage_id"))).toBe(false);
  });

  test("venture_wide assignment sees the full queue", async () => {
    mockDb.flags.assignments = [{ scope_type: "venture_wide", scope_ref_type: null, scope_ref_id: null, responsibility_code: "facilitator" }];
    const res = await queueGET(new Request("http://localhost/api/ventures/VNT-TEST/submissions/review-queue"), { params: { id: "VNT-TEST" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.items.map((i) => i.task_id)).toEqual([T1, T2]);
    expect(executed.some((q) => q.sql.includes("SELECT t.id, t.milestone_id, m.journey_stage_id"))).toBe(false);
  });

  test("milestone-scoped reviewer sees only that milestone's pending tasks", async () => {
    mockDb.flags.assignments = [{ scope_type: "milestone", scope_ref_type: "milestone", scope_ref_id: M1, responsibility_code: "coach" }];
    const res = await queueGET(new Request("http://localhost/api/ventures/VNT-TEST/submissions/review-queue"), { params: { id: "VNT-TEST" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.items.length).toBe(1);
    expect(data.items[0].task_id).toBe(T1);
    expect(data.items[0].task_title).toBe("Pitch deck");
  });

  test("journey_stage-scoped reviewer sees only tasks in that stage", async () => {
    mockDb.flags.assignments = [{ scope_type: "journey_stage", scope_ref_type: "journey_stage", scope_ref_id: STAGE_2, responsibility_code: "coach" }];
    const res = await queueGET(new Request("http://localhost/api/ventures/VNT-TEST/submissions/review-queue"), { params: { id: "VNT-TEST" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.items.map((i) => i.task_id)).toEqual([T2]);
  });

  test("lead_manager assignment sees the whole queue (typed scope still Venture-wide)", async () => {
    mockDb.flags.assignments = [{ scope_type: "milestone", scope_ref_type: "milestone", scope_ref_id: M1, responsibility_code: "lead_manager" }];
    const res = await queueGET(new Request("http://localhost/api/ventures/VNT-TEST/submissions/review-queue"), { params: { id: "VNT-TEST" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.items.length).toBe(2);
    expect(executed.some((q) => q.sql.includes("SELECT t.id, t.milestone_id, m.journey_stage_id"))).toBe(false);
  });

  test("founder / non-staff still 403 (staff-actor gate preserved)", async () => {
    mockVentureAuth.isStaffActorForVenture.mockResolvedValue(false);
    const res = await queueGET(new Request("http://localhost/api/ventures/VNT-TEST/submissions/review-queue"), { params: { id: "VNT-TEST" } });
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe("This operation requires staff access to the Venture.");
  });

  test("actor WITHOUT assignment rows keeps the full queue (legacy)", async () => {
    mockDb.flags.assignments = [];
    const res = await queueGET(new Request("http://localhost/api/ventures/VNT-TEST/submissions/review-queue"), { params: { id: "VNT-TEST" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.items.length).toBe(2);
  });

  test("scope-resolution error on the read keeps the current full-queue behavior", async () => {
    mockDb.flags.assignmentsThrow = true;
    const res = await queueGET(new Request("http://localhost/api/ventures/VNT-TEST/submissions/review-queue"), { params: { id: "VNT-TEST" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.items.length).toBe(2);
  });

  test("scoped reviewer with nothing pending in scope gets an empty list", async () => {
    mockDb.flags.queueRows = [];
    mockDb.flags.assignments = [{ scope_type: "milestone", scope_ref_type: "milestone", scope_ref_id: M1, responsibility_code: "coach" }];
    const res = await queueGET(new Request("http://localhost/api/ventures/VNT-TEST/submissions/review-queue"), { params: { id: "VNT-TEST" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.items).toEqual([]);
  });

  test("unknown Venture returns 404 gracefully", async () => {
    // No venture row for an unknown code → dbId lookup yields nothing.
    mockDb.flags.tasksByVenture = [];
    mockDb.flags.queueRows = [];
    // Force the venture lookup to return empty by swapping default below.
    mockDb.execute.mockImplementationOnce(async ({ sql }) =>
      sql.includes("SELECT id FROM ventures WHERE venture_id = ?") ? { rows: [] } : { rows: [] },
    );
    const res = await queueGET(new Request("http://localhost/api/ventures/VNT-NOPE/submissions/review-queue"), { params: { id: "VNT-NOPE" } });
    expect(res.status).toBe(404);
  });
});
