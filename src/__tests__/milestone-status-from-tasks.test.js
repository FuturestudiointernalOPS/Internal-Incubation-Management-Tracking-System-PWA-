/**
 * A milestone's status follows the WORK inside it, not only the evidence.
 *
 * The defect this locks out: a milestone whose tasks were finished still read
 * "Not Started", because nothing in the platform ever moved a milestone from
 * task activity — a team could do every task and watch the badge sit still.
 *
 * The line this locks IN: finishing the work is not the same as achieving the
 * outcome. Tasks advance a milestone; only the completion authority (with the
 * work done AND the evidence approved) may close it.
 */

jest.mock("@/lib/db", () => {
  const state = { executeImpl: async () => ({ rows: [] }) };
  return {
    __esModule: true,
    default: { execute: jest.fn(async ({ sql, args = [] }) => state.executeImpl({ sql, args })) },
    initDb: jest.fn().mockResolvedValue(true),
    __state: state,
  };
});

const { __state: mockState } = require("@/lib/db");
const {
  deriveMilestoneStatusFromTasks,
  combineMilestoneStatus,
  syncMilestoneFromWork,
} = require("@/lib/ventureMilestoneEngine");

const MS = "ms-1";
const DB = "v-1";
const STAGE = "s-1";

/** A db double answering the exact questions the engine asks. */
function fakeDb({
  milestoneStatus = "not_started",
  journeyStageId = STAGE,
  deliverables = [],
  tasks = [],
  stageStatus = "active",
  milestoneTitle = "Market Readiness",
} = {}) {
  const calls = [];
  const executeImpl = async ({ sql, args = [] }) => {
    calls.push({ sql, args });
    if (sql.includes("SELECT id, title, status, journey_stage_id FROM venture_milestones")) {
      return {
        rows: milestoneStatus
          ? [{ id: MS, title: milestoneTitle, status: milestoneStatus, journey_stage_id: journeyStageId }]
          : [],
      };
    }
    if (sql.includes("FROM venture_deliverables WHERE milestone_id::text")) return { rows: deliverables };
    if (sql.includes("FROM venture_tasks WHERE milestone_id::text")) return { rows: tasks };
    if (sql.includes("SELECT id, name, status, stage_order FROM venture_journey_stages")) {
      return { rows: stageStatus ? [{ id: STAGE, name: "Market Readiness", status: stageStatus, stage_order: 1 }] : [] };
    }
    if (sql.includes("SELECT id, status FROM venture_milestones")) return { rows: [{ id: MS, status: "completed" }] };
    return { rows: [] };
  };
  mockState.executeImpl = executeImpl;
  return { calls };
}

const statusUpdate = (calls) => calls.find((call) => call.sql.startsWith("UPDATE venture_milestones SET status = ?"));

describe("deriveMilestoneStatusFromTasks", () => {
  test("no tasks → null (there is no execution component to reflect)", () => {
    expect(deriveMilestoneStatusFromTasks([])).toBeNull();
    expect(deriveMilestoneStatusFromTasks(undefined)).toBeNull();
  });

  test("only cancelled work → null (it is no longer required work)", () => {
    expect(deriveMilestoneStatusFromTasks([{ status: "cancelled" }, { status: "cancelled" }])).toBeNull();
  });

  test("nothing begun → not_started", () => {
    expect(deriveMilestoneStatusFromTasks([{ status: "backlog" }, { status: "todo" }])).toBe("not_started");
    expect(deriveMilestoneStatusFromTasks([{ status: "blocked" }])).toBe("not_started");
  });

  test("work under way → in_progress", () => {
    expect(deriveMilestoneStatusFromTasks([{ status: "backlog" }, { status: "in_progress" }])).toBe("in_progress");
    expect(deriveMilestoneStatusFromTasks([{ status: "review" }])).toBe("in_progress");
  });

  test("partly done → in_progress", () => {
    expect(deriveMilestoneStatusFromTasks([{ status: "done" }, { status: "todo" }])).toBe("in_progress");
    expect(deriveMilestoneStatusFromTasks([{ status: "accepted" }, { status: "backlog" }])).toBe("in_progress");
  });

  test("every task done → all_done (a signal, not a milestone status)", () => {
    expect(deriveMilestoneStatusFromTasks([{ status: "done" }, { status: "accepted" }])).toBe("all_done");
    expect(deriveMilestoneStatusFromTasks([{ status: "completed" }])).toBe("all_done");
  });

  test("a rejected completion is NOT done — it is back in the team's hands", () => {
    expect(deriveMilestoneStatusFromTasks([{ status: "done" }, { status: "revision_requested" }])).toBe("in_progress");
    expect(deriveMilestoneStatusFromTasks([{ status: "rejected" }])).toBe("in_progress");
  });

  test("cancelled work does not hold the rest back", () => {
    expect(deriveMilestoneStatusFromTasks([{ status: "done" }, { status: "cancelled" }])).toBe("all_done");
  });
});

describe("combineMilestoneStatus — tasks advance, evidence and authority close", () => {
  test("finished work with no evidence is NOT completion", () => {
    expect(combineMilestoneStatus({ fromDeliverables: null, fromTasks: "all_done" })).toBe("in_progress");
  });

  test("approved evidence with work still open is NOT completion", () => {
    expect(combineMilestoneStatus({ fromDeliverables: "completed", fromTasks: "in_progress" })).toBe("in_progress");
    expect(combineMilestoneStatus({ fromDeliverables: "completed", fromTasks: "not_started" })).toBe("in_progress");
  });

  test("both halves done → completed", () => {
    expect(combineMilestoneStatus({ fromDeliverables: "completed", fromTasks: "all_done" })).toBe("completed");
  });

  test("a milestone with no tasks still completes on evidence alone", () => {
    expect(combineMilestoneStatus({ fromDeliverables: "completed", fromTasks: null })).toBe("completed");
  });

  test("a human decision outranks progress", () => {
    expect(combineMilestoneStatus({ fromDeliverables: "changes_requested", fromTasks: "all_done" })).toBe("changes_requested");
    expect(combineMilestoneStatus({ fromDeliverables: "under_review", fromTasks: "all_done" })).toBe("under_review");
  });

  test("work or evidence under way is In Progress", () => {
    expect(combineMilestoneStatus({ fromDeliverables: null, fromTasks: "in_progress" })).toBe("in_progress");
    expect(combineMilestoneStatus({ fromDeliverables: "in_progress", fromTasks: null })).toBe("in_progress");
  });

  test("nothing begun is Not Started", () => {
    expect(combineMilestoneStatus({ fromDeliverables: "not_started", fromTasks: "not_started" })).toBe("not_started");
    expect(combineMilestoneStatus({ fromDeliverables: null, fromTasks: "not_started" })).toBe("not_started");
  });
});

describe("syncMilestoneFromWork — a task moves the milestone it belongs to", () => {
  test("work starting moves the milestone to in_progress", async () => {
    const { calls } = fakeDb({ tasks: [{ status: "in_progress" }] });
    const out = await syncMilestoneFromWork({ dbId: DB, milestoneId: MS });
    expect(out).toEqual({ changed: true, status: "in_progress" });
    expect(statusUpdate(calls).args).toEqual(["in_progress", MS, DB]);
  });

  test("every task done, no evidence → still in_progress, never completed", async () => {
    const { calls } = fakeDb({ tasks: [{ status: "done" }, { status: "done" }] });
    const out = await syncMilestoneFromWork({ dbId: DB, milestoneId: MS, canComplete: true });
    expect(out).toEqual({ changed: true, status: "in_progress" });
    expect(calls.some((call) => call.sql.includes("status = 'completed'"))).toBe(false);
  });

  test("all tasks done + evidence approved, but no authority → stops at in_progress", async () => {
    const { calls } = fakeDb({
      tasks: [{ status: "done" }],
      deliverables: [{ approval_status: "approved" }],
    });
    const out = await syncMilestoneFromWork({ dbId: DB, milestoneId: MS, canComplete: false });
    expect(out).toEqual({ changed: true, status: "in_progress" });
    expect(calls.some((call) => call.sql.includes("status = 'completed'"))).toBe(false);
  });

  test("all tasks done + evidence approved + authority → completed, and the Journey closes", async () => {
    const { calls } = fakeDb({
      tasks: [{ status: "done" }],
      deliverables: [{ approval_status: "approved" }],
    });
    const out = await syncMilestoneFromWork({ dbId: DB, milestoneId: MS, cid: "USR-lead", canComplete: true });
    expect(out).toMatchObject({ changed: true, status: "completed", milestone_title: "Market Readiness" });
    expect(calls.some((call) => call.sql.includes("SET status = 'completed', progress = 100"))).toBe(true);
    expect(calls.some((call) => call.sql.includes("UPDATE venture_journey_stages SET status = 'completed'"))).toBe(true);
    expect(out.journey_completed).toBe(true);
  });

  test("THE NEW RULE: approved evidence with unfinished work does not close the milestone", async () => {
    const { calls } = fakeDb({
      tasks: [{ status: "done" }, { status: "todo" }],
      deliverables: [{ approval_status: "approved" }],
    });
    const out = await syncMilestoneFromWork({ dbId: DB, milestoneId: MS, canComplete: true });
    expect(out).toEqual({ changed: true, status: "in_progress" });
    expect(calls.some((call) => call.sql.includes("status = 'completed'"))).toBe(false);
  });

  test("an upcoming milestone is unreleased planning — the work never releases it", async () => {
    const { calls } = fakeDb({ milestoneStatus: "upcoming", tasks: [{ status: "in_progress" }] });
    const out = await syncMilestoneFromWork({ dbId: DB, milestoneId: MS, canComplete: true });
    expect(out).toEqual({ changed: false, status: "upcoming" });
    expect(statusUpdate(calls)).toBeUndefined();
  });

  test("a blocked milestone stays blocked — finished work never clears a dependency", async () => {
    const { calls } = fakeDb({ milestoneStatus: "blocked", tasks: [{ status: "done" }] });
    const out = await syncMilestoneFromWork({ dbId: DB, milestoneId: MS, canComplete: true });
    expect(out).toEqual({ changed: false, status: "blocked" });
    expect(statusUpdate(calls)).toBeUndefined();
  });

  test("a completed milestone is never reopened by later work", async () => {
    const { calls } = fakeDb({ milestoneStatus: "completed", tasks: [{ status: "todo" }] });
    const out = await syncMilestoneFromWork({ dbId: DB, milestoneId: MS, canComplete: true });
    expect(out).toEqual({ changed: false, status: "completed" });
    expect(statusUpdate(calls)).toBeUndefined();
  });

  test("a milestone with no work at all keeps the status a person gave it", async () => {
    const { calls } = fakeDb({ milestoneStatus: "in_progress", tasks: [], deliverables: [] });
    const out = await syncMilestoneFromWork({ dbId: DB, milestoneId: MS });
    expect(out).toEqual({ changed: false, status: "in_progress" });
    expect(statusUpdate(calls)).toBeUndefined();
  });

  test("an unknown milestone changes nothing", async () => {
    const { calls } = fakeDb({ milestoneStatus: null });
    const out = await syncMilestoneFromWork({ dbId: DB, milestoneId: MS });
    expect(out).toEqual({ changed: false, status: null });
    expect(statusUpdate(calls)).toBeUndefined();
  });

  test("the sync writes nothing when the milestone already reads right", async () => {
    const { calls } = fakeDb({ milestoneStatus: "in_progress", tasks: [{ status: "in_progress" }] });
    const out = await syncMilestoneFromWork({ dbId: DB, milestoneId: MS });
    expect(out).toEqual({ changed: false, status: "in_progress" });
    expect(statusUpdate(calls)).toBeUndefined();
  });
});
