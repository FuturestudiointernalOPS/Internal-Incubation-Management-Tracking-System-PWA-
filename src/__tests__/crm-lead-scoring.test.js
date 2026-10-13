/**
 * CRM — computed lead score and segment membership (pure decision logic).
 */

jest.mock("@/models/crm/leads", () => ({ getCrmLeads: jest.fn(), updateCrmLead: jest.fn() }));
jest.mock("@/models/crm/opportunities", () => ({ getCrmOpportunities: jest.fn(), updateCrmOpportunity: jest.fn() }));
jest.mock("@/models/crm/intelligence", () => ({}));
jest.mock("@/models/crm/activities", () => ({}));
jest.mock("@/models/tasks/writes", () => ({}));

const { computeLeadScore, MAX_LEAD_SCORE } = require("@/services/crm/leadScoring");
const { resolveSegmentMembers, segmentConditions } = require("@/services/crm/segments");
const { getCrmLeads } = require("@/models/crm/leads");
const { getCrmOpportunities } = require("@/models/crm/opportunities");

const NOW = new Date("2026-10-13T12:00:00Z");
const daysAgo = (days) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const points = (result, key) => result.breakdown.find((rule) => rule.key === key).points;

describe("computeLeadScore", () => {
  test("a bare new lead scores nothing", () => {
    const result = computeLeadScore({ status: "new", qualification_state: "not_assessed" }, [], NOW);
    expect(result.score).toBe(0);
    expect(result.breakdown.map((rule) => rule.key)).toEqual([
      "qualification", "status", "profile", "engagement", "positiveOutcomes", "recency",
    ]);
  });

  test("each recorded fact adds its points and the total is their sum", () => {
    const lead = {
      status: "engaged",
      qualification_state: "in_review",
      organization_id: "org-1",
      source: "inbound",
      description: "Inbound partnership offer",
    };
    const activities = [
      { activity_type: "call", outcome: "positive", activity_date: daysAgo(2) },
      { activity_type: "task", outcome: "pending", activity_date: daysAgo(-3) },
    ];
    const result = computeLeadScore(lead, activities, NOW);

    expect(points(result, "qualification")).toBe(15);
    expect(points(result, "status")).toBe(15);
    expect(points(result, "profile")).toBe(15);
    expect(points(result, "engagement")).toBe(10);
    expect(points(result, "positiveOutcomes")).toBe(5);
    expect(points(result, "recency")).toBe(10);
    expect(result.score).toBe(70);
  });

  test("engagement and positive outcomes are capped, and the score never exceeds 100", () => {
    const lead = {
      status: "converted",
      qualification_state: "qualified",
      organization_id: "org-1",
      contact_cid: "c-1",
      source: "referral",
      description: "x",
    };
    const activities = Array.from({ length: 9 }, () => ({ outcome: "positive", activity_date: daysAgo(1) }));
    const result = computeLeadScore(lead, activities, NOW);

    expect(points(result, "engagement")).toBe(20);
    expect(points(result, "positiveOutcomes")).toBe(10);
    expect(result.score).toBe(MAX_LEAD_SCORE);
  });

  test("recency fades: 10 within two weeks, 5 within a month, then nothing", () => {
    const lead = { status: "new", qualification_state: "not_assessed" };
    expect(points(computeLeadScore(lead, [{ activity_date: daysAgo(10) }], NOW), "recency")).toBe(10);
    expect(points(computeLeadScore(lead, [{ activity_date: daysAgo(20) }], NOW), "recency")).toBe(5);
    expect(points(computeLeadScore(lead, [{ activity_date: daysAgo(45) }], NOW), "recency")).toBe(0);
    // A task due in the future has not happened yet.
    expect(points(computeLeadScore(lead, [{ activity_date: daysAgo(-5) }], NOW), "recency")).toBe(0);
  });
});

describe("segment membership", () => {
  const leads = [
    { id: "l-1", title: "MTN", status: "qualified", score: 85 },
    { id: "l-2", title: "Moov", status: "new", score: 20 },
  ];

  beforeEach(() => {
    getCrmLeads.mockResolvedValue({ rows: leads });
    getCrmOpportunities.mockResolvedValue({ rows: [{ id: "o-1", name: "Deal", value: 500 }] });
  });

  test("a segment contains the records matching all of its conditions", async () => {
    const members = await resolveSegmentMembers({
      entity_type: "lead",
      conditions: [
        { field: "status", operator: "equals", value: "qualified" },
        { field: "score", operator: "greater_than_or_equal", value: 80 },
      ],
    });
    expect(members.map((member) => member.id)).toEqual(["l-1"]);
  });

  test("a segment without conditions contains every record of its entity type", async () => {
    expect(await resolveSegmentMembers({ entity_type: "lead", conditions: [] })).toHaveLength(2);
    const opportunities = await resolveSegmentMembers({ entity_type: "opportunity", conditions: null });
    expect(opportunities.map((member) => member.id)).toEqual(["o-1"]);
  });

  test("conditions stored as a JSON string are read the same way", () => {
    expect(segmentConditions({ conditions: '[{"field":"score","operator":"less_than","value":30}]' })).toHaveLength(1);
    expect(segmentConditions({ conditions: "not json" })).toEqual([]);
  });
});
