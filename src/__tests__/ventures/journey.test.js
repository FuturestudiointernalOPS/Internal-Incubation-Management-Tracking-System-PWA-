/**
 * Venture Journey helpers — configurable, staff-defined journey model.
 *
 * The Journey is NOT a hardcoded platform curriculum. These tests lock in the
 * structural guarantees of the journey data layer:
 *   - the stage table is created structurally (never seeded with defaults);
 *   - stage list reads expose only Venture-facing columns (no approved_by);
 *   - reorder/delete keep the ordered UNIQUE(venture_id, stage_order) intact
 *     through transactional swaps/renumbering.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(), transaction: jest.fn() },
}));

const db = require("@/lib/db").default;
const {
  ensureJourneyTable,
  resolveVentureInternalId,
  listJourneyStages,
  nextJourneyStageOrder,
  moveJourneyStage,
  deleteJourneyStage,
} = require("@/lib/ventureJourneys");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ensureJourneyTable", () => {
  it("creates the stage table structurally and never seeds default stages", async () => {
    db.execute.mockResolvedValue({ rows: [] });
    await ensureJourneyTable(db);

    expect(db.execute).toHaveBeenCalledTimes(5); // CREATE + 4 ALTERs (objective, target_date, template provenance ×2)
    const [create, alterObjective, alterDate, alterSourceType, alterSourceId] = db.execute.mock.calls.map((c) => c[0].sql);
    expect(create).toContain("CREATE TABLE IF NOT EXISTS venture_journey_stages");
    expect(alterObjective).toContain("ADD COLUMN IF NOT EXISTS objective");
    expect(alterDate).toContain("ADD COLUMN IF NOT EXISTS target_date");
    // Template provenance columns — which reusable template generated a stage.
    expect(alterSourceType).toContain("ADD COLUMN IF NOT EXISTS source_template_type");
    expect(alterSourceId).toContain("ADD COLUMN IF NOT EXISTS source_template_id");
    // Structural only — no INSERTs of a standard curriculum.
    expect(create).not.toContain("INSERT INTO");
  });
});

describe("resolveVentureInternalId", () => {
  it("resolves a VNT code to the internal ventures(id) UUID", async () => {
    db.execute.mockResolvedValue({ rows: [{ id: "11111111-1111-1111-1111-111111111111" }] });
    const id = await resolveVentureInternalId(db, "VNT-JOURNEY");
    expect(id).toBe("11111111-1111-1111-1111-111111111111");
    expect(db.execute.mock.calls[0][0].sql).toContain("WHERE venture_id = ?");
  });

  it("returns the UUID untouched when passed directly", async () => {
    const uuid = "22222222-2222-2222-2222-222222222222";
    db.execute.mockResolvedValue({ rows: [{ id: uuid }] });
    const id = await resolveVentureInternalId(db, uuid);
    expect(id).toBe(uuid);
  });
});

describe("listJourneyStages", () => {
  it("selects ordered stages and exposes only Venture-facing columns", async () => {
    db.execute.mockResolvedValue({
      rows: [{ id: "s1", name: "Due Diligence", stage_order: 1, status: "active" }],
    });
    const stages = await listJourneyStages(db, "v-uuid");

    const sql = db.execute.mock.calls[0][0].sql;
    expect(sql).toContain("ORDER BY stage_order ASC");
    expect(sql).not.toContain("approved_by"); // internal approver identity never leaks
    expect(stages).toHaveLength(1);
    expect(stages[0].name).toBe("Due Diligence");
  });
});

describe("nextJourneyStageOrder", () => {
  it("returns max order + 1", async () => {
    db.execute.mockResolvedValue({ rows: [{ next_order: "4" }] });
    expect(await nextJourneyStageOrder(db, "v-uuid")).toBe(4);
  });
});

describe("moveJourneyStage", () => {
  it("swaps adjacent stages transactionally using a parking order", async () => {
    const executed = [];
    db.transaction.mockImplementation(async (cb) => {
      const query = async (sql, args = []) => {
        executed.push({ sql, args });
        if (sql.includes("FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC")) {
          return { rows: [
            { id: "a", stage_order: 1 },
            { id: "b", stage_order: 2 },
          ] };
        }
        return { rows: [] };
      };
      return cb(query);
    });

    const result = await moveJourneyStage(db, { dbId: "v-uuid", stageId: "b", direction: "up" });
    expect(result.success).toBe(true);

    const sqls = executed.map((e) => e.sql);
    expect(sqls[0]).toContain("ORDER BY stage_order ASC");
    // Park the moving stage (b) at -1, then neighbour a takes b's old order,
    // then b takes a's old order — unique order preserved per statement.
    expect(sqls[1]).toContain("SET stage_order = -1");
    expect(executed[1].args[0]).toBe("b");
    expect(executed[2].args).toEqual([2, "a"]);
    expect(executed[3].args).toEqual([1, "b"]);
  });

  it("rejects an edge move", async () => {
    db.transaction.mockImplementation(async (cb) => {
      const query = async (sql) => {
        if (sql.includes("ORDER BY stage_order ASC")) {
          return { rows: [
            { id: "a", stage_order: 1 },
            { id: "b", stage_order: 2 },
          ] };
        }
        return { rows: [] };
      };
      return cb(query);
    });
    const result = await moveJourneyStage(db, { dbId: "v-uuid", stageId: "a", direction: "up" });
    expect(result.error).toBe("Already at the edge.");
  });
});

describe("deleteJourneyStage", () => {
  it("deletes the stage and re-serializes the remaining order 1..n", async () => {
    const executed = [];
    db.transaction.mockImplementation(async (cb) => {
      const query = async (sql, args = []) => {
        executed.push({ sql, args });
        if (sql.includes("FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC")) {
          return { rows: [
            { id: "b", stage_order: 2 },
            { id: "c", stage_order: 3 },
          ] };
        }
        return { rows: [] };
      };
      return cb(query);
    });

    const result = await deleteJourneyStage(db, { dbId: "v-uuid", stageId: "a" });
    expect(result.success).toBe(true);

    const sqls = executed.map((e) => e.sql);
    expect(sqls[0]).toContain("DELETE FROM venture_journey_stages");
    expect(sqls[1]).toContain("ORDER BY stage_order ASC");
    // Renumber b -> 1, c -> 2.
    const updates = executed.filter((e) => e.sql.includes("UPDATE venture_journey_stages SET stage_order"));
    expect(updates[0].args).toEqual([1, "b"]);
    expect(updates[1].args).toEqual([2, "c"]);
  });
});
