/**
 * Dependency edges — canonical ids, transitive cycle refusal, and the
 * release/booking gates that read them.
 *
 * An edge (source -> target) means the source BLOCKS the target
 * (finish_to_start). Milestones are UUIDs, tasks are integers: the table
 * stores entity ids as text so one edge shape holds both.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const mockState = { edges: [], blockers: [], milestone: null, stage: null, inserts: [] };

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql, args = [] }) => {
      if (sql.includes("SELECT source_type, source_id, target_type, target_id")) {
        return { rows: mockState.edges };
      }
      if (sql.includes("INSERT INTO venture_dependencies")) {
        mockState.inserts.push(args);
        return { rows: [] };
      }
      if (sql.includes("blocker.title")) {
        return { rows: mockState.blockers };
      }
      if (sql.includes("FROM venture_journey_stages")) {
        return { rows: mockState.stage ? [mockState.stage] : [] };
      }
      if (sql.includes("FROM venture_milestones")) {
        return { rows: mockState.milestone ? [mockState.milestone] : [] };
      }
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

const dbMock = require("@/lib/db").default;
const { addDependency } = require("@/lib/ventures");
const { getUnmetMilestoneDependencies, assertBookableMilestone } = require("@/lib/ventureMilestoneEngine");

beforeEach(() => {
  mockState.edges = [];
  mockState.blockers = [];
  mockState.milestone = null;
  mockState.stage = null;
  mockState.inserts = [];
});

describe("addDependency — canonical ids and transitive cycles", () => {
  test("stores the venture UUID and milestone ids as text", async () => {
    await addDependency({ ventureId: "v-1", sourceType: "milestone", sourceId: A, targetType: "milestone", targetId: B });
    expect(mockState.inserts).toHaveLength(1);
    expect(mockState.inserts[0]).toEqual(["v-1", "milestone", A, "milestone", B]);
  });

  test("stores integer task ids as text — one edge shape holds both kinds", async () => {
    await addDependency({ ventureId: "v-1", sourceType: "task", sourceId: 12, targetType: "task", targetId: 34 });
    expect(mockState.inserts[0]).toEqual(["v-1", "task", "12", "task", "34"]);
  });

  test("refuses a direct two-edge cycle", async () => {
    mockState.edges = [{ source_type: "milestone", source_id: B, target_type: "milestone", target_id: A }];
    await expect(
      addDependency({ ventureId: "v-1", sourceType: "milestone", sourceId: A, targetType: "milestone", targetId: B }),
    ).rejects.toThrow(/circular/i);
    expect(mockState.inserts).toHaveLength(0);
  });

  test("refuses a TRANSITIVE cycle (A blocks B, B blocks C, then C blocks A)", async () => {
    mockState.edges = [
      { source_type: "milestone", source_id: A, target_type: "milestone", target_id: B },
      { source_type: "milestone", source_id: B, target_type: "milestone", target_id: C },
    ];
    await expect(
      addDependency({ ventureId: "v-1", sourceType: "milestone", sourceId: C, targetType: "milestone", targetId: A }),
    ).rejects.toThrow(/circular/i);
    expect(mockState.inserts).toHaveLength(0);
  });

  test("allows an edge that closes nothing", async () => {
    mockState.edges = [
      { source_type: "milestone", source_id: A, target_type: "milestone", target_id: B },
      { source_type: "milestone", source_id: B, target_type: "milestone", target_id: C },
    ];
    await addDependency({ ventureId: "v-1", sourceType: "milestone", sourceId: A, targetType: "milestone", targetId: C });
    expect(mockState.inserts).toHaveLength(1);
  });

  test("refuses a self-edge", async () => {
    await expect(
      addDependency({ ventureId: "v-1", sourceType: "milestone", sourceId: A, targetType: "milestone", targetId: A }),
    ).rejects.toThrow(/circular/i);
  });
});

describe("getUnmetMilestoneDependencies", () => {
  test("returns the unfinished blockers", async () => {
    mockState.blockers = [{ id: A, title: "Pitch Deck", status: "in_progress" }];
    const blockers = await getUnmetMilestoneDependencies(dbMock, { dbId: "v-1", milestoneId: B });
    expect(blockers).toHaveLength(1);
    expect(blockers[0].title).toBe("Pitch Deck");
  });

  test("no rows means nothing holds the milestone back", async () => {
    const blockers = await getUnmetMilestoneDependencies(dbMock, { dbId: "v-1", milestoneId: B });
    expect(blockers).toEqual([]);
  });
});

describe("booking gate — an unmet dependency refuses BY NAME", () => {
  test("refuses with the blocking milestone named", async () => {
    mockState.milestone = { id: B, title: "Business Plan", status: "not_started", journey_stage_id: "s1" };
    mockState.stage = { id: "s1", name: "GTM", status: "active" };
    mockState.blockers = [{ id: A, title: "Pitch Deck", status: "in_progress" }];
    const out = await assertBookableMilestone(dbMock, { dbId: 7, milestoneId: B });
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("Pitch Deck");
    expect(out.reason).toMatch(/not completed/i);
  });

  test("no blockers on an active Journey — bookable", async () => {
    mockState.milestone = { id: B, title: "Business Plan", status: "not_started", journey_stage_id: "s1" };
    mockState.stage = { id: "s1", name: "GTM", status: "active" };
    const out = await assertBookableMilestone(dbMock, { dbId: 7, milestoneId: B });
    expect(out.ok).toBe(true);
  });
});

describe("engine contract — every release sweep carries the dependency guard", () => {
  test("releaseMilestonesForStage and activateDueStages never free blocked work", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/lib/ventureMilestoneEngine.js"), "utf8");
    // Four guarded release statements: rich + plain in each of the two sweeps.
    const releaseStatements = source.split("UPDATE venture_milestones SET status = 'not_started'");
    expect(releaseStatements.length).toBe(5);
    expect(source).toContain("NOT EXISTS");
    expect(source).toContain("FROM venture_dependencies d");
    expect(source).toContain("blocker.status <> 'completed'");
  });
});
