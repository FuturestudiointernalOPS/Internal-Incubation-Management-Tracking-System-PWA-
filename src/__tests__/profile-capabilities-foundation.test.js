/**
 * Tranche 1 — profile-capability foundation (docs/PROFILES_TAKEOVER_MIGRATION.md).
 *
 * Locks the ADDITIVE schema and the statements, so the later tranches (resolver,
 * data migration, UI) build on a stable base. Nothing here changes access: the
 * resolver does not read these tables yet.
 */

const mockExecute = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn(async () => {}),
}));

const sqlOf = (call) => {
  const first = call[0];
  return typeof first === "string" ? first : String(first?.sql || "");
};
const callsMatching = (pattern) =>
  mockExecute.mock.calls.filter((call) => pattern.test(sqlOf(call)));

beforeEach(() => {
  mockExecute.mockReset();
  mockExecute.mockResolvedValue({ rows: [], rowsAffected: 1 });
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

const loadStore = () => {
  jest.resetModules();
  return require("@/models/authorization/profileCapabilitiesStore");
};

describe("profile-capability foundation — schema", () => {
  test("creates the tables once per process, idempotently", async () => {
    const { ensureProfileCapabilitiesSchema } = loadStore();
    await ensureProfileCapabilitiesSchema();
    await ensureProfileCapabilitiesSchema();

    expect(callsMatching(/CREATE TABLE IF NOT EXISTS profile_capabilities/i)).toHaveLength(1);
    expect(callsMatching(/CREATE TABLE IF NOT EXISTS role_profile_defaults/i)).toHaveLength(1);
    // The base tables are ensured before the ALTERs touch them.
    expect(callsMatching(/CREATE TABLE IF NOT EXISTS profiles/i)).toHaveLength(1);
    expect(callsMatching(/CREATE TABLE IF NOT EXISTS context_role_profiles/i)).toHaveLength(1);
    // Additive columns.
    expect(callsMatching(/ALTER TABLE profiles ADD COLUMN IF NOT EXISTS label/i)).toHaveLength(1);
    expect(
      callsMatching(/ALTER TABLE context_role_profiles ADD COLUMN IF NOT EXISTS profile_key/i),
    ).toHaveLength(1);
    expect(
      callsMatching(/ALTER TABLE contacts ADD COLUMN IF NOT EXISTS profile_key/i),
    ).toHaveLength(1);
  });
});

describe("profile-capability foundation — statements", () => {
  test("listProfileCapabilities reads the rows of one profile", async () => {
    const { listProfileCapabilities } = loadStore();
    mockExecute.mockResolvedValueOnce({
      rows: [{ module: "ventures", capability: "view", access_level: 1 }],
    });
    const res = await listProfileCapabilities("founder");
    expect(sqlOf(mockExecute.mock.calls.at(-1))).toMatch(/FROM profile_capabilities WHERE profile_key = \?/);
    expect(mockExecute.mock.calls.at(-1)[0].args).toEqual(["founder"]);
    expect(res.rows[0].module).toBe("ventures");
  });

  test("upsertProfileCapability is an ON CONFLICT upsert", async () => {
    const { upsertProfileCapability } = loadStore();
    await upsertProfileCapability("founder", "ventures", "edit", 3);
    const call = callsMatching(/INSERT INTO profile_capabilities/i)[0];
    expect(sqlOf(call)).toMatch(/ON CONFLICT \(profile_key, module, capability\) DO UPDATE/i);
    expect(call[0].args).toEqual(["founder", "ventures", "edit", 3]);
  });

  test("role_profile_defaults upsert keeps one row per role", async () => {
    const { upsertRoleProfileDefault } = loadStore();
    await upsertRoleProfileDefault({ roleName: "staff", profileKey: "staff_default" });
    const call = callsMatching(/INSERT INTO role_profile_defaults/i)[0];
    expect(sqlOf(call)).toMatch(/ON CONFLICT \(role_name\) DO UPDATE/i);
    expect(call[0].args).toEqual(["staff", "staff_default"]);
  });
});


