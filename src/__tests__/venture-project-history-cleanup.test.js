/**
 * Venture project history — deleted records must not appear, and clearing the
 * history is an administrator act.
 *
 * THE DEFECT THIS LOCKS SHUT
 *
 * The project-management content has an archive flag (`is_archived`) on stages,
 * milestones and tasks, and every read is supposed to honour it. Three did not:
 *
 *   1. the JOURNEY spine read (`listJourneyMilestonesByStage`) returned archived
 *      milestones, so a soft-deleted milestone — and its deliverables, activities
 *      and counts, all derived from that list — kept rendering as live work;
 *   2. the PROJECTS read returned the deliverables OF an archived milestone as
 *      orphan rows, because `venture_deliverables` has no archive flag of its own
 *      and nothing else hid them;
 *   3. the VENTURE directory had no notion of a deleted Venture at all, so an
 *      archived Venture was still offered as a project to open.
 *
 * THE FEATURE THIS LOCKS SHUT
 *
 * Clearing the whole history is destructive and irreversible, so it is gated on
 * the canonical capability engine (`ventures.delete`, held only by the Super
 * Admin profile), refuses without an explicit confirmation, runs as ONE
 * transaction, and is recorded in the existing audit log. Its scope is data, and
 * that data is pinned here: the project tables only — never the Venture itself,
 * its people, permissions or financial records.
 */
const mockDb = {
  execute: jest.fn(async () => ({ rows: [], rowsAffected: 0 })),
  transaction: jest.fn(async (callback) =>
    callback(async (sql) => ({ rows: [], rowsAffected: sql.includes("venture_") ? 1 : 0 })),
  ),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn(async () => mockDb),
}));

let mockCapRefusal = null;
jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => mockCapRefusal),
  getAuthorizationContext: jest.fn(async () => ({ isSuperAdmin: true })),
}));

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => ({ cid: "SA-1", name: "Super", role: "super_admin" })),
}));

const mockLogAuditEvent = jest.fn(async () => ({ id: 1 }));
jest.mock("@/services/ventures/auditSecurity", () => ({
  logAuditEvent: (...args) => mockLogAuditEvent(...args),
}));

const { requireAuthorization } = require("@/models/authorization/index");
const { listJourneyMilestonesByStage } = require("@/models/ventureJourney/journeyStages");
const { selectWorkDeliverables } = require("@/models/workItems");
const { listVenturesWithCounts } = require("@/models/ventureWorkspace");
const {
  PROJECT_HISTORY_SCOPE,
  PROJECT_HISTORY_PROTECTED,
  isWithinPurgeScope,
  clearProjectHistory,
  previewProjectHistory,
} = require("@/services/ventures/projectHistory");

const lastSql = (callIndex = 0) => String(mockDb.execute.mock.calls[callIndex][0].sql);

beforeEach(() => {
  jest.clearAllMocks();
  mockCapRefusal = null;
  mockDb.execute.mockResolvedValue({ rows: [], rowsAffected: 0 });
});

describe("A. a deleted milestone no longer renders as live work", () => {
  test("the Journey spine read hides archived milestones by default", async () => {
    await listJourneyMilestonesByStage("db-1");
    expect(lastSql()).toMatch(/COALESCE\(is_archived, FALSE\) = FALSE/);
  });

  test("…and returns them only when a manager explicitly asks", async () => {
    await listJourneyMilestonesByStage("db-1", { includeArchived: true });
    expect(lastSql()).not.toMatch(/COALESCE\(is_archived, FALSE\) = FALSE/);
  });
});

describe("A. the deliverables of a deleted parent leave the Projects view with it", () => {
  test("a deliverable whose milestone is archived is excluded", async () => {
    await selectWorkDeliverables("db-1", "VNT-1");
    const sql = lastSql();
    expect(sql).toMatch(/FROM venture_milestones m[\s\S]*COALESCE\(m\.is_archived, FALSE\) = TRUE/);
  });

  test("…and so is one whose activity is archived", async () => {
    await selectWorkDeliverables("db-1", "VNT-1");
    const sql = lastSql();
    expect(sql).toMatch(/FROM venture_tasks t[\s\S]*COALESCE\(t\.is_archived, FALSE\) = TRUE/);
  });

  test("both exclusions are NOT EXISTS, so a deliverable with no parent survives", async () => {
    await selectWorkDeliverables("db-1", "VNT-1");
    const sql = lastSql();
    expect(sql.match(/NOT EXISTS/g)).toHaveLength(2);
  });
});

describe("A. a deleted Venture is not offered as a project", () => {
  test("the directory excludes archived Ventures by default", async () => {
    await listVenturesWithCounts({});
    const sql = lastSql();
    expect(sql).toMatch(/COALESCE\(v\.is_archived, FALSE\) = FALSE/);
    expect(sql).toMatch(/LOWER\(v\.status\)[\s\S]*<> 'archived'/);
  });

  test("…and can still be asked for by a history surface", async () => {
    await listVenturesWithCounts({ includeArchived: true });
    expect(lastSql()).not.toMatch(/is_archived/);
  });

  test("the scoping still applies — the archived filter is one condition among many", async () => {
    await listVenturesWithCounts({ effectiveContactId: "C-1" });
    const sql = lastSql();
    expect(sql).toMatch(/venture_members vm WHERE vm\.user_cid = \?/);
    expect(sql).toMatch(/is_archived/);
  });
});

describe("A. /api/ventures only includes deleted Ventures on request", () => {
  const { GET } = require("@/app/api/ventures/route");

  test("no parameter means no archived Ventures", async () => {
    await GET(new Request("http://localhost/api/ventures"));
    expect(lastSql()).toMatch(/is_archived/);
  });

  test("include_archived=1 asks the listing for them", async () => {
    await GET(new Request("http://localhost/api/ventures?include_archived=1"));
    expect(lastSql()).not.toMatch(/is_archived/);
  });
});

describe("B. the purge is scoped to project-management content, by data", () => {
  test("every scoped table is a venture project table", () => {
    for (const { table } of PROJECT_HISTORY_SCOPE) {
      expect(table).toMatch(/^venture_(journey_stages|milestones|tasks|deliverables|task_|milestone_|deliverable_|dependencies)/);
    }
  });

  test("the records that must SURVIVE are named, and are not in scope", () => {
    expect(PROJECT_HISTORY_PROTECTED.length).toBeGreaterThan(0);
    for (const safe of [
      "ventures",
      "venture_members",
      "venture_founders",
      "venture_staff_assignments",
      "venture_permission_matrix",
      "venture_notes",
      "venture_operating_plans",
      "venture_documents",
      "v2_projects",
    ]) {
      expect(isWithinPurgeScope(safe)).toBe(false);
    }
  });

  test("the preview reports the live size of each scoped table", async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [
        { t: "venture_milestones", rows: 35 },
        { t: "venture_tasks", rows: 48 },
      ],
    });
    const preview = await previewProjectHistory();

    expect(preview.total).toBe(83);
    expect(preview.counts.find((entry) => entry.table === "venture_tasks").rows).toBe(48);
    // Every scoped table is reported, even when it holds nothing.
    expect(preview.counts).toHaveLength(PROJECT_HISTORY_SCOPE.length);
  });
});

describe("B. clearing the history is atomic, audited, and reversible on failure", () => {
  test("the whole purge runs inside ONE transaction", async () => {
    await clearProjectHistory({ actor: { cid: "SA-1", name: "Super", role: "super_admin" } });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  test("every scoped table is cleared exactly once", async () => {
    const seen = [];
    mockDb.transaction.mockImplementationOnce(async (callback) =>
      callback(async (sql) => {
        seen.push(String(sql));
        return { rows: [], rowsAffected: 1 };
      }),
    );

    await clearProjectHistory({ actor: {} });

    expect(seen).toHaveLength(PROJECT_HISTORY_SCOPE.length);
    for (const { table } of PROJECT_HISTORY_SCOPE) {
      expect(seen.filter((sql) => sql === `DELETE FROM ${table}`)).toHaveLength(1);
    }
  });

  test("parents are cleared after the records that hang off them", async () => {
    const order = [];
    mockDb.transaction.mockImplementationOnce(async (callback) =>
      callback(async (sql) => {
        order.push(String(sql));
        return { rows: [], rowsAffected: 0 };
      }),
    );

    await clearProjectHistory({ actor: {} });

    const at = (table) => order.indexOf(`DELETE FROM ${table}`);
    expect(at("venture_task_submissions")).toBeLessThan(at("venture_tasks"));
    expect(at("venture_task_reviews")).toBeLessThan(at("venture_tasks"));
    expect(at("venture_deliverable_reviews")).toBeLessThan(at("venture_deliverables"));
    expect(at("venture_deliverables")).toBeLessThan(at("venture_milestones"));
    expect(at("venture_tasks")).toBeLessThan(at("venture_milestones"));
    expect(at("venture_milestones")).toBeLessThan(at("venture_journey_stages"));
  });

  test("nothing outside the scope is ever deleted", async () => {
    const seen = [];
    mockDb.transaction.mockImplementationOnce(async (callback) =>
      callback(async (sql) => {
        seen.push(String(sql));
        return { rows: [], rowsAffected: 0 };
      }),
    );

    await clearProjectHistory({ actor: {} });

    const forbidden = ["ventures", "venture_members", "venture_founders", "venture_staff_assignments",
      "venture_permission_matrix", "venture_notes", "v2_projects", "contacts"];
    for (const sql of seen) {
      for (const table of forbidden) {
        // `venture_members` must not match `venture_milestones`, hence the boundary.
        expect(new RegExp(`\\b${table}\\b`).test(sql)).toBe(false);
      }
    }
  });

  test("the act is recorded in the existing audit log, with the outcome and the count", async () => {
    await clearProjectHistory({ actor: { cid: "SA-1", name: "Super", role: "super_admin" } });

    const entry = mockLogAuditEvent.mock.calls[0][0];
    expect(entry.eventType).toBe("venture_project_history_purged");
    expect(entry.actorCid).toBe("SA-1");
    expect(entry.severity).toBe("critical");
    expect(entry.metadata.outcome).toBe("succeeded");
  });

  test("a failed purge reports failure, removes nothing, and is audited as failed", async () => {
    mockDb.transaction.mockRejectedValueOnce(new Error("deadlock detected"));

    const result = await clearProjectHistory({ actor: { cid: "SA-1" } });

    expect(result.ok).toBe(false);
    expect(result.removed).toBe(0);
    const entry = mockLogAuditEvent.mock.calls[0][0];
    expect(entry.eventType).toBe("venture_project_history_purge_failed");
    expect(entry.metadata.outcome).toBe("failed");
    // The database detail stays in the log, never in an HTTP answer.
    expect(result.error).not.toMatch(/deadlock/);
  });
});

describe("B. the endpoint answers only an authorized administrator", () => {
  function loadRoutes() {
    jest.resetModules();
    jest.doMock("@/lib/db", () => ({ __esModule: true, default: mockDb, initDb: jest.fn(async () => mockDb) }));
    jest.doMock("@/models/authorization/index", () => ({
      requireAuthorization: jest.fn(async () => mockCapRefusal),
    }));
    jest.doMock("@/server/auth/session", () => ({
      getSession: jest.fn(async () => ({ cid: "SA-1", name: "Super", role: "super_admin" })),
    }));
    jest.doMock("@/services/ventures/auditSecurity", () => ({ logAuditEvent: mockLogAuditEvent }));
    return require("@/app/api/admin/ventures/project-history/route");
  }

  test("both verbs ask the engine for ventures.delete", async () => {
    const routes = loadRoutes();
    const { requireAuthorization: cap } = require("@/models/authorization/index");

    await routes.GET();
    expect(cap).toHaveBeenCalledWith("ventures", "delete");

    cap.mockClear();
    await routes.POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ confirm: true }) }));
    expect(cap).toHaveBeenCalledWith("ventures", "delete");
  });

  test("a refusal from the engine is returned untouched, and nothing is deleted", async () => {
    mockCapRefusal = { status: 403, json: async () => ({ error: "errors.insufficientPermissions" }) };
    const routes = loadRoutes();

    const res = await routes.POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ confirm: true }) }));

    expect(res.status).toBe(403);
    expect(mockDb.transaction).not.toHaveBeenCalled();
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  test("without an explicit confirmation the purge does not run", async () => {
    const routes = loadRoutes();

    const res = await routes.POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({}) }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("CONFIRMATION_REQUIRED");
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  test("with it, the purge runs and the answer carries what was removed", async () => {
    const routes = loadRoutes();

    const res = await routes.POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ confirm: true }) }));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.removed).toBe(PROJECT_HISTORY_SCOPE.length);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});
