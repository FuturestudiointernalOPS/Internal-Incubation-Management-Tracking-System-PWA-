/**
 * Unit tests — Venture-facing roadmap visibility projection.
 *
 * The rule these pin down (see src/lib/ventureVisibility.js):
 *   the MAP is always complete; the WORK inside a not-yet-released item is not.
 *
 * Both /journey and /milestones read this projection, so a regression here is
 * a leak on every member surface at once.
 */

import {
  SEALED_MILESTONE_STATUS,
  projectMilestoneForVenture,
  projectMilestonesForVenture,
  projectJourneyStageForVenture,
  projectJourneyStagesForVenture,
} from "@/lib/ventureVisibility";

const upcomingMilestone = () => ({
  id: "m3",
  title: "Financial Model",
  description: "Build the model",
  objective: "Know the numbers",
  status: SEALED_MILESTONE_STATUS,
  progress: 0,
  priority: "medium",
  target_date: "2026-06-30",
  display_order: 2,
  journey_stage_id: "s2",
  deliverables: [{ id: "d2", title: "Model seed" }],
});

const openMilestone = () => ({
  id: "m2",
  title: "Customer Validation",
  description: "Twenty interviews",
  objective: "Prove demand",
  status: "in_progress",
  progress: 40,
  target_date: "2026-04-30",
  display_order: 1,
  journey_stage_id: "s2",
  deliverables: [{ id: "d1", title: "Validation report" }],
});

describe("projectMilestoneForVenture", () => {
  test("a member gets a not-yet-released milestone sealed down to the map", () => {
    const sealed = projectMilestoneForVenture(upcomingMilestone());
    expect(sealed).toEqual({
      id: "m3",
      title: "Financial Model",
      status: "upcoming",
      display_order: 2,
      target_date: "2026-06-30",
      journey_stage_id: "s2",
      sealed: true,
      deliverables: [],
    });
    expect(sealed.description).toBeUndefined();
    expect(sealed.objective).toBeUndefined();
    expect(sealed.progress).toBeUndefined();
    expect(sealed.priority).toBeUndefined();
    expect(sealed.deliverables).toEqual([]);
  });

  test("a staff actor sees the same milestone whole", () => {
    const open = projectMilestoneForVenture(upcomingMilestone(), { unsealed: true });
    expect(open.sealed).toBe(false);
    expect(open.description).toBe("Build the model");
    expect(open.deliverables).toHaveLength(1);
  });

  test("a member is NOT sealed out of released work", () => {
    const open = projectMilestoneForVenture(openMilestone());
    expect(open.sealed).toBe(false);
    expect(open.description).toBe("Twenty interviews");
    expect(open.progress).toBe(40);
    expect(open.deliverables).toHaveLength(1);
  });

  test("only an unreleased milestone seals — a BLOCKED one is reachable work", () => {
    // `blocked` (a dependency is unmet) is a known piece of the roadmap the
    // Venture simply cannot start yet: its detail stays visible.
    for (const status of ["blocked", "not_started", "in_progress", "under_review", "completed"]) {
      const projected = projectMilestoneForVenture({ id: "x", status, description: "kept" });
      expect(projected.sealed).toBe(false);
      expect(projected.description).toBe("kept");
    }
  });

  test("an absent milestone stays absent rather than becoming an empty object", () => {
    expect(projectMilestoneForVenture(null)).toBeNull();
    expect(projectMilestoneForVenture(undefined)).toBeUndefined();
  });

  test("the list form maps every row", () => {
    const rows = projectMilestonesForVenture([openMilestone(), upcomingMilestone()]);
    expect(rows.map((row) => row.sealed)).toEqual([false, true]);
  });
});

describe("projectJourneyStageForVenture", () => {
  const stage = () => ({
    id: "s2",
    name: "Go-To-Market",
    description: "Find the first ten customers",
    objective: "Repeatable sales",
    status: "active",
    stage_order: 2,
    milestones: [openMilestone(), upcomingMilestone()],
  });

  test("counts are computed over EVERY milestone, not just the visible ones", () => {
    const projected = projectJourneyStageForVenture(stage());
    expect(projected.milestone_counts).toEqual({ total: 2, completed: 0 });
    expect(projected.sealed).toBe(false);
    expect(projected.description).toBe("Find the first ten customers");
    expect(projected.milestones.map((milestone) => milestone.sealed)).toEqual([false, true]);
  });

  test("a completed milestone is counted as completed", () => {
    const projected = projectJourneyStageForVenture({
      ...stage(),
      milestones: [{ id: "m1", status: "completed" }, upcomingMilestone()],
    });
    expect(projected.milestone_counts).toEqual({ total: 2, completed: 1 });
  });

  test("an unreleased Journey is named but its planning is withheld", () => {
    const projected = projectJourneyStageForVenture({
      ...stage(),
      status: "upcoming",
      milestones: [upcomingMilestone()],
    });
    expect(projected.name).toBe("Go-To-Market");
    expect(projected.sealed).toBe(true);
    expect(projected.description).toBeUndefined();
    expect(projected.objective).toBeUndefined();
    // The real count still stands, even though the Journey is sealed.
    expect(projected.milestone_counts).toEqual({ total: 1, completed: 0 });
  });

  test("a staff actor receives the stage and its milestones whole", () => {
    const projected = projectJourneyStageForVenture(stage(), { unsealed: true });
    expect(projected.sealed).toBe(false);
    expect(projected.description).toBe("Find the first ten customers");
    expect(projected.milestones.map((milestone) => milestone.sealed)).toEqual([false, false]);
    expect(projected.milestones[1].description).toBe("Build the model");
  });

  test("a stage with no milestones counts zero rather than throwing", () => {
    const projected = projectJourneyStageForVenture({ id: "s9", status: "active" });
    expect(projected.milestones).toEqual([]);
    expect(projected.milestone_counts).toEqual({ total: 0, completed: 0 });
  });

  test("the stages form maps every stage", () => {
    const rows = projectJourneyStagesForVenture([stage(), { id: "s3", status: "upcoming", milestones: [] }]);
    expect(rows.map((stageRow) => stageRow.sealed)).toEqual([false, true]);
  });
});
