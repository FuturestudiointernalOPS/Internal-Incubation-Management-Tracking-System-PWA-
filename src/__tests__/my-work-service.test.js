/**
 * my-work — the founder's queue, and the rules it is not allowed to bend.
 *
 * These tests pin the decisions the endpoint makes, not the database's contents:
 * an owner is an IDENTITY (a name without a cid is never claimed), sealed work
 * stays sealed for the Venture, a calendar bucket never invents a deadline, work
 * with a reviewer is never presented as work the founder still owes, and every
 * count is the length of the list returned beside it.
 */
jest.mock("@/models/workItems", () => ({
  selectWorkJourneyStages: jest.fn(),
  selectWorkMilestones: jest.fn(),
  selectWorkTasks: jest.fn(),
  selectWorkDeliverables: jest.fn(),
  selectWorkSubmissions: jest.fn(),
}));

jest.mock("@/models/ventureWorkspace/journeyAndReports/calendar", () => ({
  listUpcomingVentureFacingSessions: jest.fn(),
}));

import {
  selectWorkJourneyStages,
  selectWorkMilestones,
  selectWorkTasks,
  selectWorkDeliverables,
  selectWorkSubmissions,
} from "@/models/workItems";
import { listUpcomingVentureFacingSessions } from "@/models/ventureWorkspace/journeyAndReports/calendar";
import { buildMyWork, DUE_SOON_DAYS } from "@/services/ventures/myWork";

const TODAY = "2026-10-21";
const ME = "CID_ME";
const HREF = "/participant/ventures/VNT-TEST";

const STAGE = { id: "s-1", name: "Market Expansion", stage_order: 1, status: "active", start_date: null, target_date: null };

const MILESTONE = {
  id: "m-1",
  title: "Market Expansion",
  status: "in_progress",
  owner_cid: null,
  owner_name: null,
  journey_stage_id: "s-1",
  start_date: "2026-10-01",
  finish_date: "2026-10-23",
};

const MY_TASK = {
  id: 41,
  milestone_id: "m-1",
  title: "Run 20 customer interviews",
  status: "in_progress",
  assigned_cid: ME,
  assigned_name: "Awa",
  source_ref: "MS-01",
  start_date: null,
  // 11 days ago — overdue.
  finish_date: "2026-10-10",
};

const EXTERNAL_TASK = {
  id: 42,
  milestone_id: "m-1",
  title: "Draft the pricing sheet",
  status: "todo",
  assigned_cid: null,
  assigned_name: "Amina",
  source_ref: "MS-02",
  start_date: null,
  // Inside the seven-day window.
  finish_date: "2026-10-24",
};

const LATER_TASK = {
  ...EXTERNAL_TASK,
  id: 43,
  title: "Prepare the partner deck",
  source_ref: "MS-03",
  // 8 days out — one day past the window.
  finish_date: "2026-10-29",
};

const UNDATED_TASK = {
  ...EXTERNAL_TASK,
  id: 44,
  title: "Explain our north-star metric",
  source_ref: "MS-04",
  finish_date: null,
};

function deliverable(overrides = {}) {
  return {
    id: 77,
    milestone_id: "m-1",
    task_id: 41,
    title: "Interview transcript bundle",
    status: "submitted",
    approval_status: null,
    assigned_cid: ME,
    assigned_name: "Awa",
    rejection_reason: null,
    reviewer_name: "A Lead",
    finish_date: "2026-10-25",
    ...overrides,
  };
}

function submission(overrides = {}) {
  return {
    id: 900,
    task_id: 41,
    version: 2,
    status: "submitted",
    review_decision: null,
    review_comment: null,
    reviewed_at: null,
    submitted_by: ME,
    submitted_by_name: "Awa",
    created_at: "2026-10-20T08:00:00Z",
    ...overrides,
  };
}

function mockReads({
  stages = [STAGE],
  milestones = [MILESTONE],
  tasks = [MY_TASK, EXTERNAL_TASK, LATER_TASK, UNDATED_TASK],
  deliverables = [],
  submissions = [],
  sessions = [],
} = {}) {
  selectWorkJourneyStages.mockResolvedValue({ rows: stages });
  selectWorkMilestones.mockResolvedValue({ rows: milestones });
  selectWorkTasks.mockResolvedValue({ rows: tasks });
  selectWorkDeliverables.mockResolvedValue({ rows: deliverables });
  selectWorkSubmissions.mockResolvedValue({ rows: submissions });
  listUpcomingVentureFacingSessions.mockResolvedValue({ rows: sessions });
}

const read = (overrides = {}) =>
  buildMyWork({
    dbId: "db-1",
    ventureCode: "VNT-TEST",
    viewerCid: ME,
    unsealed: false,
    workspaceHref: HREF,
    now: new Date(`${TODAY}T09:00:00Z`),
    ...overrides,
  });

const ids = (list) => list.map((item) => item.id);

beforeEach(() => jest.clearAllMocks());

describe("personal work is an identity, not a name", () => {
  it("claims only records whose owner carries the caller's cid", async () => {
    mockReads();
    const work = await read();

    expect(ids(work.personal.overdue)).toEqual(["task:41"]);
    // The external owner's work is never claimed on their behalf…
    expect(ids(work.personal.due_soon)).toEqual([]);
    // …it stays venture-wide work, with the name and no identity.
    const external = work.venture.due_soon.find((item) => item.record_id === 42);
    expect(external.owner).toEqual({ cid: null, name: "Amina", external: true });
  });

  it("partitions the queue: no record is reported in both lists", async () => {
    mockReads();
    const work = await read();

    const personalIds = new Set(
      ["overdue", "due_soon", "awaiting_my_action", "returned_for_changes", "awaiting_review"].flatMap((key) =>
        ids(work.personal[key]),
      ),
    );
    const ventureIds = ["overdue", "due_soon", "awaiting_review"].flatMap((key) => ids(work.venture[key]));

    expect(ventureIds.filter((id) => personalIds.has(id))).toEqual([]);
  });
});

describe("calendar buckets", () => {
  it("puts a past deadline in overdue and an inside-the-window one in due_soon", async () => {
    mockReads();
    const work = await read();

    expect(work.rules.due_soon_days).toBe(DUE_SOON_DAYS);
    // Overdue work is the caller's own here, so it is reported as PERSONAL.
    expect(ids(work.personal.overdue)).toContain("task:41");
    expect(ids(work.venture.due_soon)).toContain("task:42");
  });

  it("stops at the seven-day window", async () => {
    mockReads();
    const work = await read();

    expect(ids(work.venture.due_soon)).not.toContain("task:43");
    expect(ids(work.venture.overdue)).not.toContain("task:43");
  });

  it("never invents a deadline for undated work", async () => {
    mockReads();
    const work = await read();

    expect(ids(work.venture.overdue)).not.toContain("task:44");
    expect(ids(work.venture.due_soon)).not.toContain("task:44");
    expect(work.venture.due_soon.find((item) => item.record_id === 44)).toBeUndefined();
  });

  it("excludes completed work from overdue", async () => {
    mockReads({ tasks: [{ ...MY_TASK, status: "done" }, EXTERNAL_TASK] });
    const work = await read();

    expect(ids(work.venture.overdue)).not.toContain("task:41");
    expect(ids(work.personal.overdue)).toEqual([]);
  });

  it("excludes cancelled work from every bucket", async () => {
    mockReads({ tasks: [{ ...MY_TASK, status: "cancelled" }] });
    const work = await read();

    expect(ids(work.personal.overdue)).toEqual([]);
    expect(ids(work.personal.awaiting_my_action)).toEqual([]);
    expect(ids(work.venture.due_soon)).not.toContain("task:41");
  });
});

describe("review states", () => {
  it("returns a submission sent back for changes, with the reviewer's words", async () => {
    mockReads({
      submissions: [
        submission({ review_decision: "changes_requested", review_comment: "Add the interview dates." }),
      ],
    });
    const work = await read();

    const returned = work.personal.returned_for_changes[0];
    expect(returned.id).toBe("task:41");
    expect(returned.submission).toEqual({
      id: 900,
      version: 2,
      state: "changes_requested",
      submitted_at: "2026-10-20T08:00:00Z",
      reviewed_at: null,
      feedback: "Add the interview dates.",
    });
    // Returned work is still actionable.
    expect(ids(work.personal.awaiting_my_action)).toContain("task:41");
  });

  it("never names the reviewer on a founder's record", async () => {
    mockReads({ submissions: [submission({ review_decision: "changes_requested", review_comment: "Redo it." })] });
    const work = await read();

    const record = work.personal.returned_for_changes[0];
    expect(JSON.stringify(record)).not.toContain("reviewed_by");
  });

  it("keeps work that is with a reviewer out of awaiting_my_action", async () => {
    mockReads({ deliverables: [deliverable()] });
    const work = await read();

    expect(ids(work.personal.awaiting_review)).toEqual(["deliverable:77"]);
    expect(ids(work.personal.awaiting_my_action)).not.toContain("deliverable:77");
    // …but the task behind it has no submission at all, so it IS still owed.
    expect(ids(work.personal.awaiting_my_action)).toContain("task:41");
  });

  it("treats a deliverable returned for changes as actionable again", async () => {
    mockReads({
      deliverables: [deliverable({ approval_status: "rejected", rejection_reason: "Missing the cost table." })],
    });
    const work = await read();

    const returned = work.personal.returned_for_changes[0];
    expect(returned.submission.state).toBe("changes_requested");
    expect(returned.submission.feedback).toBe("Missing the cost table.");
    expect(ids(work.personal.awaiting_my_action)).toContain("deliverable:77");
    expect(ids(work.personal.awaiting_review)).toEqual([]);
  });

  it("does not count approved evidence as awaiting anything", async () => {
    mockReads({ deliverables: [deliverable({ status: "completed", approval_status: "approved" })] });
    const work = await read();

    expect(ids(work.personal.awaiting_review)).toEqual([]);
    expect(ids(work.personal.awaiting_my_action)).not.toContain("deliverable:77");
    expect(ids(work.personal.returned_for_changes)).toEqual([]);
  });
});

describe("sealed work", () => {
  const upcoming = { ...MILESTONE, id: "m-2", title: "Series A readiness", status: "upcoming" };
  const sealedTask = { ...MY_TASK, id: 50, milestone_id: "m-2", title: "Build the data room" };
  const sealedDeliverable = deliverable({ id: 90, milestone_id: "m-2" });

  it("withholds a member's unreleased planning", async () => {
    mockReads({ milestones: [MILESTONE, upcoming], tasks: [MY_TASK, sealedTask], deliverables: [sealedDeliverable] });
    const work = await read();

    const everything = [
      ...work.personal.overdue,
      ...work.personal.due_soon,
      ...work.personal.awaiting_my_action,
      ...work.personal.returned_for_changes,
      ...work.personal.awaiting_review,
      ...work.venture.overdue,
      ...work.venture.due_soon,
      ...work.venture.awaiting_review,
    ];
    expect(ids(everything)).not.toContain("task:50");
    expect(ids(everything)).not.toContain("deliverable:90");
    expect(ids(everything)).not.toContain("milestone:m-2");
  });

  it("shows staff the unreleased planning", async () => {
    mockReads({ milestones: [MILESTONE, upcoming], tasks: [MY_TASK, sealedTask] });
    const work = await read({ unsealed: true });

    expect(ids(work.personal.overdue)).toContain("task:50");
  });
});

describe("counts", () => {
  it("derives every count from the list returned beside it", async () => {
    mockReads({
      deliverables: [deliverable()],
      submissions: [submission({ review_decision: "changes_requested", review_comment: "Again." })],
    });
    const work = await read();

    for (const section of ["personal", "venture"]) {
      for (const key of ["overdue", "due_soon", "awaiting_review", "returned_for_changes"]) {
        expect(work[section].counts[key]).toBe(work[section][key].length);
      }
    }
    expect(work.personal.counts.awaiting_my_action).toBe(work.personal.awaiting_my_action.length);
  });

  it("counts total_open once per record, not once per bucket", async () => {
    mockReads({ submissions: [submission({ review_decision: "changes_requested", review_comment: "Again." })] });
    const work = await read();

    // task 41 appears in overdue AND returned_for_changes, but is one open item.
    expect(work.personal.counts.total_open).toBe(1);
    expect(work.personal.counts.overdue).toBe(1);
    expect(work.personal.counts.returned_for_changes).toBe(1);
  });
});

describe("an empty queue and a broken read are not the same answer", () => {
  it("reports a failed source instead of pretending there is no work", async () => {
    mockReads();
    selectWorkTasks.mockRejectedValue(new Error("column does not exist"));

    const work = await read();

    expect(work.source.complete).toBe(false);
    expect(work.source.failed_reads).toEqual(["tasks"]);
  });

  it("says the sources are complete when they all answered", async () => {
    mockReads();
    const work = await read();

    expect(work.source).toEqual({ complete: true, failed_reads: [] });
    expect(work.personal.counts.total_open).toBe(1);
  });
});

describe("next pointers", () => {
  it("picks the soonest open milestone and the next venture-facing session", async () => {
    mockReads({
      sessions: [
        { id: 5, title: "Weekly check-in", session_type: "check_in", status: "scheduled", start_time: "2026-10-22T10:00:00", journey_stage_id: "s-1" },
      ],
    });
    const work = await read();

    expect(work.venture.next_milestone).toMatchObject({
      id: "m-1",
      title: "Market Expansion",
      target_date: "2026-10-23",
      journey: { id: "s-1", name: "Market Expansion" },
    });
    expect(work.venture.next_session).toMatchObject({ id: 5, title: "Weekly check-in" });
    expect(work.venture.upcoming_sessions).toHaveLength(1);
  });

  it("returns null rather than an invented next item", async () => {
    mockReads({ milestones: [], tasks: [] });
    const work = await read();

    expect(work.venture.next_milestone).toBeNull();
    expect(work.venture.next_session).toBeNull();
  });
});
