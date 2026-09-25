/**
 * A milestone's own status follows the work inside it.
 *
 * The defect this locks out: the milestone vocabulary (in_progress /
 * under_review / changes_requested) was never written by the deliverable flow,
 * so a milestone with approved evidence still read "Not Started" and a Journey
 * could show "0/3 milestones" while the founder's deliverables sat approved.
 *
 * Two rules must survive the change:
 *   - a `locked` milestone is unreleased planning and is never moved by work;
 *   - a `completed` milestone stays completed (the manager's decision), and
 *     closing one still requires completion authority.
 */

const {
  deriveMilestoneStatusFromDeliverables,
  syncMilestoneStatusFromDeliverables,
} = require("@/lib/ventureMilestoneEngine");

const MS = "ms-1";
const DB = "v-1";
const STAGE = "s-1";

/** A db double answering the exact questions the engine asks, in order. */
function fakeDb({ milestoneStatus = "not_started", journeyStageId = STAGE, deliverables = [], stageStatus = "active", milestoneTitle = "Pitch Deck" }) {
  const calls = [];
  const execute = jest.fn(async ({ sql, args = [] }) => {
    calls.push({ sql, args });
    if (sql.includes("SELECT id, title, status, journey_stage_id FROM venture_milestones")) {
      return { rows: milestoneStatus ? [{ id: MS, title: milestoneTitle, status: milestoneStatus, journey_stage_id: journeyStageId }] : [] };
    }
    if (sql.includes("FROM venture_deliverables WHERE milestone_id::text")) {
      return { rows: deliverables };
    }
    if (sql.includes("SELECT id, journey_stage_id FROM venture_milestones")) {
      return { rows: [{ id: MS, journey_stage_id: journeyStageId }] };
    }
    if (sql.includes("SELECT id FROM venture_milestones") && sql.includes("status = 'locked'")) return { rows: [] };
    if (sql.includes("SELECT id, name, status, stage_order FROM venture_journey_stages")) {
      return { rows: stageStatus ? [{ id: STAGE, name: "Ideation", status: stageStatus, stage_order: 1 }] : [] };
    }
    if (sql.includes("SELECT id, status FROM venture_milestones")) return { rows: [{ id: MS, status: "completed" }] };
    return { rows: [] };
  });
  return { db: { execute }, calls };
}

const statusUpdate = (calls) => calls.find((call) => call.sql.startsWith("UPDATE venture_milestones SET status = ?"));

describe("deriveMilestoneStatusFromDeliverables", () => {
  test("no deliverables → null (there is no work to reflect)", () => {
    expect(deriveMilestoneStatusFromDeliverables([])).toBeNull();
    expect(deriveMilestoneStatusFromDeliverables(undefined)).toBeNull();
  });

  test("every deliverable approved → completed", () => {
    expect(deriveMilestoneStatusFromDeliverables([{ status: "completed", approval_status: "approved" }, { approval_status: "approved" }])).toBe("completed");
  });

  test("anything sent back → changes_requested, even beside a pending review", () => {
    expect(deriveMilestoneStatusFromDeliverables([{ approval_status: "approved" }, { approval_status: "rejected" }, { status: "submitted" }])).toBe("changes_requested");
  });

  test("anything awaiting review → under_review", () => {
    expect(deriveMilestoneStatusFromDeliverables([{ status: "submitted" }, { approval_status: "approved" }])).toBe("under_review");
  });

  test("started but nothing awaiting review → in_progress", () => {
    expect(deriveMilestoneStatusFromDeliverables([{ status: "in_progress" }])).toBe("in_progress");
    expect(deriveMilestoneStatusFromDeliverables([{ approval_status: "approved" }, { status: "pending" }])).toBe("in_progress");
  });

  test("nothing started → not_started", () => {
    expect(deriveMilestoneStatusFromDeliverables([{ status: "pending" }, {}])).toBe("not_started");
  });
});

describe("syncMilestoneStatusFromDeliverables", () => {
  test("a submission moves the milestone to under_review and never completes it", async () => {
    const { db, calls } = fakeDb({ deliverables: [{ status: "submitted" }] });
    const out = await syncMilestoneStatusFromDeliverables(db, { dbId: DB, milestoneId: MS, canComplete: true });
    expect(out).toEqual({ changed: true, status: "under_review" });
    expect(statusUpdate(calls).args).toEqual(["under_review", MS, DB]);
    expect(calls.some((call) => call.sql.includes("status = 'completed'"))).toBe(false);
  });

  test("a returned deliverable moves the milestone to changes_requested", async () => {
    const { db, calls } = fakeDb({ deliverables: [{ approval_status: "approved" }, { approval_status: "rejected" }] });
    const out = await syncMilestoneStatusFromDeliverables(db, { dbId: DB, milestoneId: MS, canComplete: true });
    expect(out.status).toBe("changes_requested");
    expect(statusUpdate(calls).args[0]).toBe("changes_requested");
  });

  test("the last approval completes the milestone for a completion authority — and unlocks the next", async () => {
    const { db, calls } = fakeDb({ deliverables: [{ approval_status: "approved" }] });
    const out = await syncMilestoneStatusFromDeliverables(db, { dbId: DB, milestoneId: MS, cid: "USR-lead", canComplete: true });
    expect(out).toMatchObject({ changed: true, status: "completed", milestone_title: "Pitch Deck" });
    expect(calls.some((call) => call.sql.includes("SET status = 'completed', progress = 100"))).toBe(true);
    expect(calls.some((call) => call.sql.includes("UPDATE venture_journey_stages SET status = 'completed'"))).toBe(true);
    // The stage closed, so the next locked Journey is activated.
    expect(out.journey_completed).toBe(true);
    expect(out.journey).toMatchObject({ id: STAGE, name: "Ideation" });
  });

  test("a scoped reviewer without completion authority stops at in_progress", async () => {
    const { db, calls } = fakeDb({ deliverables: [{ approval_status: "approved" }] });
    const out = await syncMilestoneStatusFromDeliverables(db, { dbId: DB, milestoneId: MS, canComplete: false });
    expect(out).toEqual({ changed: true, status: "in_progress" });
    expect(statusUpdate(calls).args[0]).toBe("in_progress");
    expect(calls.some((call) => call.sql.includes("status = 'completed'"))).toBe(false);
  });

  test("a locked milestone is unreleased planning — the work never releases it", async () => {
    const { db, calls } = fakeDb({ milestoneStatus: "locked", deliverables: [{ status: "submitted" }] });
    const out = await syncMilestoneStatusFromDeliverables(db, { dbId: DB, milestoneId: MS, canComplete: true });
    expect(out).toEqual({ changed: false, status: "locked" });
    expect(statusUpdate(calls)).toBeUndefined();
  });

  test("a completed milestone is never reopened by later evidence", async () => {
    const { db, calls } = fakeDb({ milestoneStatus: "completed", deliverables: [{ approval_status: "rejected" }] });
    const out = await syncMilestoneStatusFromDeliverables(db, { dbId: DB, milestoneId: MS, canComplete: true });
    expect(out).toEqual({ changed: false, status: "completed" });
    expect(statusUpdate(calls)).toBeUndefined();
  });

  test("an unknown milestone changes nothing", async () => {
    const { db, calls } = fakeDb({ milestoneStatus: null });
    const out = await syncMilestoneStatusFromDeliverables(db, { dbId: DB, milestoneId: MS });
    expect(out).toEqual({ changed: false, status: null });
    expect(statusUpdate(calls)).toBeUndefined();
  });
});
