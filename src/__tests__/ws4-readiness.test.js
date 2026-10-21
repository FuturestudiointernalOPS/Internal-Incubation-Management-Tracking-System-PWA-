/**
 * WS4 — progress indicators and their calculations.
 *
 * The rules under test are the ones WS4 changed, and each one is asserted at the
 * layer that actually owns it:
 *
 *   • Investment Readiness is the Data Room's completeness figure — one engine,
 *     one answer, whether asked for one Venture or a whole page.
 *   • Nothing required ⇒ INDETERMINATE (null), never 0% and never 100%.
 *   • A legacy document with no Data Room category neither raises nor lowers it.
 *   • `mvp` scores as `early_traction`, `scale` as `scaling` (lib/ventureStage).
 *   • Archived work is excluded from every progress read.
 *   • Deliverables are counted once per task — the LATEST submission version.
 *   • "Delayed" means past its date and not completed/cancelled.
 */

const executed = [];

const UUID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UUID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const REQUIREMENTS = [
  { venture_id: UUID_A, category: "company_overview", level: "required" },
  { venture_id: UUID_A, category: "legal_corporate", level: "required" },
  { venture_id: UUID_A, category: "financial", level: "required" },
  { venture_id: UUID_A, category: "pitch_materials", level: "required" },
  { venture_id: UUID_A, category: "team", level: "recommended" },
  // Venture B stores requirements, but none of them is `required`.
  { venture_id: UUID_B, category: "company_overview", level: "recommended" },
  { venture_id: UUID_B, category: "financial", level: "recommended" },
];

const DOCUMENTS = [
  { venture_id: UUID_A, category: "company_overview", status: "verified" },
  { venture_id: UUID_A, category: "legal_corporate", status: "verified" },
  { venture_id: UUID_A, category: "financial", status: "uploaded" },
  // Legacy Data Bank row: verified, but not a Data Room category.
  { venture_id: UUID_A, category: "business_plan", status: "verified" },
  { venture_id: UUID_A, category: "team", status: "verified" },
];

function respond(sql) {
  if (sql.startsWith("SELECT venture_id AS code, id::text AS id FROM ventures")) {
    return {
      rows: [
        { code: "VNT-A", id: UUID_A },
        { code: "VNT-B", id: UUID_B },
      ],
    };
  }
  if (sql.startsWith("SELECT id::text AS id, business_stage FROM ventures")) {
    return {
      rows: [
        { id: UUID_A, business_stage: "mvp" },
        { id: UUID_B, business_stage: "idea" },
      ],
    };
  }
  if (sql.includes("FROM venture_data_room_requirements")) return { rows: REQUIREMENTS };
  if (sql.includes("FROM venture_documents d")) return { rows: DOCUMENTS };

  // Roadmap readiness reads.
  if (sql.startsWith("SELECT status FROM venture_journey_stages")) {
    return { rows: [{ status: "completed" }, { status: "active" }] };
  }
  if (sql.startsWith("SELECT status FROM venture_milestones")) {
    return { rows: [{ status: "completed" }, { status: "in_progress" }] };
  }
  if (sql.startsWith("SELECT status FROM venture_tasks")) {
    return { rows: [{ status: "done" }, { status: "backlog" }] };
  }
  if (sql.includes("SELECT s.status, s.review_decision")) {
    // ONE row: the model returns only the latest version per task. The earlier
    // `changes_requested` version is not part of the denominator.
    return { rows: [{ status: "submitted", review_decision: "approved" }] };
  }
  return { rows: [] };
}

const mockDb = {
  execute: jest.fn(),
};

const record = async ({ sql, args = [] }) => {
  executed.push({ sql, args });
  return respond(sql);
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

const { listDataRoomReadiness, getDataRoomReadiness } = require("@/services/ventures/dataRoom/readiness");
const { computeRoadmapReadiness } = require("@/services/ventures/readiness");
const { normalizeBusinessStage } = require("@/lib/ventureStage");
const { dataRoomCategory } = require("@/lib/dataRoom");
const analytics = require("@/models/ventureAnalyticsStore");
const reports = require("@/models/ventureWorkspace/journeyAndReports/journeyReports");

const sqlOf = (needle) => executed.filter((call) => call.sql.includes(needle)).map((call) => call.sql);

beforeEach(() => {
  executed.length = 0;
  // Restore the default behaviour: the empty-roadmap test replaces it once.
  mockDb.execute.mockReset();
  mockDb.execute.mockImplementation(record);
});

describe("Investment Readiness is the Data Room's completeness figure", () => {
  test("the batch reader and the single-Venture reader agree", async () => {
    const batch = await listDataRoomReadiness(["VNT-A", "VNT-B"]);
    const single = await getDataRoomReadiness("VNT-A");

    const fromBatch = batch.find((row) => row.venture_id === UUID_A);
    expect(fromBatch).toEqual(single);
  });

  test("results follow the input order and echo the internal id", async () => {
    const rows = await listDataRoomReadiness(["VNT-B", "VNT-A"]);
    expect(rows.map((row) => row.venture_id)).toEqual([UUID_B, UUID_A]);
  });

  test("required categories only: 2 verified of 4 required is 50%", async () => {
    const row = await getDataRoomReadiness("VNT-A");
    expect(row.readiness_percent).toBe(50);
    expect(row.total_required).toBe(4);
    expect(row.verified_count).toBe(2);
    expect(row.rejected_count).toBe(0);
    expect(row.pending_count).toBe(1);
    expect(row.missing_count).toBe(1);
    expect(row.is_ready).toBe(false);
  });

  test("a Venture with nothing marked required is INDETERMINATE, not 0% or 100%", async () => {
    const row = await getDataRoomReadiness("VNT-B");
    expect(row.readiness_percent).toBeNull();
    expect(row.total_required).toBe(0);
    expect(row.is_ready).toBe(false);
  });

  test("a legacy document with no Data Room category does not move the number", async () => {
    // `business_plan` is stored and verified but is not a Data Room category,
    // so it is neither a requirement nor a verified requirement.
    expect(dataRoomCategory("business_plan")).toBeNull();

    const row = await getDataRoomReadiness("VNT-A");
    expect(row.total_required).toBe(4); // not 5
    expect(row.verified_count).toBe(2); // not 3
  });

  test("no references means no query at all", async () => {
    await expect(listDataRoomReadiness([])).resolves.toEqual([]);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });
});

describe("Roadmap progress", () => {
  test("counts each task's LATEST submission, so re-submitting does not inflate the denominator", async () => {
    const readiness = await computeRoadmapReadiness({ dbId: UUID_A, code: "VNT-A" });

    expect(readiness.counts.deliverables).toEqual({ reviewed: 1, approved: 1, outstanding: 0 });
    expect(readiness.components.deliverables).toBe(100);

    const submissionSql = sqlOf("FROM venture_task_submissions")[0];
    expect(submissionSql).toContain("MAX(s2.version)");
  });

  test("archived journeys, milestones and tasks are excluded from progress", async () => {
    await computeRoadmapReadiness({ dbId: UUID_A, code: "VNT-A" });

    const stageSql = sqlOf("FROM venture_journey_stages")[0];
    const milestoneSql = sqlOf("FROM venture_milestones")[0];
    const taskSql = sqlOf("FROM venture_tasks")[0];

    expect(stageSql).toContain("COALESCE(is_archived, FALSE) = FALSE");
    expect(milestoneSql).toContain("COALESCE(is_archived, FALSE) = FALSE");
    expect(taskSql).toContain("COALESCE(is_archived, FALSE) = FALSE");
  });

  test("an empty roadmap is 0% overall, never null or NaN", async () => {
    mockDb.execute.mockImplementation(async () => ({ rows: [] }));
    const readiness = await computeRoadmapReadiness({ dbId: UUID_A, code: "VNT-A" });
    expect(readiness.overall_percent).toBe(0);
    expect(readiness.components.deliverables).toBeNull();
  });
});

describe("Business-stage aliases score identically", () => {
  test("mvp scores as early_traction and scale as scaling", () => {
    expect(normalizeBusinessStage("mvp")).toBe("early_traction");
    expect(normalizeBusinessStage("MVP")).toBe("early_traction");
    expect(normalizeBusinessStage("scale")).toBe("scaling");
    expect(normalizeBusinessStage("scaling")).toBe("scaling");
    expect(normalizeBusinessStage("early_traction")).toBe("early_traction");
  });

  test("unknown stages pass through and an empty value means idea", () => {
    expect(normalizeBusinessStage("growth")).toBe("growth");
    expect(normalizeBusinessStage("")).toBe("idea");
    expect(normalizeBusinessStage(null)).toBe("idea");
  });
});

describe("Analytics and report reads use the same rules as the rest of the app", () => {
  test("delayed means past its date and not completed or cancelled", async () => {
    await analytics.selectAnalyticsMilestoneCounts(UUID_A);
    const sql = sqlOf("FROM venture_milestones")[0];

    expect(sql).toContain("COALESCE(target_date, due_date) < NOW()");
    expect(sql).toContain("status NOT IN ('completed','cancelled')");
    // The never-written literal status is gone.
    expect(sql).not.toContain("status='delayed'");
  });

  test("task completion uses the shared terminal list and ignores archived tasks", async () => {
    await analytics.selectAnalyticsTaskCounts(UUID_A);
    const sql = sqlOf("FROM venture_tasks")[0];

    expect(sql).toContain("IN ('done','accepted','completed')");
    expect(sql).toContain("COALESCE(is_archived, FALSE) = FALSE");
  });

  test("the operating report skips archived milestones and tasks", async () => {
    await reports.listVentureMilestonesForReport(["VNT-A"]);
    await reports.listVentureTaskDeadlinesForReport(["VNT-A"]);

    expect(sqlOf("journey_stage_id IS NOT NULL")[0]).toContain("COALESCE(is_archived, FALSE) = FALSE");
    expect(sqlOf("SELECT status, due_date FROM venture_tasks")[0]).toContain("COALESCE(is_archived, FALSE) = FALSE");
  });
});
