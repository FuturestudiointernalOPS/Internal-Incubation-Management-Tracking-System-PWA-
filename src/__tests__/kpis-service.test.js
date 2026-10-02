/**
 * Behaviour of the KPI definition use cases (service layer).
 *
 * The work behind `/api/kpis` CRUD, with the repository mocked: resolving the
 * owning programme for the scope gate, and the default target a KPI carries
 * when none is given (80) — the value the audit entry must report too.
 */

jest.mock("@/models/platformConfig", () => ({
  insertKpi: jest.fn(),
  updateKpi: jest.fn(),
  deleteKpi: jest.fn(),
  getV2KpiProgramId: jest.fn(),
}));

const {
  insertKpi,
  updateKpi,
  deleteKpi,
  getV2KpiProgramId,
} = require("@/models/platformConfig");
const {
  resolveKpiProgramId,
  createKpiDefinition,
  updateKpiDefinition,
  deleteKpiDefinition,
} = require("@/services/dashboard/kpis");

beforeEach(() => {
  jest.clearAllMocks();
  insertKpi.mockResolvedValue({ rows: [] });
  updateKpi.mockResolvedValue({ rows: [] });
  deleteKpi.mockResolvedValue({ rows: [] });
});

describe("resolveKpiProgramId", () => {
  test("returns the owning programme", async () => {
    getV2KpiProgramId.mockResolvedValue({ rows: [{ program_id: "P1" }] });
    expect(await resolveKpiProgramId(7)).toBe("P1");
    expect(getV2KpiProgramId).toHaveBeenCalledWith(7);
  });

  test("returns undefined when the KPI is unknown (so the gate refuses)", async () => {
    getV2KpiProgramId.mockResolvedValue({ rows: [] });
    expect(await resolveKpiProgramId(7)).toBeUndefined();
  });
});

describe("createKpiDefinition", () => {
  test("writes the given target and reports it for the audit", async () => {
    const details = await createKpiDefinition({
      programId: "P1",
      title: "Reach",
      targetValue: 10,
    });
    expect(insertKpi).toHaveBeenCalledWith("P1", "Reach", 10);
    expect(details).toEqual({ title: "Reach", target_value: 10 });
  });

  test("reports the default target (80) when none is given", async () => {
    const details = await createKpiDefinition({
      programId: "P1",
      title: "Reach",
      targetValue: undefined,
    });
    expect(details.target_value).toBe(80);
  });
});

describe("updateKpiDefinition", () => {
  test("renames and retargets, reporting the default when none is given", async () => {
    const details = await updateKpiDefinition({
      id: 7,
      title: "Reach",
      targetValue: undefined,
    });
    expect(updateKpi).toHaveBeenCalledWith(7, "Reach", undefined);
    expect(details).toEqual({ title: "Reach", target_value: 80 });
  });
});

describe("deleteKpiDefinition", () => {
  test("deletes by id", async () => {
    await deleteKpiDefinition(7);
    expect(deleteKpi).toHaveBeenCalledWith(7);
  });
});
