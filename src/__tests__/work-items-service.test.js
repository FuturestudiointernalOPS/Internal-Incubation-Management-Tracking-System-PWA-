/**
 * The work-item layer — the management view's one source of meaning.
 *
 * These tests pin the rules the Projects view is NOT allowed to re-decide: one
 * authoritative owner, support that never becomes an owner, an external name
 * that stays a name, calendar buckets derived from dates, and the absence of
 * percentage progress. They read through a mocked model, so they describe the
 * service's decisions rather than a database's contents.
 */
jest.mock("@/models/workItems", () => ({
  selectWorkJourneyStages: jest.fn(),
  selectWorkMilestones: jest.fn(),
  selectWorkTasks: jest.fn(),
  selectWorkDeliverables: jest.fn(),
  selectWorkDependencyEdges: jest.fn(),
}));

import {
  selectWorkJourneyStages,
  selectWorkMilestones,
  selectWorkTasks,
  selectWorkDeliverables,
  selectWorkDependencyEdges,
} from "@/models/workItems";
import { buildWorkItems } from "@/services/workItems";

const TODAY = "2026-10-15";

const STAGE = {
  id: "s-1",
  name: "KoraHome Market Expansion",
  stage_order: 1,
  status: "active",
};

// MS-01 — an activity owned by Amina, supported by David and Grace.
const MILESTONE = {
  id: "300",
  title: "Market Expansion",
  status: "not_started",
  owner_cid: null,
  owner_name: null,
  support_name: null,
  journey_stage_id: "s-1",
  start_date: "2026-10-12",
  finish_date: "2026-10-23",
};

const TASK = {
  id: 41,
  milestone_id: "300",
  title: "Validate Côte d'Ivoire market demand",
  status: "in_progress",
  assigned_cid: null,
  assigned_name: "Amina",
  support_name: "David, Grace",
  definition_of_done: "Report contains at least 20 customer interviews.",
  source_ref: "MS-01",
  start_date: "2026-10-12",
  finish_date: "2026-10-23",
};

const DELIVERABLE = {
  id: 77,
  milestone_id: "300",
  task_id: 41,
  title: "Côte d'Ivoire market validation report",
  status: "pending",
  approval_status: "pending",
  assigned_cid: null,
  assigned_name: "Amina",
  finish_date: "2026-10-23",
};

function mockReads({ stages = [STAGE], milestones = [MILESTONE], tasks = [TASK], deliverables = [DELIVERABLE], edges = [] } = {}) {
  selectWorkJourneyStages.mockResolvedValue({ rows: stages });
  selectWorkMilestones.mockResolvedValue({ rows: milestones });
  selectWorkTasks.mockResolvedValue({ rows: tasks });
  selectWorkDeliverables.mockResolvedValue({ rows: deliverables });
  selectWorkDependencyEdges.mockResolvedValue({ rows: edges });
}

const read = () => buildWorkItems({ dbId: "db-1", ventureCode: "VNT-TEST", now: new Date(`${TODAY}T09:00:00Z`) });

beforeEach(() => jest.clearAllMocks());

describe("one authoritative owner", () => {
  it("shows the activity's owner on the milestone rather than an empty one", async () => {
    mockReads();
    const { items } = await read();

    const milestone = items.find((item) => item.kind === "milestone");
    const activity = items.find((item) => item.kind === "activity");
    // The source named ONE owner. Both levels must say the same name.
    expect(milestone.owner.name).toBe("Amina");
    expect(activity.owner.name).toBe("Amina");
    expect(milestone.owner.name).toBe(activity.owner.name);
  });

  it("keeps a milestone's own stated owner when the source gave one", async () => {
    mockReads({ milestones: [{ ...MILESTONE, owner_cid: "USR_DAVID", owner_name: "David" }] });
    const { items } = await read();

    expect(items.find((item) => item.kind === "milestone").owner.name).toBe("David");
  });

  it("carries the same owner onto the deliverable", async () => {
    mockReads();
    const { items } = await read();

    const deliverable = items.find((item) => item.kind === "deliverable");
    const activity = items.find((item) => item.kind === "activity");
    expect(deliverable.owner.name).toBe(activity.owner.name);
  });
});

describe("support never becomes an owner", () => {
  it("keeps David and Grace as supporting, with Amina still the owner", async () => {
    mockReads();
    const { items } = await read();

    const activity = items.find((item) => item.kind === "activity");
    expect(activity.owner.name).toBe("Amina");
    expect(activity.supporting).toBe("David, Grace");
    expect(activity.supporting_names).toEqual(["David", "Grace"]);
    expect(activity.owner.name).not.toBe("David");
  });
});

describe("external people stay names", () => {
  it("flags an owner with no platform account as external", async () => {
    mockReads();
    const { items } = await read();

    const activity = items.find((item) => item.kind === "activity");
    expect(activity.owner).toEqual({ name: "Amina", cid: null, external: true });
  });

  it("does not flag an owner that resolves to a contact", async () => {
    mockReads({ tasks: [{ ...TASK, assigned_cid: "USR_AMINA" }] });
    const { items } = await read();

    const activity = items.find((item) => item.kind === "activity");
    expect(activity.owner).toEqual({ name: "Amina", cid: "USR_AMINA", external: false });
  });
});

describe("the tracker's own facts travel intact", () => {
  it("carries the source reference, the Definition of Done and the chain", async () => {
    mockReads();
    const { items } = await read();

    const activity = items.find((item) => item.kind === "activity");
    expect(activity.ref).toBe("MS-01");
    expect(activity.activity).toBe("Validate Côte d'Ivoire market demand");
    expect(activity.deliverable).toBe("Côte d'Ivoire market validation report");
    expect(activity.definition_of_done).toBe("Report contains at least 20 customer interviews.");
  });

  it("gives the deliverable its Activity and Definition of Done", async () => {
    mockReads();
    const { items } = await read();

    const deliverable = items.find((item) => item.kind === "deliverable");
    expect(deliverable.activity).toBe("Validate Côte d'Ivoire market demand");
    expect(deliverable.definition_of_done).toBe("Report contains at least 20 customer interviews.");
    expect(deliverable.ref).toBe("MS-01");
  });

  it("never exposes percentage progress", async () => {
    mockReads({ milestones: [{ ...MILESTONE, progress: 62, completion_percentage: 62 }] });
    const { items } = await read();

    for (const item of items) {
      expect(item).not.toHaveProperty("progress");
      expect(item).not.toHaveProperty("completion_percentage");
    }
  });
});

describe("buckets are calendar facts about the finish date", () => {
  const withFinish = (finish, status = "in_progress") => ({
    tasks: [{ ...TASK, finish_date: finish, start_date: "2026-10-01", status }],
    deliverables: [{ ...DELIVERABLE, finish_date: finish }],
    milestones: [{ ...MILESTONE, finish_date: finish }],
  });

  it("puts a past finish that is not complete in Overdue", async () => {
    mockReads(withFinish("2026-10-14"));
    const { items } = await read();

    expect(items.find((item) => item.kind === "activity").bucket).toBe("overdue");
  });

  it("puts a finish of today in Today", async () => {
    mockReads(withFinish(TODAY));
    const { items } = await read();

    expect(items.find((item) => item.kind === "activity").bucket).toBe("today");
  });

  it("puts a future finish in Upcoming", async () => {
    mockReads(withFinish("2026-11-30"));
    const { items } = await read();

    expect(items.find((item) => item.kind === "activity").bucket).toBe("upcoming");
  });

  it("puts a completed activity in Completed even when it finished late", async () => {
    mockReads(withFinish("2026-10-01", "done"));
    const { items } = await read();

    const activity = items.find((item) => item.kind === "activity");
    expect(activity.is_complete).toBe(true);
    expect(activity.bucket).toBe("completed");
  });

  it("counts every bucket in the summary", async () => {
    mockReads(withFinish("2026-10-14"));
    const { summary } = await read();

    expect(summary.total).toBe(3);
    expect(summary.overdue).toBe(3);
    expect(summary.today + summary.upcoming + summary.completed).toBe(0);
  });
});

describe("dependencies are labelled, in the direction the work reads", () => {
  it("says what an item depends on and what it blocks", async () => {
    mockReads({
      tasks: [
        { ...TASK, id: 41, title: "First", source_ref: "MS-01", finish_date: "2026-10-20" },
        { ...TASK, id: 42, title: "Second", source_ref: "MS-02", finish_date: "2026-10-25" },
      ],
      deliverables: [],
      edges: [{ source_type: "task", source_id: "41", target_type: "task", target_id: "42" }],
    });
    const { items } = await read();

    const second = items.find((item) => item.id === "activity:42");
    const first = items.find((item) => item.id === "activity:41");
    expect(second.depends_on).toEqual([{ id: "activity:41", label: "MS-01" }]);
    expect(first.blocks).toEqual([{ id: "activity:42", label: "MS-02" }]);
  });
});

describe("filter options come from the loaded work", () => {
  it("lists the owners, supporting people, journeys and statuses actually present", async () => {
    mockReads();
    const { options } = await read();

    expect(options.owners).toEqual(["Amina"]);
    expect(options.supporting).toEqual(["David", "Grace"]);
    expect(options.journeys).toEqual([{ id: "s-1", name: "KoraHome Market Expansion" }]);
    expect(options.milestones.map((milestone) => milestone.title)).toEqual(["Market Expansion"]);
    expect(options.statuses.length).toBeGreaterThan(0);
  });
});

describe("an unreadable source degrades honestly", () => {
  it("still returns the work it could read, with no items invented", async () => {
    mockReads();
    selectWorkDeliverables.mockRejectedValue(new Error("column does not exist"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { items } = await read();

    expect(items.some((item) => item.kind === "activity")).toBe(true);
    expect(items.some((item) => item.kind === "deliverable")).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
