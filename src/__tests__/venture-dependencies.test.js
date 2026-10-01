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
    const blockers = await getUnmetMilestoneDependencies({ dbId: "v-1", milestoneId: B });
    expect(blockers).toHaveLength(1);
    expect(blockers[0].title).toBe("Pitch Deck");
  });

  test("no rows means nothing holds the milestone back", async () => {
    const blockers = await getUnmetMilestoneDependencies({ dbId: "v-1", milestoneId: B });
    expect(blockers).toEqual([]);
  });
});

describe("booking gate — an unmet dependency refuses BY NAME", () => {
  test("refuses with the blocking milestone named", async () => {
    mockState.milestone = { id: B, title: "Business Plan", status: "not_started", journey_stage_id: "s1" };
    mockState.stage = { id: "s1", name: "GTM", status: "active" };
    mockState.blockers = [{ id: A, title: "Pitch Deck", status: "in_progress" }];
    const out = await assertBookableMilestone({ dbId: 7, milestoneId: B });
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("Pitch Deck");
    expect(out.reason).toMatch(/not completed/i);
  });

  test("no blockers on an active Journey — bookable", async () => {
    mockState.milestone = { id: B, title: "Business Plan", status: "not_started", journey_stage_id: "s1" };
    mockState.stage = { id: "s1", name: "GTM", status: "active" };
    const out = await assertBookableMilestone({ dbId: 7, milestoneId: B });
    expect(out.ok).toBe(true);
  });
});

describe("engine contract — every release sweep carries the dependency guard", () => {
  test("the ONE guard is defined, and both release sweeps decide through it", () => {
    // The guard and its two sweeps moved to the engine's store (slice 28); the
    // assertion is unchanged, only its home.
    const source = fs.readFileSync(path.join(ROOT, "src/models/ventureMilestoneEngineStore.js"), "utf8");
    // The guard itself: an edge (source -> target) means the source blocks the
    // target, so a milestone is free only when every blocker is completed.
    expect(source).toContain("FROM venture_dependencies d");
    expect(source).toContain("blocker.status <> 'completed'");
    // Both sweeps (stage-scoped + Venture-wide) pick `not_started` vs `blocked`
    // through that ONE guard — never a bare release.
    const sweeps = source.split("SET status = CASE WHEN");
    expect(sweeps.length).toBe(3);
    for (const sweep of sweeps.slice(1)) {
      expect(sweep).toContain("${NO_UNMET_BLOCKER}");
      expect(sweep).toContain("MILESTONE_BLOCKED");
    }
  });
});
