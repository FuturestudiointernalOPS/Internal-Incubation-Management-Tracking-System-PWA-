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
