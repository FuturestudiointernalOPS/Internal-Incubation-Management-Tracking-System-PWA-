/**
 * Contract tests — Journey archive (soft delete) + permanent delete engine.
 *
 * The layer split moved the decisions to `@/services/ventures/journey` and every
 * statement to `@/models/ventureJourneyStore`; the db double is now the module
 * mock (the same pattern as the plan-import suites), so the assertions and their
 * contracts are unchanged.
 */
jest.mock("@/lib/db", () => {
  const state = { calls: [] };

  // Mirrors the probe's "worked on" test: a PRISTINE deliverable (a tracker
  // import row nobody touched) is not filed work; anything else is.
  const PRISTINE = ["", "pending", "not_started"];
  const text = (value) => String(value ?? "").trim().toLowerCase();
  const deliverableIsTouched = (row) =>
    !PRISTINE.includes(text(row.status)) ||
    !PRISTINE.includes(text(row.approval_status)) ||
    text(row.attachment_url) !== "" ||
    text(row.reviewer_name) !== "" ||
    text(row.rejection_reason) !== "";

  /**
   * db double shaped after the real schema:
   *  - journey stages: s1 (clean), s2 (filed work)
   *  - milestones: m1 (stage s1), m2 (stage s2)
   *  - tasks: t1 (milestone m1)
   *  - m1 holds ONE pristine tracker-import deliverable → NOT filed work
   *  - m2 holds a submission on t2 AND a worked-on deliverable → s2 is "filed"
   */
  const handler = async (sql, args = []) => {
    state.calls.push({ sql, args });
    if (sql.includes("FROM venture_journey_stages WHERE id = ? AND venture_id = ?")) {
      const id = args[0];
      const name = { s1: "Journey One", s2: "Journey Two" }[id];
      return { rows: name ? [{ id, name }] : [] };
    }
    if (sql.includes("FROM venture_milestones WHERE venture_id = ? AND journey_stage_id = ?")) {
      const stageId = args[1];
      const milestonesByStage = { s1: [{ id: "m1" }], s2: [{ id: "m2" }] };
      return { rows: milestonesByStage[stageId] || [] };
    }
    if (sql.includes("FROM venture_deliverables")) {
      const rows = [
        { id: "d1", milestone_id: "m1", status: "pending", approval_status: null },
        { id: "d2", milestone_id: "m2", status: "submitted", approval_status: null },
      ];
      return { rows: rows.filter((row) => String(row.milestone_id) === String(args[0]) && deliverableIsTouched(row)) };
    }
    if (sql.includes("FROM venture_task_submissions s") && sql.includes("t.milestone_id")) {
      const milestoneId = args[0];
      return { rows: milestoneId === "m2" ? [{ task_id: 2, milestone_id: "m2" }] : [] };
    }
    if (sql.includes("FROM venture_task_reviews vr")) return { rows: [] };
    if (sql.includes("FROM venture_tasks WHERE milestone_id")) {
      const milestoneId = args[0];
      return { rows: milestoneId === "m1" ? [{ id: 1 }] : [{ id: 2 }] };
    }
    if (sql.includes("SELECT id FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order")) {
      return { rows: [{ id: "s1" }, { id: "s2" }] };
    }
    return { rows: [] };
  };

  return {
    __esModule: true,
    default: {
      async execute({ sql, args = [] }) {
        return handler(sql, args);
      },
      async transaction(runInTransaction) {
        return runInTransaction((sql, args = []) => handler(sql, args));
      },
    },
    initDb: jest.fn().mockResolvedValue(true),
    __state: state,
  };
});

const { __state: state } = require("@/lib/db");
const {
  stageHasFiledWork,
  archiveJourneyStages,
  restoreJourneyStages,
  deleteJourneyStages,
} = require("@/services/ventures/journey");

beforeEach(() => {
  state.calls.length = 0;
});

describe("stageHasFiledWork", () => {
  test("false for a journey whose only deliverable is an untouched import", async () => {
    // s1 holds one pristine tracker-import deliverable. A row is not evidence.
    expect(await stageHasFiledWork({ dbId: "v1", stageId: "s1" })).toBe(false);
  });

  test("true when a bound milestone has a submission and a worked-on deliverable", async () => {
    expect(await stageHasFiledWork({ dbId: "v1", stageId: "s2" })).toBe(true);
  });
});

describe("archiveJourneyStages / restoreJourneyStages", () => {
  test("archives a journey (soft delete flag set) regardless of filed work", async () => {
    const out = await archiveJourneyStages({ dbId: "v1", stageIds: ["s2"], actorCid: "USR-1" });
    expect(out.archived.length).toBe(1);
    expect(out.archived[0].id).toBe("s2");
    const update = state.calls.find((call) => call.sql.includes("SET is_archived = TRUE"));
    expect(update).toBeTruthy();
    expect(update.args[0]).toBe("USR-1");
  });

  test("reports an unknown journey as blocked", async () => {
    const out = await archiveJourneyStages({ dbId: "v1", stageIds: ["nope"] });
    expect(out.archived.length).toBe(0);
    expect(out.blocked[0].id).toBe("nope");
  });

  test("restores an archived journey", async () => {
    const out = await restoreJourneyStages({ dbId: "v1", stageIds: ["s1"] });
    expect(out.restored.length).toBe(1);
    expect(state.calls.some((call) => call.sql.includes("SET is_archived = FALSE"))).toBe(true);
  });
});

describe("deleteJourneyStages", () => {
  test("blocks a journey that has filed work, and NAMES what blocks it", async () => {
    const out = await deleteJourneyStages({ dbId: "v1", stageIds: ["s2"] });
    expect(out.deleted.length).toBe(0);
    expect(out.blocked.length).toBe(1);
    expect(out.blocked[0].reason).toMatch(/cannot be permanently deleted/i);
    // The reason says WHAT was found — not a blanket "submitted work".
    expect(out.blocked[0].reason).toMatch(/submitted work/i);
    expect(out.blocked[0].reason).toMatch(/deliverables that have already been worked on/i);
  });

  test("an untouched tracker-import deliverable does not block a delete", async () => {
    // s1's only deliverable is pristine — the plan structure goes with the plan.
    const out = await deleteJourneyStages({ dbId: "v1", stageIds: ["s1"] });
    expect(out.deleted.length).toBe(1);
    expect(out.blocked.length).toBe(0);
  });

  test("deletes a clean journey with its milestone/task structure", async () => {
    const out = await deleteJourneyStages({ dbId: "v1", stageIds: ["s1"] });
    expect(out.deleted.length).toBe(1);
    expect(out.blocked.length).toBe(0);
    const sqls = state.calls.map((call) => call.sql);
    expect(sqls.some((statement) => statement.includes("DELETE FROM venture_tasks WHERE milestone_id"))).toBe(true);
    expect(sqls.some((statement) => statement.includes("DELETE FROM venture_milestones WHERE id"))).toBe(true);
    expect(sqls.some((statement) => statement.includes("DELETE FROM venture_journey_stages WHERE id"))).toBe(true);
  });

  test("deletes clean journeys and keeps filed ones (mixed selection)", async () => {
    const out = await deleteJourneyStages({ dbId: "v1", stageIds: ["s1", "s2"] });
    expect(out.deleted.map((deletion) => deletion.id)).toEqual(["s1"]);
    expect(out.blocked.map((blockedStage) => blockedStage.id)).toEqual(["s2"]);
  });
});
