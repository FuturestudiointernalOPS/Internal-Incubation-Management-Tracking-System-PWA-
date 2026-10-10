/**
 * PHASE 3 — sécurité urgente (périmètre code, aucune migration/configuration).
 *
 * Reproduit et verrouille deux correctifs :
 *   1. IDOR-FOUNDER-1 — GET /api/ventures/[id]/founders/[founderId] exige
 *      désormais un accès au Venture (404 sinon), là où tout utilisateur
 *      authentifié pouvait lire n'importe quel fondateur par identifiant.
 *   2. PERIOD-START-1 — les lectures d'affectations « actives » filtrent
 *      aussi la borne de DÉBUT (started_at <= NOW()), conformément à la
 *      spec §9.1 (période semi-ouverte, début inclus).
 */
const mockViewAccess = jest.fn();
const mockGetSession = jest.fn();

jest.mock("@/models/ventureMemberAccess", () => ({
  checkVentureMemberViewAccess: (...args) => mockViewAccess(...args),
}));
jest.mock("@/server/auth/session", () => ({ getSession: () => mockGetSession() }));
jest.mock("@/lib/api/createHandler", () => ({ createHandler: (fn) => fn }));
jest.mock("@/services/ventures/founders", () => ({
  getFounderById: jest.fn(async (fid) => ({
    id: Number(fid),
    venture_id: "VNT-1",
    name: "Ada",
    role: "founder",
  })),
  updateFounderRole: jest.fn(),
  removeFounder: jest.fn(),
  canManageFounders: jest.fn(async () => ({ allowed: true })),
}));
jest.mock("@/services/ventures/activity", () => ({ logVentureActivity: jest.fn() }));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));

const db = require("@/lib/db").default;
const { GET } = require("@/app/api/ventures/[id]/founders/[founderId]/route");
const {
  listActiveProfileKeys,
  countActiveAssignmentsForProfileKey,
  findActiveAssignment,
  listActiveAutomaticAssignments,
} = require("@/models/authorization/profileAssignmentsStore");

const params = (obj) => ({ params: Promise.resolve(obj) });

describe("IDOR-FOUNDER-1 — la lecture d'un fondateur est bornée au Venture", () => {
  beforeEach(() => {
    mockViewAccess.mockReset();
    mockGetSession.mockReset();
  });

  test("un appelant sans accès au Venture reçoit 404 (aucune lecture)", async () => {
    mockGetSession.mockResolvedValue({ cid: "U-STRANGER", role: "member" });
    mockViewAccess.mockResolvedValue(false);

    const res = await GET({}, params({ id: "VNT-1", founderId: "5" }));

    expect(res.status).toBe(404);
    expect(mockViewAccess).toHaveBeenCalledWith(
      expect.anything(),
      "VNT-1",
      "member",
      "U-STRANGER",
    );
  });

  test("un membre du Venture reçoit la fiche (200)", async () => {
    mockGetSession.mockResolvedValue({ cid: "U-MEMBER", role: "member" });
    mockViewAccess.mockResolvedValue(true);

    const res = await GET({}, params({ id: "VNT-1", founderId: "5" }));

    expect(res.status).toBe(200);
  });
});

describe("PERIOD-START-1 — la borne de début est vérifiée à la décision", () => {
  const sqlOf = () => String(db.execute.mock.calls[0][0].sql);
  const DÉBUT = /started_at IS NULL OR started_at <= NOW\(\)/;

  test("listActiveProfileKeys filtre started_at", async () => {
    db.execute.mockClear();
    await listActiveProfileKeys("U1");
    expect(sqlOf()).toMatch(DÉBUT);
  });

  test("countActiveAssignmentsForProfileKey filtre started_at", async () => {
    db.execute.mockClear();
    await countActiveAssignmentsForProfileKey("facilitator");
    expect(sqlOf()).toMatch(DÉBUT);
  });

  test("findActiveAssignment filtre started_at", async () => {
    db.execute.mockClear();
    await findActiveAssignment({
      contactCid: "U1",
      profileKey: "facilitator",
      contextType: "program",
      contextId: "P1",
    });
    expect(sqlOf()).toMatch(DÉBUT);
  });

  test("listActiveAutomaticAssignments filtre started_at", async () => {
    db.execute.mockClear();
    await listActiveAutomaticAssignments({
      contactCid: "U1",
      profileKey: "facilitator",
      contextType: "program",
    });
    expect(sqlOf()).toMatch(DÉBUT);
  });
});
