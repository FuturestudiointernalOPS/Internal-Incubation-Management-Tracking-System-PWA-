/**
 * Contract tests — Venture milestone/task ARCHIVE (soft delete) engine.
 * Pure functions with an injected db double (no module mocking needed).
 */
const {
  taskHasFiledWork,
  milestoneHasFiledWork,
  archiveTask,
  restoreTask,
  archiveMilestone,
  restoreMilestone,
  applyBulk,
} = require("@/lib/ventureArchive");

/** Minimal db double: routes each query by matching fragments of the SQL. */
function fakeDb({ submissions = [], reviews = [], deliverables = [], tasks = [] } = {}) {
  const calls = [];
  const db = {
    calls,
    async execute({ sql, args }) {
      calls.push({ sql, args });
      if (sql.includes("FROM venture_task_submissions") && sql.includes("WHERE task_id")) {
        return { rows: submissions.filter((s) => String(s.task_id) === String(args[0])) };
      }
      if (sql.includes("FROM venture_task_reviews") && sql.includes("WHERE task_id")) {
        return { rows: reviews.filter((r) => String(r.task_id) === String(args[0])) };
      }
      if (sql.includes("FROM venture_deliverables") && sql.includes("WHERE milestone_id")) {
        return { rows: deliverables.filter((d) => String(d.milestone_id) === String(args[0])) };
      }
      if (sql.includes("FROM venture_task_submissions s")) {
        return { rows: submissions.filter((s) => String(s.milestone_id) === String(args[0])) };
      }
      if (sql.includes("FROM venture_task_reviews vr")) {
        return { rows: reviews.filter((r) => String(r.milestone_id) === String(args[0])) };
      }
      if (sql.includes("SELECT id FROM venture_tasks WHERE milestone_id")) {
        return { rows: tasks.filter((t) => String(t.milestone_id) === String(args[0])) };
      }
      return { rows: [] };
    },
  };
  return db;
}

describe("taskHasFiledWork", () => {
  test("false when the task has no submissions and no reviews", async () => {
    const db = fakeDb();
    expect(await taskHasFiledWork(db, 7)).toBe(false);
  });

  test("true when a submission exists", async () => {
    const db = fakeDb({ submissions: [{ task_id: 7 }] });
    expect(await taskHasFiledWork(db, 7)).toBe(true);
  });

  test("true when a staff review exists", async () => {
    const db = fakeDb({ reviews: [{ task_id: 7 }] });
    expect(await taskHasFiledWork(db, 7)).toBe(true);
  });
});

describe("milestoneHasFiledWork", () => {
  test("false for a clean milestone", async () => {
    const db = fakeDb();
    expect(await milestoneHasFiledWork(db, "m1")).toBe(false);
  });

  test("true when the milestone has deliverables", async () => {
    const db = fakeDb({ deliverables: [{ milestone_id: "m1" }] });
    expect(await milestoneHasFiledWork(db, "m1")).toBe(true);
  });

  test("true when one of its tasks has a submission", async () => {
    const db = fakeDb({ submissions: [{ milestone_id: "m1" }] });
    expect(await milestoneHasFiledWork(db, "m1")).toBe(true);
  });
});

describe("archiveTask", () => {
  test("refuses when the task has filed work", async () => {
    const db = fakeDb({ submissions: [{ task_id: 7 }] });
    const out = await archiveTask(db, { taskId: 7 });
    expect(out.error).toMatch(/cannot be deleted/i);
  });

  test("archives a clean task (soft delete flags set)", async () => {
    const db = fakeDb();
    const out = await archiveTask(db, { taskId: 7, actorCid: "USR-1" });
    expect(out.archived).toBe(true);
    const update = db.calls.find((c) => c.sql.includes("UPDATE venture_tasks SET is_archived"));
    expect(update).toBeTruthy();
    expect(update.args[0]).toBe("USR-1");
    expect(update.args[1]).toBe("7");
  });
});

describe("archiveMilestone", () => {
  test("refuses when the milestone has filed work", async () => {
    const db = fakeDb({ deliverables: [{ milestone_id: "m1" }] });
    const out = await archiveMilestone(db, { milestoneId: "m1" });
    expect(out.error).toMatch(/cannot be deleted/i);
  });

  test("archives the milestone and cascades to its tasks", async () => {
    const db = fakeDb({ tasks: [{ id: 11, milestone_id: "m1" }, { id: 12, milestone_id: "m1" }] });
    const out = await archiveMilestone(db, { milestoneId: "m1", actorCid: "USR-1" });
    expect(out.archived).toBe(true);
    const msUpdate = db.calls.find((c) => c.sql.includes("UPDATE venture_milestones SET is_archived"));
    expect(msUpdate).toBeTruthy();
    // Cascade: both bound tasks got an archive UPDATE.
    const taskUpdates = db.calls.filter((c) => c.sql.includes("UPDATE venture_tasks SET is_archived") && !c.sql.includes("UPDATE venture_milestones"));
    expect(taskUpdates.length).toBe(2);
  });
});

describe("restore + bulk", () => {
  test("restoreTask clears the archive flags", async () => {
    const db = fakeDb();
    await restoreTask(db, { taskId: 7 });
    const u = db.calls.find((c) => c.sql.includes("is_archived = FALSE"));
    expect(u).toBeTruthy();
  });

  test("restoreMilestone clears the milestone and its tasks", async () => {
    const db = fakeDb();
    await restoreMilestone(db, { milestoneId: "m1" });
    expect(db.calls.some((c) => c.sql.includes("UPDATE venture_milestones SET is_archived = FALSE"))).toBe(true);
    expect(db.calls.some((c) => c.sql.includes("UPDATE venture_tasks SET is_archived = FALSE"))).toBe(true);
  });

  test("applyBulk reports archived vs blocked per row", async () => {
    const db = fakeDb({ submissions: [{ milestone_id: "m-filed" }] });
    const out = await applyBulk(db, {
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
