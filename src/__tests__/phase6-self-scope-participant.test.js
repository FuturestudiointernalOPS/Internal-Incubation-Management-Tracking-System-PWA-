/**
 * PHASE 6 — tranche 2 : rituels participant (écritures « soi-même »).
 *
 * Les quatre rituels (check-in, réflexion, rétro, standup) sont des écritures
 * personnelles : le service d'écriture doit recevoir `cid: session.cid`, quelle
 * que soit la valeur de `cid` glissée dans le corps. C'est la vérification
 * demandée par la Phase 6 : « on ne modifie que ses propres données ».
 */

const SESSION = { cid: "SELF-CID", name: "Me", role: "participant" };
const mockSvc = {
  recordCheckin: jest.fn(async () => ({})),
  recordReflection: jest.fn(async () => ({})),
  recordRetro: jest.fn(async () => ({})),
  recordStandup: jest.fn(async () => ({})),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  initDb: jest.fn(async () => {}),
  default: { execute: jest.fn(async () => ({ rows: [] })) },
}));
jest.mock("@/server/auth/guards", () => ({ requireAuth: jest.fn(async () => null) }));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn(async () => SESSION) }));
jest.mock("@/services/participant", () => mockSvc);

const checkin = require("@/app/api/participant/rituals/checkin/route");
const reflect = require("@/app/api/participant/rituals/reflect/route");
const retro = require("@/app/api/participant/rituals/retro/route");
const standup = require("@/app/api/participant/rituals/standup/route");

const jsonReq = (body) => ({
  json: async () => body,
  url: "http://localhost/api/participant/rituals",
});

beforeEach(() => jest.clearAllMocks());

const CASES = [
  {
    name: "check-in",
    route: checkin,
    svc: mockSvc.recordCheckin,
    body: { program_id: "P1", status: "on_track", notes: "n" },
  },
  {
    name: "réflexion",
    route: reflect,
    svc: mockSvc.recordReflection,
    body: { week_number: 1, learnings: "l", challenges: "c", suggestions: "s" },
  },
  {
    name: "rétro",
    route: retro,
    svc: mockSvc.recordRetro,
    body: { week_number: 1, content: "x" },
  },
  {
    name: "standup",
    route: standup,
    svc: mockSvc.recordStandup,
    body: { week_number: 1, content: "x" },
  },
];

describe.each(CASES)("$name", ({ route, svc, body }) => {
  test("écrit avec session.cid, jamais un cid du corps", async () => {
    const res = await route.POST(jsonReq({ ...body, cid: "OTHER-CID" }));

    expect(res.status).toBe(200);
    expect(svc).toHaveBeenCalledWith(expect.objectContaining({ cid: "SELF-CID" }));
    expect(svc).not.toHaveBeenCalledWith(expect.objectContaining({ cid: "OTHER-CID" }));
  });
});
