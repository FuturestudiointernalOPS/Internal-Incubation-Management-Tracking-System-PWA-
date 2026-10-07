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
jest.mock("@/server/authz/capabilities", () => {
  const auth = mockAuthz.auth;
  return { PERMISSION_MODULES: auth.PERMISSION_MODULES, ACCESS_LEVELS: auth.ACCESS_LEVELS };
});
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
    dbMock.execute.mockImplementation(async ({ sql } = {}) => {
      const statement = typeof sql === "string" ? sql : sql || "";
      if (statement.includes("authz_migrations") && statement.includes("SELECT")) {
        return { rows: markerPresent ? [{ name: "boom-mig" }] : [] };
      }
      if (statement.includes("INSERT INTO authz_migrations")) {
        markerPresent = true;
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

    dbMock.execute.mockImplementation(async () => ({ rows: [] }));
  });
});


describe("one-time migration batch (resilience)", () => {
  test("a failing migration does not reject the batch, and is not retried per call", async () => {
    jest.resetModules();
    const dbMock = require("@/lib/db").default;
    let executions = 0;
    dbMock.execute.mockImplementation(async ({ sql } = {}) => {
      executions += 1;
      // The shape of the real failure: one backfill reads a column the database
      // does not have. Before, this rejected the whole batch, which the
      // authorization gate awaits - so one missing column returned 500 from
      // every gated endpoint, and re-ran on every request.
      if (String(sql || "").includes("v2_program_staff")) {
        throw new Error('column "access_profile_id" does not exist');
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

