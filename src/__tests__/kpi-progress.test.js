/**
 * Behaviour of the KPI progress use case (service layer).
 *
 * The decisions behind `/api/kpi-progress` are exercised with the repository and
 * the recalculation mocked: the schema-drift fallback, the on-the-fly
 * recalculation when nothing is persisted, the `source` label, and the
 * measurable-only average that is the programme figure.
 */

jest.mock("@/models/platformConfig", () => ({
  getKpiProgressByProgramId: jest.fn(),
}));

jest.mock("@/services/programs/kpiProgress", () => ({
  recalculateKpiProgress: jest.fn(),
}));

const { getKpiProgressByProgramId } = require("@/models/platformConfig");
const { recalculateKpiProgress } = require("@/services/programs/kpiProgress");
const {
  getKpiProgress,
  recalculateAndSummarize,
} = require("@/services/dashboard/kpiProgress");

beforeEach(() => {
  jest.clearAllMocks();
  getKpiProgressByProgramId.mockResolvedValue({ rows: [] });
  recalculateKpiProgress.mockResolvedValue([]);
});

describe("getKpiProgress", () => {
  test("a missing program_id is a 400 and reads nothing", async () => {
    const result = await getKpiProgress(null);
    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
    expect(getKpiProgressByProgramId).not.toHaveBeenCalled();
  });

  test("persisted rows are returned with their plain average", async () => {
    getKpiProgressByProgramId.mockResolvedValue({
      rows: [
        { completion_rate: 80 },
        { completion_rate: 0 },
        { completion_rate: 100 },
      ],
    });
    const result = await getKpiProgress("P1");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      success: true,
      kpiProgress: [
        { completion_rate: 80 },
        { completion_rate: 0 },
        { completion_rate: 100 },
      ],
      overallProgress: 60,
      source: "persisted",
    });
    expect(recalculateKpiProgress).not.toHaveBeenCalled();
  });

  test("a schema mismatch answers an 'unavailable' empty instead of failing", async () => {
    getKpiProgressByProgramId.mockRejectedValue(new Error("no such column"));
    const result = await getKpiProgress("P1");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      success: true,
      kpiProgress: [],
      overallProgress: 0,
      source: "unavailable",
    });
    expect(recalculateKpiProgress).not.toHaveBeenCalled();
  });

  test("an empty cache recalculates on the fly and is labelled persisted", async () => {
    recalculateKpiProgress.mockResolvedValue([
      { completion_rate: 50 },
      { completion_rate: 75 },
    ]);
    const result = await getKpiProgress("P1");
    expect(recalculateKpiProgress).toHaveBeenCalledWith("P1");
    expect(result.body.overallProgress).toBe(63);
    expect(result.body.source).toBe("persisted");
  });

  test("a failed recalculation answers an empty read", async () => {
    recalculateKpiProgress.mockRejectedValue(new Error("boom"));
    const result = await getKpiProgress("P1");
    expect(result.body.kpiProgress).toEqual([]);
    expect(result.body.overallProgress).toBe(0);
    expect(result.body.source).toBe("empty");
  });
});

describe("recalculateAndSummarize", () => {
  test("a missing program_id is a 400 and recalculates nothing", async () => {
    const result = await recalculateAndSummarize(undefined);
    expect(result.status).toBe(400);
    expect(recalculateKpiProgress).not.toHaveBeenCalled();
  });

  test("non-measurable objectives are left out of the average but still returned", async () => {
    recalculateKpiProgress.mockResolvedValue([
      { completion_rate: 100, measurable: true },
      { completion_rate: 0, measurable: false },
      { completion_rate: 50, measurable: true },
    ]);
    const result = await recalculateAndSummarize("P1");
    expect(result.body.overallProgress).toBe(75);
    expect(result.body.kpiProgress).toHaveLength(3);
  });

  test("an all-non-measurable programme averages to 0", async () => {
    recalculateKpiProgress.mockResolvedValue([
      { completion_rate: 40, measurable: false },
    ]);
    const result = await recalculateAndSummarize("P1");
    expect(result.body.overallProgress).toBe(0);
  });
});
