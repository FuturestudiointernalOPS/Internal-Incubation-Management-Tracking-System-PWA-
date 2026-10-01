/**
 * Contract tests — Venture milestone/task ARCHIVE (soft delete) engine.
 *
 * The layer split moved the decisions to `@/services/ventures/archive` and every
 * statement to `@/models/ventureArchiveStore`; the db double is now the module
 * mock (the same pattern as the plan-import suites), so the assertions and their
 * contracts are unchanged. The functions are still reached through the
 * compatibility facade `@/lib/ventureArchive`.
 */
jest.mock("@/lib/db", () => {
  const state = {
    calls: [],
    fixtures: { submissions: [], reviews: [], deliverables: [], tasks: [] },
  };

  /** Minimal db double: routes each query by matching fragments of the SQL. */
  const handler = async (sql, args) => {
    state.calls.push({ sql, args });
    const { submissions, reviews, deliverables, tasks } = state.fixtures;
    if (sql.includes("FROM venture_task_submissions") && sql.includes("WHERE task_id")) {
      return { rows: submissions.filter((submission) => String(submission.task_id) === String(args[0])) };
    }
    if (sql.includes("FROM venture_task_reviews") && sql.includes("WHERE task_id")) {
      return { rows: reviews.filter((review) => String(review.task_id) === String(args[0])) };
    }
    if (sql.includes("FROM venture_deliverables") && sql.includes("WHERE milestone_id")) {
      return { rows: deliverables.filter((deliverable) => String(deliverable.milestone_id) === String(args[0])) };
    }
    if (sql.includes("FROM venture_task_submissions s")) {
      return { rows: submissions.filter((submission) => String(submission.milestone_id) === String(args[0])) };
    }
    if (sql.includes("FROM venture_task_reviews vr")) {
      return { rows: reviews.filter((review) => String(review.milestone_id) === String(args[0])) };
    }
    if (sql.includes("SELECT id FROM venture_tasks WHERE milestone_id")) {
      return { rows: tasks.filter((task) => String(task.milestone_id) === String(args[0])) };
    }
    return { rows: [] };
  };

  return {
    __esModule: true,
    default: {
      execute: jest.fn(async ({ sql, args = [] }) => handler(sql, args)),
    },
    initDb: jest.fn().mockResolvedValue(true),
    __state: state,
  };
});

const { __state: state } = require("@/lib/db");
const {
  taskHasFiledWork,
  milestoneHasFiledWork,
  archiveTask,
  restoreTask,
  archiveMilestone,
  restoreMilestone,
  applyBulk,
} = require("@/lib/ventureArchive");

/** Point the db double at this test's rows (and clear the recorded calls). */
function fakeDb(fixtures = {}) {
  state.calls.length = 0;
  state.fixtures = { submissions: [], reviews: [], deliverables: [], tasks: [], ...fixtures };
}

describe("taskHasFiledWork", () => {
  test("false when the task has no submissions and no reviews", async () => {
    fakeDb();
    expect(await taskHasFiledWork(7)).toBe(false);
  });

  test("true when a submission exists", async () => {
    fakeDb({ submissions: [{ task_id: 7 }] });
    expect(await taskHasFiledWork(7)).toBe(true);
  });

  test("true when a staff review exists", async () => {
    fakeDb({ reviews: [{ task_id: 7 }] });
    expect(await taskHasFiledWork(7)).toBe(true);
  });
});

describe("milestoneHasFiledWork", () => {
  test("false for a clean milestone", async () => {
    fakeDb();
    expect(await milestoneHasFiledWork("m1")).toBe(false);
  });

  test("true when the milestone has deliverables", async () => {
    fakeDb({ deliverables: [{ milestone_id: "m1" }] });
    expect(await milestoneHasFiledWork("m1")).toBe(true);
  });

  test("true when one of its tasks has a submission", async () => {
    fakeDb({ submissions: [{ milestone_id: "m1" }] });
    expect(await milestoneHasFiledWork("m1")).toBe(true);
  });
});

describe("archiveTask", () => {
  test("refuses when the task has filed work", async () => {
    fakeDb({ submissions: [{ task_id: 7 }] });
    const out = await archiveTask({ taskId: 7 });
    expect(out.error).toMatch(/cannot be deleted/i);
  });

  test("archives a clean task (soft delete flags set)", async () => {
    fakeDb();
    const out = await archiveTask({ taskId: 7, actorCid: "USR-1" });
    expect(out.archived).toBe(true);
    const update = state.calls.find((call) => call.sql.includes("UPDATE venture_tasks SET is_archived"));
    expect(update).toBeTruthy();
    expect(update.args[0]).toBe("USR-1");
    expect(update.args[1]).toBe("7");
  });
});

describe("archiveMilestone", () => {
  test("refuses when the milestone has filed work", async () => {
    fakeDb({ deliverables: [{ milestone_id: "m1" }] });
    const out = await archiveMilestone({ milestoneId: "m1" });
    expect(out.error).toMatch(/cannot be deleted/i);
  });

  test("archives the milestone and cascades to its tasks", async () => {
    fakeDb({ tasks: [{ id: 11, milestone_id: "m1" }, { id: 12, milestone_id: "m1" }] });
    const out = await archiveMilestone({ milestoneId: "m1", actorCid: "USR-1" });
    expect(out.archived).toBe(true);
    const msUpdate = state.calls.find((call) => call.sql.includes("UPDATE venture_milestones SET is_archived"));
    expect(msUpdate).toBeTruthy();
    // Cascade: both bound tasks got an archive UPDATE.
    const taskUpdates = state.calls.filter((call) => call.sql.includes("UPDATE venture_tasks SET is_archived") && !call.sql.includes("UPDATE venture_milestones"));
    expect(taskUpdates.length).toBe(2);
  });
});

describe("restore + bulk", () => {
  test("restoreTask clears the archive flags", async () => {
    fakeDb();
    await restoreTask({ taskId: 7 });
    const restoreCall = state.calls.find((call) => call.sql.includes("is_archived = FALSE"));
    expect(restoreCall).toBeTruthy();
  });

  test("restoreMilestone clears the milestone and its tasks", async () => {
    fakeDb();
    await restoreMilestone({ milestoneId: "m1" });
    expect(state.calls.some((call) => call.sql.includes("UPDATE venture_milestones SET is_archived = FALSE"))).toBe(true);
    expect(state.calls.some((call) => call.sql.includes("UPDATE venture_tasks SET is_archived = FALSE"))).toBe(true);
  });

  test("applyBulk reports archived vs blocked per row", async () => {
    fakeDb({ submissions: [{ milestone_id: "m-filed" }] });
    const out = await applyBulk({
      rows: [
        { id: "m-clean", title: "Clean" },
        { id: "m-filed", title: "Filed" },
      ],
      actorCid: "USR-1",
      action: "archive",
      kind: "milestone",
    });
    expect(out.archived.length).toBe(1);
    expect(out.archived[0].id).toBe("m-clean");
    expect(out.blocked.length).toBe(1);
    expect(out.blocked[0].id).toBe("m-filed");
    expect(out.blocked[0].reason).toMatch(/cannot be deleted/i);
  });
});
