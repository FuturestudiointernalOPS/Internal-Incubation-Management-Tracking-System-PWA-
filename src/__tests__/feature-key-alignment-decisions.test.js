/**
 * FEATURE-KEY ALIGNMENT — behaviour net.
 *
 * The one-time "FEATURES = dashboard sections" migration used to live next to
 * its SQL in `models/authorization/backfill.js` (audit A1, finding #8). The rule
 * now lives in `services/authorization/featureKeyAlignment`, over the statements
 * in `models/authorization/featureKeyAlignmentStore`. These tests pin the rule,
 * not the implementation: which of two responsibility rows survives, that the
 * survivor is re-keyed when it does not carry the target key yet, and that every
 * duplicate's user assignment is re-pointed before the duplicate is deleted.
 */

const mockExecute = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn(async () => {}),
}));

const {
  FEATURE_KEY_RENAMES,
  selectResponsibilitySurvivor,
  ensureFeatureKeyAlignment,
} = require("@/services/authorization/featureKeyAlignment");

beforeEach(() => {
  mockExecute.mockReset();
  mockExecute.mockResolvedValue({ rows: [] });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

const callsWith = (fragment) =>
  mockExecute.mock.calls.filter((call) =>
    String(call[0]?.sql || "").includes(fragment),
  );

describe("selectResponsibilitySurvivor", () => {
  it("keeps the row that already carries the target key", () => {
    const rows = [
      { id: 5, key: "program_management" },
      { id: 9, key: "programs" },
    ];
    const { survivor, dupes } = selectResponsibilitySurvivor(rows, "programs");

    expect(survivor).toEqual({ id: 9, key: "programs" });
    expect(dupes).toEqual([{ id: 5, key: "program_management" }]);
  });

  it("falls back to the lowest id when no row carries the target key", () => {
    const rows = [
      { id: 4, key: "tasks" },
      { id: 3, key: "project_ownership" },
    ];
    const { survivor, dupes } = selectResponsibilitySurvivor(rows, "operations");

    expect(survivor).toEqual({ id: 3, key: "project_ownership" });
    expect(dupes).toEqual([{ id: 4, key: "tasks" }]);
  });

  it("is deterministic whatever order the rows arrive in", () => {
    const rows = [
      { id: 9, key: "programs" },
      { id: 5, key: "program_management" },
    ];
    expect(selectResponsibilitySurvivor(rows, "programs").survivor.id).toBe(9);
  });
});

describe("ensureFeatureKeyAlignment — feature_eligibility", () => {
  it("merges then deletes every renamed feature key", async () => {
    await ensureFeatureKeyAlignment();

    const merges = callsWith("INSERT INTO feature_eligibility");
    const deletes = callsWith("DELETE FROM feature_eligibility WHERE feature_key = ?");

    expect(merges).toHaveLength(Object.keys(FEATURE_KEY_RENAMES).length);
    expect(deletes).toHaveLength(Object.keys(FEATURE_KEY_RENAMES).length);

    for (const [oldKey, newKey] of Object.entries(FEATURE_KEY_RENAMES)) {
      const merge = merges.find((call) => call[0].args[1] === oldKey);
      expect(merge[0].args[0]).toBe(newKey);
    }
    // Deny wins: the merge is a MIN/LEAST, never an overwrite.
    expect(String(merges[0][0].sql)).toContain("LEAST(feature_eligibility.eligible, EXCLUDED.eligible)");
  });
});

describe("ensureFeatureKeyAlignment — responsibilities", () => {
  it("re-points every duplicate's assignments before deleting it", async () => {
    mockExecute.mockImplementation(({ sql, args }) => {
      if (String(sql).includes("SELECT id, key FROM responsibilities")) {
        // The `operations` group only: two rows, neither carrying the target.
        if (args.includes("project_ownership")) {
          return Promise.resolve({
            rows: [
              { id: 3, key: "project_ownership" },
              { id: 4, key: "tasks" },
            ],
          });
        }
      }
      return Promise.resolve({ rows: [] });
    });

    await ensureFeatureKeyAlignment();

    const rename = callsWith("UPDATE responsibilities SET key = ? WHERE id = ?");
    expect(rename).toHaveLength(1);
    expect(rename[0][0].args).toEqual(["operations", 3]);

    const repoint = callsWith("INSERT INTO user_responsibilities");
    expect(repoint).toHaveLength(1);
    expect(repoint[0][0].args).toEqual([3, 4]);

    const deleteAssignments = callsWith("DELETE FROM user_responsibilities WHERE responsibility_id = ?");
    expect(deleteAssignments[0][0].args).toEqual([4]);

    const deleteRow = callsWith("DELETE FROM responsibilities WHERE id = ?");
    expect(deleteRow[0][0].args).toEqual([4]);
  });

  it("does nothing for a merge group with no rows", async () => {
    await ensureFeatureKeyAlignment();

    expect(callsWith("UPDATE responsibilities SET key = ? WHERE id = ?")).toHaveLength(0);
    expect(callsWith("INSERT INTO user_responsibilities")).toHaveLength(0);
  });
});
