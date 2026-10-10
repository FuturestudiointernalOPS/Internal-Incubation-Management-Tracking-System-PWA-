/**
 * PHASE 7 — D1 : la lecture historique est une règle DISTINCTE et BORNÉE.
 *
 * Un ancien gestionnaire consulte les programmes/ventures qu'il a GÉRÉS, jamais le
 * répertoire. La distinction tient au FAIT que son droit de lecture n'est porté que
 * par le résidu (`granted_by = 'hist:...'`) : un droit réel coexistant rend la
 * personne à son accès normal.
 */
const mockGetUserCapabilityRows = jest.fn();
jest.mock("@/models/authorization/contextGrantsStore", () => ({
  getUserCapabilityRows: (...a) => mockGetUserCapabilityRows(...a),
}));

const mockResolveScopeIds = jest.fn();
jest.mock("@/services/authorization/scope", () => ({
  resolveScopeIds: (...a) => mockResolveScopeIds(...a),
}));

jest.mock("@/models/programs", () => ({
  getAllPrograms: jest.fn(async () => ({
    rows: [
      { id: "P1", topics: null, outcomes: null, deliverables: null, resources: null },
      { id: "P2", topics: null, outcomes: null, deliverables: null, resources: null },
    ],
  })),
}));

jest.mock("@/server/authz/guards", () => ({
  assertNoParticipantFacilitatorConflict: jest.fn(),
}));

const {
  readIsHistoricalOnly,
  historicalContextIdsForFeature,
} = require("@/services/authorization/historicalReadScope");
const { getV2ProgramDirectory } = require("@/services/programs/programV2");

const residual = {
  module: "programs",
  capability: "view",
  access_level: 1,
  granted_by: "hist:program:program_manager",
  expires_at: null,
};
const real = {
  module: "programs",
  capability: "view",
  access_level: 2,
  granted_by: "staff",
  expires_at: null,
};

beforeEach(() => jest.clearAllMocks());

describe("readIsHistoricalOnly", () => {
  test("seul un droit résiduel porte la lecture → historique seul", async () => {
    mockGetUserCapabilityRows.mockResolvedValue({ rows: [residual] });
    await expect(readIsHistoricalOnly("C1", "programs")).resolves.toBe(true);
  });

  test("un droit RÉEL coexiste → pas historique seul (accès normal)", async () => {
    mockGetUserCapabilityRows.mockResolvedValue({ rows: [residual, real] });
    await expect(readIsHistoricalOnly("C1", "programs")).resolves.toBe(false);
  });

  test("aucune ligne → false (neutre, ne borne jamais à tort)", async () => {
    mockGetUserCapabilityRows.mockResolvedValue({ rows: [] });
    await expect(readIsHistoricalOnly("C1", "programs")).resolves.toBe(false);
  });

  test("un résidu EXPIRÉ ne compte pas → false", async () => {
    mockGetUserCapabilityRows.mockResolvedValue({
      rows: [{ ...residual, expires_at: "2000-01-01T00:00:00.000Z" }],
    });
    await expect(readIsHistoricalOnly("C1", "programs")).resolves.toBe(false);
  });
});

describe("historicalContextIdsForFeature", () => {
  test("résout la portée historique de la fonctionnalité, en chaînes", async () => {
    mockResolveScopeIds.mockResolvedValue(["P1", 42]);
    await expect(historicalContextIdsForFeature("C1", "programs")).resolves.toEqual([
      "P1",
      "42",
    ]);
    expect(mockResolveScopeIds).toHaveBeenCalledWith("program_managed_history", "C1");
  });

  test("aucune portée historique → tableau vide", async () => {
    mockResolveScopeIds.mockResolvedValue(null);
    await expect(historicalContextIdsForFeature("C1", "programs")).resolves.toEqual([]);
  });
});

describe("getV2ProgramDirectory — bornage D1", () => {
  test("programIds borne le répertoire aux contextes autorisés", async () => {
    const res = await getV2ProgramDirectory({
      canReadDirectory: false,
      id: null,
      programIds: ["P1"],
    });
    expect(res.body.programs.map((p) => p.id)).toEqual(["P1"]);
  });

  test("sans programIds ni id : comportement inchangé", async () => {
    const res = await getV2ProgramDirectory({ canReadDirectory: false, id: null });
    expect(res.body.programs.map((p) => p.id)).toEqual(["P1", "P2"]);
  });
});
