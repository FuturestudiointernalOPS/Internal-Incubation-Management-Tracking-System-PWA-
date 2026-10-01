/**
 * TASK DEPENDENCIES — hard blocking, cycle refusal, and immediate release.
 *
 * An edge (source -> target) means the SOURCE task blocks the TARGET: the
 * target cannot start or be finished until the source is done. These helpers
 * are what makes that true — and what keeps a task's `blocked` state honest.
 *
 * Pure helpers over an injected db double (all SQL lives in @/lib/ventures).
 */

const mockState = {
  edges: [],
  blockers: [],
  inbound: 0,
  taskStatus: "todo",
  taskExists: true,
  dependents: [],
  writes: [],
  inserts: [],
  deletes: 0,
};

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    if (sql.includes("SELECT source_type, source_id, target_type, target_id FROM venture_dependencies")) {
      return { rows: mockState.edges };
    }
    if (sql.includes("SELECT DISTINCT target_id")) {
      return { rows: mockState.dependents.map((id) => ({ target_id: String(id) })) };
    }
    if (sql.includes("blocker.title")) {
      return { rows: mockState.blockers };
    }
    if (sql.includes("COUNT(*)::int AS n FROM venture_dependencies")) {
      return { rows: [{ n: mockState.inbound }] };
    }
    if (sql.includes("SELECT id, status FROM venture_tasks")) {
      return { rows: mockState.taskExists ? [{ id: 5, status: mockState.taskStatus }] : [] };
    }
    if (sql.startsWith("UPDATE venture_tasks SET")) {
      mockState.writes.push({ sql, args });
      return { rows: sql.includes("RETURNING id") ? [{ id: args[0] }] : [] };
    }
    if (sql.includes("DELETE FROM venture_dependencies")) {
      mockState.deletes += 1;
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO venture_dependencies")) {
      mockState.inserts.push(args);
      return { rows: [] };
    }
    return { rows: [] };
  }),
};
mockDb.transaction = jest.fn(async (run) => run(async (sql, args = []) => mockDb.execute({ sql, args })));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

const {
  getUnmetTaskDependencies,
  setTaskDependencies,
  syncTaskBlockState,
  releaseTasksBlockedBy,
  listTasksBlockedBy,
} = require("@/lib/ventures");

beforeEach(() => {
  mockState.edges = [];
  mockState.blockers = [];
  mockState.inbound = 0;
  mockState.taskStatus = "todo";
  mockState.taskExists = true;
  mockState.dependents = [];
  mockState.writes = [];
  mockState.inserts = [];
  mockState.deletes = 0;
  jest.clearAllMocks();
});

describe("getUnmetTaskDependencies — the blockers that are not done yet", () => {
  test("returns the unfinished blocker tasks", async () => {
    mockState.blockers = [{ id: 9, title: "Identify ICPs", status: "in_progress" }];
    const blockers = await getUnmetTaskDependencies({ ventureId: "v-1", taskId: 5 });
    expect(blockers).toHaveLength(1);
    expect(blockers[0].title).toBe("Identify ICPs");
  });

  test("no rows means nothing holds the task back", async () => {
    expect(await getUnmetTaskDependencies({ ventureId: "v-1", taskId: 5 })).toEqual([]);
  });
});

describe("setTaskDependencies — replace a task's blockers, refusing loops whole", () => {
  test("writes the new set when nothing closes a loop", async () => {
    await setTaskDependencies({ ventureId: "v-1", taskId: 5, blockedByTaskIds: [9, 10] });
    expect(mockState.deletes).toBe(1);
    expect(mockState.inserts).toEqual([
      ["v-1", "9", "5"],
      ["v-1", "10", "5"],
    ]);
  });

  test("refuses a TRANSITIVE loop as a whole — nothing is written", async () => {
    // 5 blocks 7, 7 blocks 9 ... so making 9 block 5 would close the loop.
    mockState.edges = [
      { source_type: "task", source_id: "5", target_type: "task", target_id: "7" },
      { source_type: "task", source_id: "7", target_type: "task", target_id: "9" },
    ];
    await expect(
      setTaskDependencies({ ventureId: "v-1", taskId: 5, blockedByTaskIds: [9] }),
    ).rejects.toThrow(/circular/i);
    expect(mockState.deletes).toBe(0);
    expect(mockState.inserts).toEqual([]);
  });

  test("ignores the task itself in the picked set", async () => {
    await setTaskDependencies({ ventureId: "v-1", taskId: 5, blockedByTaskIds: [5] });
    expect(mockState.inserts).toEqual([]);
    expect(mockState.deletes).toBe(1); // the set is still replaced (with nothing)
  });
});

describe("syncTaskBlockState — a task's blocked state follows its dependencies", () => {
  test("an unmet blocker forces `blocked`", async () => {
    mockState.blockers = [{ id: 9, title: "A", status: "in_progress" }];
    const out = await syncTaskBlockState({ ventureId: "v-1", taskId: 5 });
    expect(out.status).toBe("blocked");
    expect(mockState.writes.some((write) => write.sql.includes("SET status = ?") && write.args[0] === "blocked")).toBe(true);
  });

  test("once every blocker is done, a dependency-held task returns to `todo`", async () => {
    mockState.taskStatus = "blocked";
    mockState.inbound = 1;
    const out = await syncTaskBlockState({ ventureId: "v-1", taskId: 5 });
    expect(out.status).toBe("todo");
    expect(mockState.writes.some((write) => write.args[0] === "todo")).toBe(true);
  });

  test("a MANUAL block (no dependency at all) is never touched", async () => {
    mockState.taskStatus = "blocked";
    mockState.inbound = 0;
    const out = await syncTaskBlockState({ ventureId: "v-1", taskId: 5 });
    expect(out.status).toBe("blocked");
    expect(mockState.writes).toEqual([]);
  });

  test("a finished task is left alone", async () => {
    mockState.taskStatus = "done";
    mockState.blockers = [{ id: 9, title: "A", status: "in_progress" }];
    const out = await syncTaskBlockState({ ventureId: "v-1", taskId: 5 });
    expect(out.status).toBe("done");
    expect(mockState.writes).toEqual([]);
  });
});

describe("releaseTasksBlockedBy — completing a task frees what it held back", () => {
  test("releases a dependent whose blockers are all done", async () => {
    mockState.dependents = [7];
    const out = await releaseTasksBlockedBy({ ventureId: "v-1", blockerTaskId: 5 });
    expect(out.released).toEqual([7]);
    expect(mockState.writes.some((write) => write.sql.includes("SET status = 'todo'"))).toBe(true);
  });

  test("leaves a dependent that still has another unmet blocker", async () => {
    mockState.dependents = [7];
    mockState.blockers = [{ id: 9, title: "Still open", status: "in_progress" }];
    const out = await releaseTasksBlockedBy({ ventureId: "v-1", blockerTaskId: 5 });
    expect(out.released).toEqual([]);
    expect(mockState.writes).toEqual([]);
  });

  test("listTasksBlockedBy reports the dependents of a task", async () => {
    mockState.dependents = [7, 8];
    expect(await listTasksBlockedBy({ ventureId: "v-1", blockerTaskId: 5 })).toEqual(["7", "8"]);
  });
});
