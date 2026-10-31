/**
 * Authorization — one-time migrations and the retired-role cleanup.
 *
 * Runs once per database, does not record on failure, and does not
 * reject the batch when one migration throws.
 *
 * Mocks and context factories come from ./helpers/authorizationMocks.
 */

const mockAuthz = require("./helpers/authorizationMocks");

jest.mock("@/lib/db", () => mockAuthz.db);
jest.mock("@/models/authorization/constants/feature-module-capability", () => ({
  ...jest.requireActual("@/models/authorization/constants/feature-module-capability"),
  PERMISSION_MODULES: mockAuthz.auth.PERMISSION_MODULES,
}));
jest.mock("@/server/auth/session", () => ({ getSession: mockAuthz.auth.getSession }));
jest.mock("@/models/authorization/bootstrap", () => ({ ensurePermissionsSchema: mockAuthz.auth.ensurePermissionsSchema }));
jest.mock("next/server", () => mockAuthz.nextServer);

// ─── runAuthzMigration ────────────────────────────────────────

describe("runAuthzMigration (one-time policy migrations)", () => {
  test("runs once per database, then never again", async () => {
    const dbMock = require("@/lib/db").default;
    const { runAuthzMigration } = require("@/models/authorization/index");
    let markerPresent = false;
    dbMock.execute.mockImplementation(async ({ sql } = {}) => {
      const statement = typeof sql === "string" ? sql : sql || "";
      if (statement.includes("authz_migrations") && statement.includes("SELECT")) {
        return { rows: markerPresent ? [{ name: "test-mig" }] : [] };
      }
      if (statement.includes("INSERT INTO authz_migrations")) {
        markerPresent = true;
        return { rows: [] };
      }
      return { rows: [] };
    });

    const firstMigration = jest.fn(async () => {});
    const firstResult = await runAuthzMigration("test-mig", firstMigration);
    expect(firstResult.applied).toBe(true);
    expect(firstMigration).toHaveBeenCalledTimes(1);

    const secondMigration = jest.fn(async () => {});
    const secondResult = await runAuthzMigration("test-mig", secondMigration);
    expect(secondResult.applied).toBe(false);
    expect(secondMigration).not.toHaveBeenCalled();

    dbMock.execute.mockImplementation(async () => ({ rows: [] }));
  });

  test("does not record the migration when the work throws (retries next boot)", async () => {
    const dbMock = require("@/lib/db").default;
    const { runAuthzMigration } = require("@/models/authorization/index");
    let markerPresent = false;
    let failureRecorded = null;
    dbMock.execute.mockImplementation(async ({ sql, args } = {}) => {
      const statement = typeof sql === "string" ? sql : sql || "";
      if (statement.includes("authz_migrations") && statement.includes("SELECT")) {
        return { rows: markerPresent ? [{ name: "boom-mig" }] : [] };
      }
      if (statement.includes("INSERT INTO authz_migrations")) {
        markerPresent = true;
        return { rows: [] };
      }
      if (statement.includes("INSERT INTO authz_migration_failures")) {
        failureRecorded = { name: args?.[0], error: args?.[1] };
        return { rows: [] };
      }
      return { rows: [] };
    });

    const failing = jest.fn(async () => {
      throw new Error("boom");
    });
    await expect(runAuthzMigration("boom-mig", failing)).rejects.toThrow(
      "boom",
    );
    expect(markerPresent).toBe(false);
    // The reason is durable, not only in the server log.
    expect(failureRecorded).toEqual({ name: "boom-mig", error: "boom" });

    dbMock.execute.mockImplementation(async () => ({ rows: [] }));
  });
});


describe("one-time migration batch (runs only when enabled)", () => {
  afterEach(() => {
    delete process.env.AUTHZ_RUN_MIGRATIONS;
  });

  test("does nothing at startup — the migrations are already applied", async () => {
    jest.resetModules();
    const dbMock = require("@/lib/db").default;
    let executions = 0;
    dbMock.execute.mockImplementation(async () => {
      executions += 1;
      return { rows: [] };
    });

    const { ensureCapabilityBackfills } = require("@/models/authorization/backfill");

    await expect(ensureCapabilityBackfills()).resolves.toBeUndefined();
    expect(executions).toBe(0);
  });

  test("a failing migration does not reject the batch, and is not retried per call", async () => {
    jest.resetModules();
    process.env.AUTHZ_RUN_MIGRATIONS = "true";
    const dbMock = require("@/lib/db").default;
    let executions = 0;
    dbMock.execute.mockImplementation(async ({ sql } = {}) => {
      executions += 1;
      // The shape of the real failure: one backfill writes a table the database
      // does not have. Before, this rejected the whole batch, which the
      // authorization gate awaits - so one missing column returned 500 from
      // every gated endpoint, and re-ran on every request.
      if (String(sql || "").includes("profile_capabilities")) {
        throw new Error('relation "profile_capabilities" does not exist');
      }
      return { rows: [] };
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { ensureCapabilityBackfills } = require("@/models/authorization/backfill");

    await expect(ensureCapabilityBackfills()).resolves.toBeUndefined();
    // Reported, not hidden.
    expect(errorSpy).toHaveBeenCalled();

    // Attempted once per process: a second call must not re-run the batch.
    const before = executions;
    await ensureCapabilityBackfills();
    expect(executions).toBe(before);

    errorSpy.mockRestore();
    dbMock.execute.mockImplementation(async () => ({ rows: [] }));
  });
});

