/**
 * Contract tests — Journey archive (soft delete) + permanent delete engine.
 * Pure functions with an injected db double (no module mocking needed).
 */
const {
  stageHasFiledWork,
  archiveJourneyStages,
  restoreJourneyStages,
  deleteJourneyStages,
} = require("@/lib/ventureJourneyArchive");

/**
 * db double shaped after the real schema:
 *  - journey stages: s1 (clean), s2 (has filed work via submission)
 *  - milestones: m1 (stage s1), m2 (stage s2)
 *  - tasks: t1 (milestone m1)
 *  - one submission on t2 (milestone m2) => s2 is "filed"
 */
function fakeDb() {
  const calls = [];
  const handler = async (sql, args) => {
    calls.push({ sql, args });
    if (sql.includes("FROM venture_journey_stages WHERE id = ? AND venture_id = ?")) {
      const id = args[0];
      const name = { s1: "Journey One", s2: "Journey Two" }[id];
      return { rows: name ? [{ id, name }] : [] };
    }
    if (sql.includes("FROM venture_milestones WHERE venture_id = ? AND journey_stage_id = ?")) {
      const stageId = args[1];
      const map = { s1: [{ id: "m1" }], s2: [{ id: "m2" }] };
      return { rows: map[stageId] || [] };
    }
    if (sql.includes("FROM venture_deliverables WHERE milestone_id")) return { rows: [] };
    if (sql.includes("FROM venture_task_submissions s") && sql.includes("t.milestone_id")) {
      const mid = args[0];
      return { rows: mid === "m2" ? [{ task_id: 2, milestone_id: "m2" }] : [] };
    }
    if (sql.includes("FROM venture_task_reviews vr")) return { rows: [] };
    if (sql.includes("FROM venture_tasks WHERE milestone_id")) {
      const mid = args[0];
      return { rows: mid === "m1" ? [{ id: 1 }] : [{ id: 2 }] };
    }
    if (sql.includes("SELECT id FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order")) {
      return { rows: [{ id: "s1" }, { id: "s2" }] };
    }
    return { rows: [] };
  };
  const db = {
    calls,
    async execute({ sql, args = [] }) {
      return handler(sql, args);
    },
    async transaction(cb) {
      return cb((sql, args = []) => handler(sql, args));
    },
  };
  return db;
}

describe("stageHasFiledWork", () => {
  test("false for a journey without filed work", async () => {
    const db = fakeDb();
    expect(await stageHasFiledWork(db, { dbId: "v1", stageId: "s1" })).toBe(false);
  });

  test("true when a bound milestone has a submission/review/deliverable", async () => {
    const db = fakeDb();
    expect(await stageHasFiledWork(db, { dbId: "v1", stageId: "s2" })).toBe(true);
  });
});

describe("archiveJourneyStages / restoreJourneyStages", () => {
  test("archives a journey (soft delete flag set) regardless of filed work", async () => {
    const db = fakeDb();
    const out = await archiveJourneyStages(db, { dbId: "v1", stageIds: ["s2"], actorCid: "USR-1" });
    expect(out.archived.length).toBe(1);
    expect(out.archived[0].id).toBe("s2");
    const update = db.calls.find((c) => c.sql.includes("SET is_archived = TRUE"));
    expect(update).toBeTruthy();
    expect(update.args[0]).toBe("USR-1");
  });

  test("reports an unknown journey as blocked", async () => {
    const db = fakeDb();
    const out = await archiveJourneyStages(db, { dbId: "v1", stageIds: ["nope"] });
    expect(out.archived.length).toBe(0);
    expect(out.blocked[0].id).toBe("nope");
  });

  test("restores an archived journey", async () => {
    const db = fakeDb();
    const out = await restoreJourneyStages(db, { dbId: "v1", stageIds: ["s1"] });
    expect(out.restored.length).toBe(1);
    expect(db.calls.some((c) => c.sql.includes("SET is_archived = FALSE"))).toBe(true);
  });
});

describe("deleteJourneyStages", () => {
  test("blocks a journey that already has submitted work", async () => {
    const db = fakeDb();
    const out = await deleteJourneyStages(db, { dbId: "v1", stageIds: ["s2"] });
    expect(out.deleted.length).toBe(0);
    expect(out.blocked.length).toBe(1);
    expect(out.blocked[0].reason).toMatch(/cannot be permanently deleted/i);
  });

  test("deletes a clean journey with its milestone/task structure", async () => {
    const db = fakeDb();
    const out = await deleteJourneyStages(db, { dbId: "v1", stageIds: ["s1"] });
    expect(out.deleted.length).toBe(1);
    expect(out.blocked.length).toBe(0);
    const sqls = db.calls.map((c) => c.sql);
    expect(sqls.some((s) => s.includes("DELETE FROM venture_tasks WHERE milestone_id"))).toBe(true);
    expect(sqls.some((s) => s.includes("DELETE FROM venture_milestones WHERE id"))).toBe(true);
    expect(sqls.some((s) => s.includes("DELETE FROM venture_journey_stages WHERE id"))).toBe(true);
  });

  test("deletes clean journeys and keeps filed ones (mixed selection)", async () => {
    const db = fakeDb();
    const out = await deleteJourneyStages(db, { dbId: "v1", stageIds: ["s1", "s2"] });
    expect(out.deleted.map((d) => d.id)).toEqual(["s1"]);
    expect(out.blocked.map((b) => b.id)).toEqual(["s2"]);
  });
});
