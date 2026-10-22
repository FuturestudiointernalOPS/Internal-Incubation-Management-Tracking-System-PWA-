/**
 * PHASE 7 — D3 (2/2) : révocation de la trace historique + restauration.
 *
 * Décision D3 (option c) : la lecture résiduelle d'un ancien gestionnaire est
 * RÉVOCABLE par un administrateur. La révocation est PERSISTÉE (le balayage la
 * re-dériverait sinon) et n'efface **jamais** l'historique relationnel — elle
 * retire uniquement la lecture dérivée.
 *
 * Couverture : le service (enregistrement → retrait → audit → invalidation) et
 * l'API (garde de capacité, contexte révocable, câblage).
 */

const mockEnsure = jest.fn(async () => true);
const mockList = jest.fn(async () => ({ rows: [] }));
const mockUpsert = jest.fn(async () => ({ rowsAffected: 1 }));
const mockDelete = jest.fn(async () => ({ rowsAffected: 1 }));

jest.mock("@/models/authorization/historicalAccessRevocationsStore", () => ({
  ensureHistoricalRevocationsSchema: (...a) => mockEnsure(...a),
  listHistoricalRevocations: (...a) => mockList(...a),
  upsertHistoricalRevocation: (...a) => mockUpsert(...a),
  deleteHistoricalRevocation: (...a) => mockDelete(...a),
}));

const mockAudit = jest.fn(async () => true);
jest.mock("@/models/authorization/accessQueries", () => ({
  logPermissionAudit: (...a) => mockAudit(...a),
}));

const mockSync = jest.fn();
jest.mock("@/services/authorization/contextGrantHistory", () => ({
  syncContextGrantsHistory: (...a) => mockSync(...a),
}));

const mockInvalidate = jest.fn(async () => true);
jest.mock("@/services/authorization/contextGrantCache", () => ({
  invalidateUserContext: (...a) => mockInvalidate(...a),
}));

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => ({ cid: "SA-1", name: "Super Admin" })),
}));

jest.mock("@/lib/requestOrigin", () => ({
  requireSameOrigin: jest.fn(() => null),
}));

const mockRequireAuthorization = jest.fn(async () => null);
jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: (...a) => mockRequireAuthorization(...a),
}));

const service = require("@/services/authorization/historicalAccessAdmin");
const route = require("@/app/api/engineering/permissions/historical-access/route");

const jsonReq = (body) => ({ json: async () => body });
const urlReq = (url) => ({ url });

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuthorization.mockResolvedValue(null);
  mockSync.mockResolvedValue({ applied: [], revoked: [] });
});

describe("service — révocation / restauration", () => {
  test("revoke : enregistre, réconcilie chaque couple du contexte, audite, invalide", async () => {
    mockSync.mockResolvedValue({ applied: [], revoked: ["programs.view"] });

    const res = await service.revokeHistoricalAccess("C1", "program", {
      actorCid: "SA-1",
      actorName: "Super Admin",
      reason: "left the program",
    });

    expect(res.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ cid: "C1", context: "program", revokedBy: "SA-1" }),
    );
    // program → facilitator, program_manager, participant (three couples).
    expect(mockSync).toHaveBeenCalledTimes(3);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "historical_access_revoked" }),
    );
    expect(mockInvalidate).toHaveBeenCalledWith("C1");
  });

  test("contexte non révocable → refus, aucune écriture", async () => {
    const res = await service.revokeHistoricalAccess("C1", "crm", {});
    expect(res).toEqual({ success: false, error: "invalid request" });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  test("restore : supprime le registre puis ré-applique", async () => {
    mockSync.mockResolvedValue({ applied: ["programs.view"], revoked: [] });

    const res = await service.restoreHistoricalAccess("C1", "program", { actorCid: "SA-1" });

    expect(res.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith("C1", "program");
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "historical_access_restored" }),
    );
    expect(mockInvalidate).toHaveBeenCalledWith("C1");
  });

  test("listRevocations renvoie les lignes du registre", async () => {
    mockList.mockResolvedValue({ rows: [{ context: "program" }] });
    const res = await service.listRevocations("C1");
    expect(res).toEqual({ success: true, revocations: [{ context: "program" }] });
  });
});

describe("API — révocation historique", () => {
  test("POST refuse sans la capacité (l'erreur du garde est renvoyée telle quelle)", async () => {
    mockRequireAuthorization.mockResolvedValue(new Response(null, { status: 403 }));
    const res = await route.POST(jsonReq({ cid: "C1", context: "program" }));
    expect(res.status).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  test("POST valide révoque et renvoie 200", async () => {
    const res = await route.POST(jsonReq({ cid: "C1", context: "program", reason: "x" }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(mockUpsert).toHaveBeenCalled();
  });

  test("POST sur un contexte non révocable → 400", async () => {
    const res = await route.POST(jsonReq({ cid: "C1", context: "crm" }));
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  test("POST sans cid → 400", async () => {
    const res = await route.POST(jsonReq({ context: "program" }));
    expect(res.status).toBe(400);
  });

  test("GET renvoie les révocations de la personne", async () => {
    mockList.mockResolvedValue({ rows: [{ context: "program", reason: "x" }] });
    const res = await route.GET(urlReq("http://localhost/api/engineering/permissions/historical-access?cid=C1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cid).toBe("C1");
    expect(body.revocations).toEqual([{ context: "program", reason: "x" }]);
  });

  test("DELETE restaure et renvoie 200", async () => {
    const res = await route.DELETE(
      urlReq("http://localhost/api/engineering/permissions/historical-access?cid=C1&context=program"),
    );
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith("C1", "program");
  });
});
