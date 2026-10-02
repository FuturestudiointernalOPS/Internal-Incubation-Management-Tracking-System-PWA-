/**
 * Investment Readiness on the Venture dashboard — regression tests for the
 * "the widget is stuck at 4%" report.
 *
 * The score used to be `round(stageScore * 0.4 + profileScore * 0.6)`, where
 * `profileScore` came from `startup_profiles` / `startup_profile_documents`.
 * No screen writes those tables (the wizard behind them has no caller), so the
 * profile half was always 0: an `idea` Venture read 4% no matter what it did,
 * and "Complete Startup Profile" could never clear because `is_submitted` is
 * never set.
 *
 * It is now derived from the Venture's real evidence — how much of its
 * verification is approved, and whether it filed documents — and the milestones
 * are i18n keys with interpolation params instead of hardcoded English.
 */

const VENTURE = "VNT-408741B3";
const DB_ID = "001869dc-48ee-4c4c-bd98-579cb14a8ae2";

const mockGetVentureByCode = jest.fn(async () => ({ rows: [{ id: DB_ID }] }));
const mockGetOrCreateStartupProfile = jest.fn();
const mockGetOrCreateVerification = jest.fn();
const mockListMembers = jest.fn(async () => ({ rows: [] }));
const mockSummarizeMembers = jest.fn(async () => ({ rows: [] }));

jest.mock("@/lib/ventures", () => ({
  getVentureByCode: (...args) => mockGetVentureByCode(...args),
  getOrCreateStartupProfile: (...args) => mockGetOrCreateStartupProfile(...args),
  getOrCreateVerification: (...args) => mockGetOrCreateVerification(...args),
}));

jest.mock("@/models/ventureMembers", () => ({
  listVentureMembers: (...args) => mockListMembers(...args),
  summarizeVentureMembers: (...args) => mockSummarizeMembers(...args),
}));

jest.mock("@/models/ventureWorkspace", () => ({
  getVentureDashboardInfo: jest.fn(async () => ({ rows: [{ business_stage: "idea" }] })),
  listVentureMemberRecipients: jest.fn(async () => ({ rows: [] })),
  selectInternalNotificationFeed: jest.fn(async () => ({ rows: [] })),
  selectVentureNotificationFeed: jest.fn(async () => ({ rows: [] })),
  listVentureActivityLog: jest.fn(async () => ({ rows: [] })),
  listVentureDocumentsForDashboard: jest.fn(async () => ({ rows: [] })),
  listVentureDocumentsForDashboardLegacy: jest.fn(async () => ({ rows: [] })),
  listVentureMeetings: jest.fn(async () => ({ rows: [] })),
  listVentureKpiSummary: jest.fn(async () => ({ rows: [] })),
  countVentureAdvisors: jest.fn(async () => ({ rows: [{ n: 0 }] })),
  countVentureCoachingSessions: jest.fn(async () => ({ rows: [{ n: 0 }] })),
  countVentureActiveCoachAssignments: jest.fn(async () => ({ rows: [{ n: 0 }] })),
}));

const { buildVentureDashboard } = require("@/services/ventures/dashboard");

/** A profile as the orphan wizard would leave it: nothing filled, never submitted. */
const emptyProfile = () => ({
  profile: { step_1_data: {}, step_2_data: {}, step_3_data: {}, step_4_data: {}, is_submitted: false },
  progress: {},
  documents: [],
  completion_percentage: 0,
});

/** A verification with `total` items, the first `verified` of them approved. */
const verificationWith = (verified, total, documents = []) => ({
  verification: { status: "draft" },
  items: [
    ...Array.from({ length: verified }, (_, i) => ({ category: `ok_${i}`, category_label: `ok_${i}`, status: "verified" })),
    ...Array.from({ length: Math.max(total - verified, 0) }, (_, i) => ({ category: `wait_${i}`, category_label: `wait_${i}`, status: "pending" })),
  ],
  documents,
});

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
  mockGetOrCreateStartupProfile.mockResolvedValue(emptyProfile());
});

describe("Investment Readiness — Venture dashboard", () => {
  it("exposes the Data bank document count on the verification section", async () => {
    mockGetOrCreateVerification.mockResolvedValue(verificationWith(2, 4, [{ id: 1 }, { id: 2 }]));

    const dashboard = await buildVentureDashboard({ ventureParam: VENTURE, isInternalViewer: true });

    expect(dashboard.verification.document_count).toBe(2);
    expect(dashboard.verification.verified_count).toBe(2);
    expect(dashboard.verification.total_count).toBe(4);
  });

  it("reads 0% like every Venture once nothing is filed — the old behaviour", async () => {
    mockGetOrCreateVerification.mockResolvedValue(verificationWith(0, 5, []));

    const readiness = await readinessFor("idea");

    expect(readiness.score).toBe(4);
    expect(readiness.evidence_weight).toBe(0);
  });

  it("moves off the stage-only floor once documents are filed", async () => {
    mockGetOrCreateVerification.mockResolvedValue(verificationWith(0, 5, [{ id: 1 }, { id: 2 }]));

    const readiness = await readinessFor("idea");

    // 2 of 3 target documents -> documentEvidence 2/3 -> 40 * 2/3 ≈ 27
    expect(readiness.document_count).toBe(2);
    expect(readiness.evidence_weight).toBeGreaterThan(0);
    expect(readiness.score).toBeGreaterThan(4);
  });

  it("counts verification approvals, so approving an item raises the score", async () => {
    mockGetOrCreateVerification.mockResolvedValue(verificationWith(5, 5, [{ id: 1 }, { id: 2 }, { id: 3 }]));

    const readiness = await readinessFor("idea");

    // Full verification (60) + full document set (40) = 100 evidence
    expect(readiness.verification_progress).toBe(100);
    expect(readiness.evidence_weight).toBe(100);
    // round(10 * 0.4 + 100 * 0.6) = 64
    expect(readiness.score).toBe(64);
  });

  it("stops rewarding documents past the target so filing cannot farm the score", async () => {
    mockGetOrCreateVerification.mockResolvedValue(verificationWith(0, 5, [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]));

    const readiness = await readinessFor("idea");

    expect(readiness.document_count).toBe(4);
    expect(readiness.evidence_weight).toBe(40);
  });

  it("keeps the stage weight: the same evidence scores higher further along", async () => {
    mockGetOrCreateVerification.mockResolvedValue(verificationWith(5, 5, [{ id: 1 }, { id: 2 }, { id: 3 }]));

    const atIdea = await readinessFor("idea");
    const atGrowth = await readinessFor("growth");

    expect(atGrowth.score).toBeGreaterThan(atIdea.score);
    expect(atGrowth.stage_weight).toBe(65);
    expect(atGrowth.evidence_weight).toBe(atIdea.evidence_weight);
  });

  it("emits milestone KEYS with params, never hardcoded English", async () => {
    mockGetOrCreateVerification.mockResolvedValue(verificationWith(2, 5, []));

    const readiness = await readinessFor("idea");

    expect(readiness.next_milestones).toEqual([
      { key: "venture.dashboardReadiness.uploadDocuments" },
      { key: "venture.dashboardReadiness.completeVerification", params: { count: 3 } },
    ]);
    for (const milestone of readiness.next_milestones) {
      expect(typeof milestone.key).toBe("string");
      expect(milestone.key.startsWith("venture.dashboardReadiness.")).toBe(true);
    }
  });

  it("drops the upload milestone once a document exists", async () => {
    mockGetOrCreateVerification.mockResolvedValue(verificationWith(5, 5, [{ id: 1 }]));

    const readiness = await readinessFor("idea");

    expect(readiness.next_milestones).toEqual([]);
  });

  it("never asks to complete a profile — that table has no writer", async () => {
    mockGetOrCreateVerification.mockResolvedValue(verificationWith(0, 1, []));

    const readiness = await readinessFor("idea");

    const keys = readiness.next_milestones.map((milestone) => milestone.key);
    expect(keys).not.toContain("Complete Startup Profile");
    expect(keys.join(" ")).not.toMatch(/profile/i);
  });

  it("survives a verification read that throws instead of inventing a score", async () => {
    mockGetOrCreateVerification.mockRejectedValue(new Error("boom"));

    const readiness = await readinessFor("idea");

    expect(readiness.verification_progress).toBe(0);
    expect(readiness.document_count).toBe(0);
    expect(readiness.next_milestones.length).toBeGreaterThan(0);
  });

  it("handles a venture with no verification rows at all", async () => {
    mockGetOrCreateVerification.mockResolvedValue(null);

    const readiness = await readinessFor("idea");

    expect(readiness.evidence_weight).toBe(0);
    expect(readiness.document_count).toBe(0);
    expect(readiness.next_milestones.map((milestone) => milestone.key))
      .toEqual(["venture.dashboardReadiness.uploadDocuments"]);
  });

  it("no longer publishes profile_weight, which nothing consumed", async () => {
    mockGetOrCreateVerification.mockResolvedValue(verificationWith(3, 3, [{ id: 1 }]));

    const readiness = await readinessFor("idea");

    expect(readiness).not.toHaveProperty("profile_weight");
    expect(readiness).toHaveProperty("evidence_weight");
  });
});