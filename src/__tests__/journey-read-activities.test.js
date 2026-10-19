/**
 * Journey read — a milestone exposes its ACTIVITIES (tasks), not only the
 * deliverables.
 *
 * A session is booked against an activity, so the read must carry the whole work
 * list of the milestone or the booking form could only offer the few activities
 * that happen to produce a deliverable.
 */
jest.mock("@/models/ventureJourney", () => ({
  listJourneyMilestonesByStage: jest.fn(),
  listJourneyMilestonesByStageLegacy: jest.fn(),
  listJourneyDeliverablesByMilestoneIds: jest.fn(),
  listJourneyTasksByMilestoneIds: jest.fn(),
  listJourneyTaskStatusesByMilestoneIds: jest.fn(),
  listJourneyTaskStatusesByMilestoneIdsLegacy: jest.fn(),
  getJourneyTemplateName: jest.fn(),
}));

const models = require("@/models/ventureJourney");
const { attachJourneyWork } = require("@/services/ventures/journeyRead");

beforeEach(() => jest.clearAllMocks());

test("exposes each milestone's activities (tasks) to the read", async () => {
  models.listJourneyMilestonesByStage.mockResolvedValue({
    rows: [{ id: 10, journey_stage_id: "s1", status: "active" }],
  });
  models.listJourneyDeliverablesByMilestoneIds.mockResolvedValue({ rows: [] });
  models.listJourneyTaskStatusesByMilestoneIds.mockResolvedValue({
    rows: [{ milestone_id: 10, status: "done" }],
  });
  models.listJourneyTasksByMilestoneIds.mockResolvedValue({
    rows: [
      { id: 101, milestone_id: 10, title: "Interview customers", source_ref: "MS-01", assigned_name: "Amina", due_date: "2026-11-01", status: "in_progress" },
      { id: 102, milestone_id: 11, title: "Other milestone's work" },
    ],
  });

  const stages = [{ id: "s1" }];
  await attachJourneyWork({ ventureParam: "VNT-1", dbId: "db", stages, signEvidence: async () => {} });

  const milestone = stages[0].milestones[0];
  expect(milestone.activities).toHaveLength(1);
  expect(milestone.activities[0]).toMatchObject({
    id: 101,
    title: "Interview customers",
    source_ref: "MS-01",
    owner_name: "Amina",
    due_date: "2026-11-01",
  });
});

/**
 * The milestone view renders one ACTIVITY block per group — Definition of Done,
 * supporting people, start date — from THIS list. It used to carry only the
 * booking fields, so a milestone whose imported activity HAD a Definition of Done
 * still read "Not provided": the activity reached the screen twice, complete
 * through its deliverable and bare through its milestone, and the bare copy won
 * the grouping.
 */
test("an activity carries the facts the milestone view renders, Definition of Done included", async () => {
  models.listJourneyMilestonesByStage.mockResolvedValue({
    rows: [{ id: 10, journey_stage_id: "s1", status: "active" }],
  });
  models.listJourneyDeliverablesByMilestoneIds.mockResolvedValue({ rows: [] });
  models.listJourneyTaskStatusesByMilestoneIds.mockResolvedValue({ rows: [] });
  models.listJourneyTasksByMilestoneIds.mockResolvedValue({
    rows: [
      {
        id: 101,
        milestone_id: 10,
        title: "Run 12–15 structured interviews with WAEMU merchants",
        source_ref: "MS-01",
        assigned_name: "Josias",
        support_name: "Charles, Godwin",
        start_date: "2026-09-30",
        due_date: "2026-10-20",
        status: "backlog",
        definition_of_done: "12+ completed interviews logged; memo circulated to Charles and the Future Studio team",
      },
    ],
  });

  const stages = [{ id: "s1" }];
  await attachJourneyWork({ ventureParam: "VNT-1", dbId: "db", stages, signEvidence: async () => {} });

  const [activity] = stages[0].milestones[0].activities;
  expect(activity.definition_of_done).toBe(
    "12+ completed interviews logged; memo circulated to Charles and the Future Studio team",
  );
  expect(activity.support_name).toBe("Charles, Godwin");
  expect(activity.start_date).toBe("2026-09-30");
});
