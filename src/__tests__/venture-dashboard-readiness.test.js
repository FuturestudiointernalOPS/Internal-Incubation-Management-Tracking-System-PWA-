/**
 * Stage & Evidence Score on the Venture dashboard.
 *
 *   score = stage 40% + evidence 60%
 *
 * The evidence half is the Data Room's: the categories marked REQUIRED for the
 * Venture, each earning 1 only when approved. Nothing else feeds
 * it. With nothing required the evidence cannot be measured, so the score rests
 * on the stage alone. The answer carries the list of required categories with
 * their documents, so the percentage can show its working.
 */

const VENTURE = "VNT-408741B3";
const DB_ID = "001869dc-48ee-4c4c-bd98-579cb14a8ae2";

const mockGetVentureByCode = jest.fn(async () => ({ rows: [{ id: DB_ID }] }));
const mockGetOrCreateStartupProfile = jest.fn();
const mockGetOrCreateVerification = jest.fn();
const mockEvidence = jest.fn();
const mockListMembers = jest.fn(async () => ({ rows: [] }));
const mockSummarizeMembers = jest.fn(async () => ({ rows: [] }));

jest.mock("@/services/ventures/profile", () => ({
  getOrCreateStartupProfile: (...args) => mockGetOrCreateStartupProfile(...args),
}));

jest.mock("@/services/ventures/dataRoom/readiness", () => ({
  getRequiredEvidence: (...args) => mockEvidence(...args),
}));

jest.mock("@/services/ventures/verification", () => ({
  getOrCreateVerification: (...args) => mockGetOrCreateVerification(...args),
}));

jest.mock("@/models/ventureMembers", () => ({
  listVentureMembers: (...args) => mockListMembers(...args),
  summarizeVentureMembers: (...args) => mockSummarizeMembers(...args),
}));

jest.mock("@/models/ventureWorkspace", () => ({
  getVentureByCode: (...args) => mockGetVentureByCode(...args),
  getVentureDashboardInfo: jest.fn(async () => ({ rows: [{ business_stage: "idea" }] })),
  listVentureMemberRecipients: jest.fn(async () => ({ rows: [] })),
  selectInternalNotificationFeed: jest.fn(async () => ({ rows: [] })),
  selectVentureNotificationFeed: jest.fn(async () => ({ rows: [] })),
  listVentureActivityLog: jest.fn(async () => ({ rows: [] })),
  listVentureDocumentsForDashboard: jest.fn(async () => ({ rows: [] })),
  listVentureDocumentsForDashboardLegacy: jest.fn(async () => ({ rows: [] })),
  countVentureDocumentsForDashboard: jest.fn(async () => ({ rows: [{ count: 0 }] })),
  countVentureDocumentsForDashboardLegacy: jest.fn(async () => ({ rows: [{ count: 0 }] })),
  listVentureMeetings: jest.fn(async () => ({ rows: [] })),
  listVentureKpiSummary: jest.fn(async () => ({ rows: [] })),
  countVentureAdvisors: jest.fn(async () => ({ rows: [{ n: 0 }] })),
  countVentureCoachingSessions: jest.fn(async () => ({ rows: [{ n: 0 }] })),
  countVentureActiveCoachAssignments: jest.fn(async () => ({ rows: [{ n: 0 }] })),
}));

const { buildVentureDashboard } = require("@/services/ventures/dashboard");

const evidenceWith = (items) => {
  const count = (status) => items.filter((item) => item.status === status).length;
  const points = items.reduce((sum, item) => sum + (item.status === "verified" ? 1 : 0), 0);
  return {
    percent: items.length ? Math.round((points / items.length) * 100) : null,
    required_total: items.length,
    verified_count: count("verified"),
    awaiting_count: count("awaiting"),
    rejected_count: count("rejected"),
    missing_count: count("missing"),
    items: items.map((item, index) => ({ category: `cat_${index}`, documents: [], points: 0, ...item })),
  };
};

const readinessFor = async (stage) => {
  if (stage) {
    const workspace = require("@/models/ventureWorkspace");
    workspace.getVentureDashboardInfo.mockResolvedValueOnce({ rows: [{ business_stage: stage }] });
  }
  const dashboard = await buildVentureDashboard({ ventureParam: VENTURE, isInternalViewer: true });
  return dashboard.investment_readiness;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetOrCreateVerification.mockResolvedValue({ verification: { status: "draft" }, items: [], documents: [] });
});

describe("Stage & Evidence Score — Venture dashboard", () => {
  it("is measured against the REQUIRED documents, approved ones earning full points", async () => {
    mockEvidence.mockResolvedValue(evidenceWith([{ status: "verified" }, { status: "awaiting" }, { status: "missing" }, { status: "missing" }]));

    const readiness = await readinessFor("idea");

    // evidence 1/4 = 25% → 10 * 0.4 + 25 * 0.6 = 19
    expect(readiness.evidence_percent).toBe(25);
    expect(readiness.score).toBe(19);
    expect(readiness.evidence_measurable).toBe(true);
  });

  it("rises when a document awaiting approval is approved", async () => {
    mockEvidence.mockResolvedValue(evidenceWith([{ status: "awaiting" }, { status: "missing" }]));
    const before = await readinessFor("idea");
    mockEvidence.mockResolvedValue(evidenceWith([{ status: "verified" }, { status: "missing" }]));
    const after = await readinessFor("idea");

    expect(after.score).toBeGreaterThan(before.score);
  });

  it("a rejected required document earns nothing", async () => {
    mockEvidence.mockResolvedValue(evidenceWith([{ status: "rejected" }, { status: "missing" }]));
    const readiness = await readinessFor("idea");
    expect(readiness.evidence_percent).toBe(0);
  });

  it("rests on the stage alone when nothing is marked required", async () => {
    mockEvidence.mockResolvedValue(evidenceWith([]));

    const readiness = await readinessFor("idea");

    expect(readiness.evidence_measurable).toBe(false);
    expect(readiness.evidence_percent).toBeNull();
    expect(readiness.score).toBe(10);
  });

  it("carries the required list so the score can show its working", async () => {
    const evidence = evidenceWith([{ status: "verified" }, { status: "awaiting" }]);
    mockEvidence.mockResolvedValue(evidence);

    const readiness = await readinessFor("idea");

    expect(readiness.evidence.items).toHaveLength(2);
    expect(readiness.evidence.awaiting_count).toBe(1);
  });

  it("emits next-step KEYS with params, never hardcoded English", async () => {
    mockEvidence.mockResolvedValue(evidenceWith([{ status: "missing" }, { status: "awaiting" }, { status: "rejected" }]));

    const readiness = await readinessFor("idea");

    expect(readiness.next_milestones).toEqual([
      { key: "venture.dashboardReadiness.fileRequired", params: { count: 1 } },
      { key: "venture.dashboardReadiness.awaitingApproval", params: { count: 1 } },
      { key: "venture.dashboardReadiness.refile", params: { count: 1 } },
    ]);
  });

  it("survives an evidence read that throws instead of inventing a score", async () => {
    mockEvidence.mockRejectedValue(new Error("db down"));

    const readiness = await readinessFor("idea");

    expect(readiness.evidence_measurable).toBe(false);
    expect(readiness.score).toBe(10); // the stage alone, never a fake evidence figure
  });

  it("scores later stages higher", async () => {
    mockEvidence.mockResolvedValue(evidenceWith([]));
    expect((await readinessFor("growth")).score).toBeGreaterThan((await readinessFor("idea")).score);
  });
});
