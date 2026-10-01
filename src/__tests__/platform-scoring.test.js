/**
 * Characterisation tests for the assessment scoring engine.
 *
 * Pins the DECISIONS — run-level config first with a form-level fallback, the
 * per-section percentage, the weighted overall and the ranking label — so the
 * suite stays valid after the engine moved from the form-runs route to
 * `@/services/platform/scoring`. The repository is mocked.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

const mockFormRuns = {
  getRunScoringSettingsById: jest.fn(),
  getFormScoringSettingsById: jest.fn(),
};
jest.mock("@/models/formRuns", () => mockFormRuns);

const { calculateSubmissionScores } = require("@/services/platform/scoring");

const SCORING = {
  enabled: true,
  sections: {
    "Founder Motivation": { weight: 25, field_labels: ["Q1", "Q2"] },
    "Execution": { weight: 75, field_labels: ["Q3", "Q4"] },
  },
  rankings: [
    { min: 80, max: 100, label: "High Potential" },
    { min: 0, max: 79, label: "Needs Development" },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("calculateSubmissionScores", () => {
  test("returns null when the run is not found", async () => {
    mockFormRuns.getRunScoringSettingsById.mockResolvedValue({ rows: [] });
    expect(await calculateSubmissionScores(1, {})).toBeNull();
  });

  test("returns null when no scoring is configured anywhere", async () => {
    mockFormRuns.getRunScoringSettingsById.mockResolvedValue({ rows: [{ form_id: 2, settings: {} }] });
    mockFormRuns.getFormScoringSettingsById.mockResolvedValue({ rows: [{ settings: {} }] });
    expect(await calculateSubmissionScores(1, {})).toBeNull();
  });

  test("uses the run's scoring config when present and computes the weighted overall + ranking", async () => {
    mockFormRuns.getRunScoringSettingsById.mockResolvedValue({
      rows: [{ form_id: 2, settings: { scoring: SCORING } }],
    });

    // Section 1: 5/5 on both → 100%. Section 2: 2.5/5 on both → 50%.
    // Weighted: 100*0.25 + 50*0.75 = 62.5 → "Needs Development".
    const result = await calculateSubmissionScores(1, { Q1: 5, Q2: 5, Q3: 2.5, Q4: 2.5 });

    expect(result.overall).toBe(62.5);
    expect(result.ranking).toBe("Needs Development");
    expect(result.sections["Founder Motivation"]).toMatchObject({ score: 100, weight: 25, count: 2 });
    expect(result.sections["Execution"]).toMatchObject({ score: 50, weight: 75, count: 2 });
    // The run's config was used; the form was never consulted.
    expect(mockFormRuns.getFormScoringSettingsById).not.toHaveBeenCalled();
  });

  test("falls back to the form's scoring config when the run has none", async () => {
    mockFormRuns.getRunScoringSettingsById.mockResolvedValue({ rows: [{ form_id: 2, settings: {} }] });
    mockFormRuns.getFormScoringSettingsById.mockResolvedValue({
      rows: [{ settings: { scoring: SCORING } }],
    });

    const result = await calculateSubmissionScores(1, { Q1: 5, Q2: 5, Q3: 5, Q4: 5 });
    expect(result.overall).toBe(100);
    expect(result.ranking).toBe("High Potential");
    expect(mockFormRuns.getFormScoringSettingsById).toHaveBeenCalledWith(2);
  });

  test("an unanswered question weighs nothing (it is not counted as a zero)", async () => {
    mockFormRuns.getRunScoringSettingsById.mockResolvedValue({
      rows: [{ form_id: 2, settings: { scoring: SCORING } }],
    });

    // Q2 / Q4 missing → section 1 = 5/5 (100%), section 2 = 5/5 (100%).
    const result = await calculateSubmissionScores(1, { Q1: 5, Q3: 5 });
    expect(result.sections["Founder Motivation"].count).toBe(1);
    expect(result.sections["Execution"].count).toBe(1);
    expect(result.overall).toBe(100);
  });
});
