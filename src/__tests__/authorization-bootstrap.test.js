/**
 * AUTHORIZATION BOOTSTRAP — the default grants and the runtime schema self-heal.
 *
 * Three behaviours matter here, and none of them could be seen from a route test:
 *
 *   1. the default role grants are complete — a role that silently stops being
 *      seeded loses access everywhere, and nothing else would notice;
 *   2. the self-heal runs its DDL ONCE per process (it is dozens of statements,
 *      called on request paths), and must RETRY after a failure instead of
 *      caching a broken state forever;
 *   3. the responsibility seed is a fixed catalogue, so it too runs once per
 *      process, with the same retry-on-failure rule.
 */

const mockExecute = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn(async () => {}),
}));

const { PERMISSION_MODULES } = require("@/server/authz/capabilities");

/** Fresh module state (the memos live at module scope, per process). */
function load() {
  jest.resetModules();
  return require("@/models/authorization/bootstrap");
}

const insertsInto = (table) =>
  mockExecute.mock.calls.filter((call) => String(call[0]?.sql || call[0] || "").includes(`INSERT INTO ${table}`));

beforeEach(() => {
  mockExecute.mockReset();
  mockExecute.mockResolvedValue({ rows: [] });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("seedDefaultRoleCapabilities", () => {
  it("grants every capability of every module to super_admin, at the top level", async () => {
    const { seedDefaultRoleCapabilities } = load();

    await expect(seedDefaultRoleCapabilities()).resolves.toEqual({ success: true });

    const inserts = insertsInto("role_capabilities");
    const superAdmin = inserts.filter((call) => call[0].args[0] === "super_admin");
    const expected = Object.values(PERMISSION_MODULES).reduce(
      (total, module) => total + module.capabilities.length,
      0,
    );

    expect(superAdmin).toHaveLength(expected);
    expect(superAdmin.every((call) => call[0].args[3] === 5 && call[0].args[4] === 5)).toBe(true);
  });

  it("grants the baseline roles their documented capabilities only", async () => {
    const { seedDefaultRoleCapabilities } = load();

    await seedDefaultRoleCapabilities();

    const byRole = (role) =>
      insertsInto("role_capabilities")
        .filter((call) => call[0].args[0] === role)
        .map((call) => `${call[0].args[1]}.${call[0].args[2]}`)
        .sort();

    expect(byRole("staff")).toEqual(
      [
        "contacts.view",
        "messaging.send",
        "messaging.view",
        "programs.view",
        "projects.create",
        "projects.edit",
        "projects.view",
        "reports.create",
        "reports.view",
      ].sort(),
    );
    expect(byRole("participant")).toEqual(["messaging.send", "messaging.view", "projects.view"].sort());
  });

  it("is idempotent — every grant is an upsert", async () => {
    const { seedDefaultRoleCapabilities } = load();

    await seedDefaultRoleCapabilities();

    for (const call of insertsInto("role_capabilities")) {
      expect(String(call[0].sql)).toContain("ON CONFLICT (role, module, capability) DO UPDATE SET access_level = ?");
      expect(call[0].args).toHaveLength(5);
    }
  });

  it("reports the failure instead of throwing", async () => {
    const { seedDefaultRoleCapabilities } = load();
    mockExecute.mockRejectedValue(new Error("connection terminated"));

    await expect(seedDefaultRoleCapabilities()).resolves.toEqual({
      success: false,
      error: "connection terminated",
    });
  });
});

describe("the runtime schema self-heal", () => {
  it("runs its DDL once, however many times it is called", async () => {
    const { ensureResponsibilitiesSchema } = load();

    await expect(ensureResponsibilitiesSchema()).resolves.toBe(true);
    const afterFirst = mockExecute.mock.calls.length;

    await ensureResponsibilitiesSchema();
    await ensureResponsibilitiesSchema();

    expect(mockExecute.mock.calls.length).toBe(afterFirst);
  });

  it("creates the tables it owns, idempotently", async () => {
    const { ensureResponsibilitiesSchema } = load();

    await ensureResponsibilitiesSchema();

    const ddl = mockExecute.mock.calls.map((call) => String(call[0] || ""));
    expect(ddl.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS responsibilities"))).toBe(true);
    expect(ddl.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS user_responsibilities"))).toBe(true);
    expect(ddl.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS responsibility_capability_grants"))).toBe(true);
    expect(ddl.every((sql) => /^(CREATE|ALTER)/.test(sql))).toBe(true);
  });

  it("retries after a failure instead of caching a broken state", async () => {
    const { ensureResponsibilitiesSchema } = load();
    mockExecute.mockRejectedValueOnce(new Error("connection terminated"));

    await expect(ensureResponsibilitiesSchema()).resolves.toBe(false);

    mockExecute.mockReset();
    mockExecute.mockResolvedValue({ rows: [] });
    await expect(ensureResponsibilitiesSchema()).resolves.toBe(true);
    expect(mockExecute.mock.calls.length).toBeGreaterThan(0);
  });

  it("heals the permissions schema too, once per process", async () => {
    const { ensurePermissionsSchema } = load();

    await ensurePermissionsSchema();
    const afterFirst = mockExecute.mock.calls.length;
    await ensurePermissionsSchema();

    expect(mockExecute.mock.calls.length).toBe(afterFirst);
    const ddl = mockExecute.mock.calls.map((call) => String(call[0] || ""));
    expect(ddl.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS role_capabilities"))).toBe(true);
  });
});

describe("seedDefaultResponsibilities", () => {
  it("seeds the catalogue once per process and reports success", async () => {
    const { seedDefaultResponsibilities } = load();

    await expect(seedDefaultResponsibilities()).resolves.toEqual({ success: true });
    const afterFirst = insertsInto("responsibilities").length;
    expect(afterFirst).toBeGreaterThan(0);

    await seedDefaultResponsibilities();
    expect(insertsInto("responsibilities").length).toBe(afterFirst);
  });

  it("caches a failed seed for the life of the process", async () => {
    const { seedDefaultResponsibilities } = load();
    mockExecute.mockRejectedValue(new Error("connection terminated"));

    await expect(seedDefaultResponsibilities()).resolves.toEqual({
      success: false,
      error: "connection terminated",
    });

    // PINNED, NOT ENDORSED — this is today's behaviour and it contradicts the
    // memo-clearing comment in the source: the inner seeding function RESOLVES
    // with {success:false} instead of throwing, so the `.catch` that would clear
    // the memo never runs. A real retry needs the inner function to throw, which
    // is a behaviour change and therefore left to an explicit decision.
    mockExecute.mockReset();
    mockExecute.mockResolvedValue({ rows: [] });
    await expect(seedDefaultResponsibilities()).resolves.toEqual({
      success: false,
      error: "connection terminated",
    });
  });
});
