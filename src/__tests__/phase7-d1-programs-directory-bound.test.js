/**
 * PHASE 7 — D1 : la route des programmes borne le LECTEUR HISTORIQUE.
 *
 * Un détenteur de `programs.view` qui n'est pas un rôle de gestion peut être :
 *   - un lecteur HISTORIQUE seul (son droit ne vient que du résidu) → borné à ses
 *     anciens programmes, et refusé sur tout autre ;
 *   - un détenteur RÉEL (profil, groupe…) → répertoire complet, comportement
 *     inchangé.
 * Un rôle de gestion (super_admin / program_manager) garde le répertoire et ne
 * paie même pas la lecture de distinction.
 */
const mockGetSession = jest.fn();
jest.mock("@/server/auth/session", () => ({
  getSession: (...a) => mockGetSession(...a),
}));

jest.mock("@/server/auth/guards", () => ({
  requireAuth: jest.fn(async () => null),
  requireAssignmentAccess: jest.fn(async () => null),
}));

jest.mock("@/server/authz/capabilities", () => ({
  hasProgramManagementAccess: (role) =>
    ["super_admin", "program_manager"].includes(role),
}));

const mockRequireAuthorization = jest.fn(async () => null);
jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: (...a) => mockRequireAuthorization(...a),
}));

const mockReadHistoryOnly = jest.fn(async () => false);
const mockHistoryIds = jest.fn(async () => []);
jest.mock("@/services/authorization/historicalReadScope", () => ({
  readIsHistoricalOnly: (...a) => mockReadHistoryOnly(...a),
  historicalContextIdsForFeature: (...a) => mockHistoryIds(...a),
}));

const mockGetDirectory = jest.fn(async () => ({
  status: 200,
  body: { success: true, programs: [] },
}));
jest.mock("@/services/programs/workspace", () => ({
  createV2ProgramRecord: jest.fn(),
  getV2ProgramDirectory: (...a) => mockGetDirectory(...a),
  updateV2ProgramRecord: jest.fn(),
}));

jest.mock("@/lib/programScopedAccess", () => ({
  requireProgramScope: jest.fn(async () => null),
}));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));

const route = require("@/app/api/programs/route");

const getReq = (qs = "") => ({ url: `http://localhost/api/programs${qs}` });

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuthorization.mockResolvedValue(null);
  mockReadHistoryOnly.mockResolvedValue(false);
  mockHistoryIds.mockResolvedValue([]);
});

describe("GET /api/programs — lecteur historique (D1)", () => {
  test("historique seul → répertoire BORNÉ à ses anciens programmes", async () => {
    mockGetSession.mockResolvedValue({ cid: "C1", role: "staff" });
    mockReadHistoryOnly.mockResolvedValue(true);
    mockHistoryIds.mockResolvedValue(["P1"]);

    const res = await route.GET(getReq());

    expect(res.status).toBe(200);
    expect(mockGetDirectory).toHaveBeenCalledWith({
      canReadDirectory: false,
      id: null,
      programIds: ["P1"],
    });
  });

  test("historique seul → refusé sur un programme hors de son historique", async () => {
    mockGetSession.mockResolvedValue({ cid: "C1", role: "staff" });
    mockReadHistoryOnly.mockResolvedValue(true);
    mockHistoryIds.mockResolvedValue(["P1"]);

    const res = await route.GET(getReq("?id=P9"));

    expect(res.status).toBe(403);
    expect(mockGetDirectory).not.toHaveBeenCalled();
  });

  test("détenteur RÉEL → répertoire complet (comportement inchangé)", async () => {
    mockGetSession.mockResolvedValue({ cid: "C2", role: "staff" });
    mockReadHistoryOnly.mockResolvedValue(false);

    const res = await route.GET(getReq());

    expect(res.status).toBe(200);
    expect(mockGetDirectory).toHaveBeenCalledWith({
      canReadDirectory: true,
      id: null,
    });
  });

  test("un rôle de gestion garde le répertoire et ne paie pas la distinction", async () => {
    mockGetSession.mockResolvedValue({ cid: "C3", role: "program_manager" });

    const res = await route.GET(getReq());

    expect(res.status).toBe(200);
    expect(mockReadHistoryOnly).not.toHaveBeenCalled();
    expect(mockGetDirectory).toHaveBeenCalledWith({
      canReadDirectory: true,
      id: null,
    });
  });
});
