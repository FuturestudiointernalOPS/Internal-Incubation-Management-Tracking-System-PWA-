/**
 * PROFILE / CAPABILITY COHERENCE — the drift report.
 *
 * The check exists to SEE drift, never to repair it. Two directions:
 *   - an active profile card whose profile is missing or carries no capability;
 *   - a capability row whose profile does not exist.
 * The first direction reuses the existing assignment check (no duplicate query).
 */

const mockExecute = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn(async () => true),
}));

const {
  checkProfileCapabilityCoherence,
} = require("@/services/authorization/profileCoherence");

const sqlOf = (call) => (typeof call === "string" ? call : String(call?.sql || ""));

beforeEach(() => {
  mockExecute.mockReset();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("reports a coherent catalogue and stays silent", async () => {
  mockExecute.mockResolvedValue({ rows: [] });

  const report = await checkProfileCapabilityCoherence();

  expect(report).toEqual({
    coherent: true,
    brokenCards: 0,
    profiles: [],
    orphanCapabilities: [],
  });
  expect(console.warn).not.toHaveBeenCalled();
});

test("names an active card whose profile is missing or carries no capability", async () => {
  mockExecute.mockImplementation(async (query) => {
    const sql = sqlOf(query);
    if (sql.includes("profile_without_capabilities")) {
      return {
        rows: [
          {
            profile_key: "empty_profile",
            active_cards: 3,
            profile_without_rights: 1,
            profile_without_capabilities: 2,
          },
        ],
      };
    }
    return { rows: [] };
  });

  const report = await checkProfileCapabilityCoherence();

  expect(report.coherent).toBe(false);
  expect(report.brokenCards).toBe(3);
  expect(report.profiles).toEqual([
    {
      profileKey: "empty_profile",
      activeCards: 3,
      profileWithoutRights: 1,
      profileWithoutCapabilities: 2,
    },
  ]);
  expect(console.warn).toHaveBeenCalledWith(
    "[authz] profile/capability coherence drift (reported, never corrected)",
    expect.objectContaining({ coherent: false }),
  );
});

test("names capabilities whose profile is gone", async () => {
  mockExecute.mockImplementation(async (query) => {
    const sql = sqlOf(query);
    if (sql.includes("FROM profile_capabilities")) {
      return { rows: [{ profile_key: "ghost", capabilities: 4 }] };
    }
    return { rows: [] };
  });

  const report = await checkProfileCapabilityCoherence();

  expect(report.coherent).toBe(false);
  expect(report.orphanCapabilities).toEqual([
    { profile_key: "ghost", capabilities: 4 },
  ]);
});

test("never writes — the check only reads", async () => {
  mockExecute.mockResolvedValue({ rows: [] });
  await checkProfileCapabilityCoherence();

  for (const call of mockExecute.mock.calls) {
    expect(sqlOf(call[0])).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/i);
  }
});
