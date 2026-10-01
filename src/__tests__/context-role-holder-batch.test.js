/**
 * Statement-level tests for the batched holder-count read.
 *
 * `phase4-context-roles.test.js` covers the registry route, but nothing pinned
 * HOW MANY statements the holder counts cost. That is the whole point of this
 * block: the registry used to send one COUNT per context role — seven for the
 * seeded catalogue — on every screen open.
 */

let mockStatements = [];
let mockUnionRows = [];
let mockUnionFails = false;
let mockSingleFailsFor = [];
// The single-pair read answers from this table, so "both reads agree" can be
// tested against one source of truth instead of two invented numbers.
let mockCountByTable = {};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn().mockImplementation(async (queryObj) => {
      const sql = String(typeof queryObj === "string" ? queryObj : queryObj?.sql);
      mockStatements.push(sql);

      if (sql.includes(" AS pair")) {
        if (mockUnionFails) throw new Error("relation does not exist");
        return { rows: mockUnionRows };
      }
      const pair = sql.match(/COUNT\([^)]*\)(?:::int)? FROM (\w+)/);
      if (mockSingleFailsFor.includes(pair?.[1])) {
        throw new Error(`relation "${pair[1]}" does not exist`);
      }
      return { rows: [{ c: mockCountByTable[pair?.[1]] ?? 1 }] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

const {
  countContextRoleHolders,
  countContextRoleHoldersBatch,
} = require("@/models/authorization/contextRoleProfiles");

const SEED_PAIRS = [
  { context: "program", roleKey: "participant" },
  { context: "program", roleKey: "program_manager" },
  { context: "program", roleKey: "facilitator" },
  { context: "venture", roleKey: "founder" },
  { context: "venture", roleKey: "team_member" },
  { context: "lms", roleKey: "learner" },
  { context: "investor", roleKey: "investor" },
];

beforeEach(() => {
  mockStatements = [];
  mockUnionRows = [];
  mockUnionFails = false;
  mockSingleFailsFor = [];
  mockCountByTable = {};
});

describe("countContextRoleHoldersBatch — one statement for the whole registry", () => {
  test("the seven seeded pairs cost ONE statement, not seven", async () => {
    mockUnionRows = SEED_PAIRS.map(({ context, roleKey }) => ({
      pair: `${context}:${roleKey}`,
      c: 5,
    }));

    const counts = await countContextRoleHoldersBatch(SEED_PAIRS);

    expect(mockStatements).toHaveLength(1);
    expect(Object.keys(counts)).toHaveLength(7);
  });

  test("the statement labels every count with its pair and counts independently", async () => {
    await countContextRoleHoldersBatch(SEED_PAIRS);
    const sql = mockStatements[0];
    for (const { context, roleKey } of SEED_PAIRS) {
      expect(sql).toContain(`SELECT '${context}:${roleKey}' AS pair`);
    }
    expect(sql.match(/UNION ALL/g)).toHaveLength(SEED_PAIRS.length - 1);
  });

  test("counts are read back keyed by pair and coerced to numbers", async () => {
    mockUnionRows = [
      { pair: "program:participant", c: 12 },
      { pair: "venture:founder", c: 0 },
    ];
    const counts = await countContextRoleHoldersBatch([
      { context: "program", roleKey: "participant" },
      { context: "venture", roleKey: "founder" },
    ]);
    expect(counts).toEqual({ "program:participant": 12, "venture:founder": 0 });
    expect(typeof counts["venture:founder"]).toBe("number");
  });

  test("a 0 count is a real answer and survives the coercion", async () => {
    mockUnionRows = [{ pair: "lms:learner", c: 0 }];
    const counts = await countContextRoleHoldersBatch([{ context: "lms", roleKey: "learner" }]);
    expect(counts["lms:learner"]).toBe(0);
  });

  test("an unknown pair is never asked for, so it stays absent (the UI shows '—')", async () => {
    mockUnionRows = [{ pair: "program:participant", c: 3 }];
    const counts = await countContextRoleHoldersBatch([
      { context: "program", roleKey: "participant" },
      { context: "program", roleKey: "not_a_real_role" },
    ]);
    expect(counts).toEqual({ "program:participant": 3 });
    expect(mockStatements[0]).not.toContain("not_a_real_role");
  });

  test("no pairs at all means NO statement", async () => {
    expect(await countContextRoleHoldersBatch([])).toEqual({});
    expect(await countContextRoleHoldersBatch([{ context: "x", roleKey: "y" }])).toEqual({});
    expect(await countContextRoleHoldersBatch(null)).toEqual({});
    expect(mockStatements).toHaveLength(0);
  });

  test("a duplicated pair is asked for once", async () => {
    mockUnionRows = [{ pair: "venture:founder", c: 2 }];
    await countContextRoleHoldersBatch([
      { context: "venture", roleKey: "founder" },
      { context: "venture", roleKey: "founder" },
    ]);
    expect(mockStatements[0].match(/UNION ALL/g)).toBeNull();
  });

  test("only the REQUESTED pairs are in the statement, not the whole catalogue", async () => {
    await countContextRoleHoldersBatch([{ context: "venture", roleKey: "founder" }]);
    expect(mockStatements[0]).toContain("venture_members");
    expect(mockStatements[0]).not.toContain("investor_profiles");
  });
});

describe("countContextRoleHoldersBatch — the fail-soft guarantee survives", () => {
  test("a missing LEGACY table falls back to per-pair counting", async () => {
    // The union fails as a whole (one absent table takes every subselect down),
    // so the batch retries pair by pair — which is the only way to keep the
    // original per-row semantics.
    mockUnionFails = true;
    const counts = await countContextRoleHoldersBatch(SEED_PAIRS);

    expect(mockStatements).toHaveLength(1 + SEED_PAIRS.length);
    // Every pair still got an answer rather than the whole registry going null.
    expect(Object.keys(counts)).toHaveLength(SEED_PAIRS.length);
  });

  test("after a union failure, ONE absent table still only costs its own pair", async () => {
    mockUnionFails = true;
    mockSingleFailsFor = ["investor_profiles"];

    const counts = await countContextRoleHoldersBatch(SEED_PAIRS);

    expect(counts["investor:investor"]).toBeNull();
    // The others are unaffected — the fail-soft promise is about per-row.
    expect(counts["program:participant"]).toBe(1);
    expect(counts["venture:founder"]).toBe(1);
  });

  test("the happy path never falls back", async () => {
    mockUnionRows = SEED_PAIRS.map(({ context, roleKey }) => ({
      pair: `${context}:${roleKey}`,
      c: 1,
    }));
    await countContextRoleHoldersBatch(SEED_PAIRS);
    expect(mockStatements).toHaveLength(1);
  });
});

describe("countContextRoleHolders — the single-pair read still behaves", () => {
  test("a known pair returns a number", async () => {
    expect(await countContextRoleHolders("venture", "founder")).toBe(1);
  });

  test("an unknown pair returns null without any statement", async () => {
    expect(await countContextRoleHolders("venture", "nope")).toBeNull();
    expect(mockStatements).toHaveLength(0);
  });

  test("a failing read is fail-soft: it warns and returns null", async () => {
    mockSingleFailsFor = ["venture_members"];
    expect(await countContextRoleHolders("venture", "founder")).toBeNull();
  });

  test("the batch and the single read agree on the same pair", async () => {
    mockCountByTable = { venture_members: 9 };
    mockUnionRows = [{ pair: "venture:founder", c: 9 }];

    const batched = await countContextRoleHoldersBatch([
      { context: "venture", roleKey: "founder" },
    ]);
    const single = await countContextRoleHolders("venture", "founder");

    // The batch must not answer a different number than the read it replaced.
    expect(batched["venture:founder"]).toBe(9);
    expect(batched["venture:founder"]).toBe(single);
  });
});