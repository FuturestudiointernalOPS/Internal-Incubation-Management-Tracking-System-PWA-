/**
 * PHASE 6 — tranche 4 : le calendrier de l'utilisateur est « soi-même ».
 *
 * La connexion Google Calendar est personnelle : statut, déconnexion et
 * synchronisation agissent sur `session.cid` uniquement. Ce test le prouve.
 */

const SESSION = { cid: "SELF-CID", role: "member", email: "me@x.test" };

jest.mock("@/lib/db", () => ({
  __esModule: true,
  initDb: jest.fn(async () => {}),
  default: { execute: jest.fn(async () => ({ rows: [] })) },
}));
jest.mock("@/server/auth/guards", () => ({ requireAuth: jest.fn(async () => null) }));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn(async () => SESSION) }));

const mockGcal = {
  getStatus: jest.fn(async () => ({ connected: false })),
  disconnect: jest.fn(async () => ({})),
  syncUser: jest.fn(async () => ({ ok: true })),
  syncUserIfStale: jest.fn(async () => ({ ok: true })),
};
jest.mock("@/services/integrations/googleCalendar", () => mockGcal);

const calendar = require("@/app/api/integrations/google-calendar/route");
const sync = require("@/app/api/integrations/google-calendar/sync/route");

beforeEach(() => jest.clearAllMocks());

test("GET lit le statut de session.cid", async () => {
  await calendar.GET();
  expect(mockGcal.getStatus).toHaveBeenCalledWith("SELF-CID");
});

test("DELETE déconnecte session.cid", async () => {
  await calendar.DELETE();
  expect(mockGcal.disconnect).toHaveBeenCalledWith("SELF-CID");
});

test("sync manuelle synchronise session.cid", async () => {
  await sync.POST({ url: "http://localhost/api/integrations/google-calendar/sync" });
  expect(mockGcal.syncUser).toHaveBeenCalledWith("SELF-CID");
  expect(mockGcal.syncUserIfStale).not.toHaveBeenCalled();
});

test("sync 'ifStale' reste bornée à session.cid", async () => {
  await sync.POST({
    url: "http://localhost/api/integrations/google-calendar/sync?ifStale=1",
  });
  expect(mockGcal.syncUserIfStale).toHaveBeenCalledWith("SELF-CID");
});
