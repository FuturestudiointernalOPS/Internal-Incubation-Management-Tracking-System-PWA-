/**
 * OBSERVABILITY — database latency, pool and transaction visibility.
 *
 * These tests drive the REAL engine (src/lib/db.js) against a fake connection,
 * so they check the instrumentation rather than a mock of it:
 *   - a slow statement is reported as a structured event, WITHOUT its SQL or its
 *     arguments (which can carry personal data),
 *   - the process counters distinguish medium/slow statements and expose a
 *     latency histogram and the slowest observed statement,
 *   - the pool counters separate "slow SQL" from "waiting for a connection",
 *   - a rolled-back transaction is visible as such.
 */

const mockQuery = jest.fn(async () => ({ rows: [], fields: [], rowCount: 0 }));
const mockClientQuery = jest.fn(async () => ({ rows: [], fields: [], rowCount: 0 }));
const mockRelease = jest.fn();

jest.mock("pg", () => ({
  __esModule: true,
  Pool: jest.fn(() => ({
    query: (...args) => mockQuery(...args),
    on: jest.fn(),
    end: jest.fn(async () => {}),
    connect: async () => ({ query: (...args) => mockClientQuery(...args), release: mockRelease }),
    totalCount: 3,
    idleCount: 1,
    waitingCount: 4,
  })),
}));

beforeEach(() => {
  mockQuery.mockClear();
  mockClientQuery.mockClear();
  mockRelease.mockClear();
  mockQuery.mockResolvedValue({ rows: [], fields: [], rowCount: 0 });
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/test";
  delete process.env.LOG_LEVEL;
  jest.resetModules();
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Load a fresh engine against the fake pool. */
async function freshDb() {
  const mod = await import("@/lib/db");
  return { ...mod, db: mod.default };
}

/** Make each Date.now() call advance by `step` ms — a deterministic duration. */
function clockAdvancingBy(step) {
  let now = 0;
  return jest.spyOn(Date, "now").mockImplementation(() => (now += step));
}

const joined = (spy) => spy.mock.calls.map((call) => call[0]).join("\n");

describe("slow-query detection", () => {
  test("a critical statement is an error event that omits the SQL and the args", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const { db, getDbMetrics } = await freshDb();

    const clock = clockAdvancingBy(1200); // duration = 1200ms → critical
    await db.execute({
      sql: "SELECT secret_column FROM sensitive_table WHERE token = ?",
      args: ["super-secret-value"],
    });
    clock.mockRestore();

    const line = joined(error);
    expect(line).toContain("db_slow_query");
    expect(line).toContain("SELECT"); // the operation label
    expect(line).not.toContain("sensitive_table");
    expect(line).not.toContain("secret_column");
    expect(line).not.toContain("super-secret-value");
    expect(error).toHaveBeenCalled();

    const metrics = getDbMetrics();
    expect(metrics.queries).toBe(1);
    expect(metrics.slow).toBe(1);
    expect(metrics.maxMs).toBe(1200);
  });

  test("a statement between the two thresholds is only a warning", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { db, getDbMetrics } = await freshDb();

    const clock = clockAdvancingBy(700); // 700ms → medium
    await db.execute({ sql: "UPDATE t SET x = ?", args: [1] });
    clock.mockRestore();

    expect(joined(warn)).toContain("db_medium_query");
    const metrics = getDbMetrics();
    expect(metrics.slowWarn).toBe(1);
    expect(metrics.slow).toBe(0);
  });

  test("a fast statement is silent at default level and lands in the low band", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const { db, getDbMetrics } = await freshDb();

    const clock = clockAdvancingBy(10); // 10ms
    await db.execute({ sql: "SELECT 1", args: [] });
    clock.mockRestore();

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(getDbMetrics().histogram.lt100).toBe(1);
  });

  test("a failing query is reported with its operation but not its arguments, and rethrows", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const { db } = await freshDb();
    mockQuery.mockRejectedValueOnce(new Error('violates unique constraint "contacts_email_key"'));

    await expect(
      db.execute({ sql: "INSERT INTO contacts (email) VALUES (?)", args: ["person@example.com"] }),
    ).rejects.toThrow(/unique constraint/);

    const line = joined(error);
    expect(line).toContain("db_query_failed");
    expect(line).toContain("INSERT");
    expect(line).not.toContain("person@example.com");
  });
});

describe("pool visibility", () => {
  test("before any query the pool reports as uninitialised", async () => {
    const { getPoolStats } = await freshDb();
    expect(getPoolStats()).toEqual({
      initialized: false,
      total: 0,
      idle: 0,
      active: 0,
      waiting: 0,
      max: 0,
    });
  });

  test("after a query the live pool counters are exposed", async () => {
    const { db, getPoolStats } = await freshDb();
    await db.execute({ sql: "SELECT 1", args: [] });

    expect(getPoolStats()).toEqual({
      initialized: true,
      total: 3,
      idle: 1,
      active: 2,
      waiting: 4,
      max: 10,
    });
  });

  test("a slow request records how many callers were waiting for a connection", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const { db } = await freshDb();

    const clock = clockAdvancingBy(1200);
    await db.execute({ sql: "SELECT 1", args: [] });
    clock.mockRestore();

    // waitingCount was 4 → the log distinguishes "waiting for a connection".
    expect(joined(error)).toContain('"poolWaiting":4');
  });
});

describe("transaction visibility", () => {
  test("a rolled-back transaction is reported and the ROLLBACK is issued", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { db } = await freshDb();

    await expect(
      db.transaction(async (query) => {
        await query("INSERT INTO t (x) VALUES (?)", [1]);
        throw new Error("second step failed");
      }),
    ).rejects.toThrow("second step failed");

    const statements = mockClientQuery.mock.calls.map((call) => call[0]);
    expect(statements).toContain("ROLLBACK");
    expect(mockRelease).toHaveBeenCalled();
    expect(joined(warn)).toContain("db_transaction_rolled_back");
  });

  test("a committed transaction reports how many statements it ran", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    process.env.LOG_LEVEL = "debug";
    const { db } = await freshDb();

    await db.transaction(async (query) => {
      await query("INSERT INTO t (x) VALUES (?)", [1]);
      await query("UPDATE t SET x = ?", [2]);
    });

    const statements = mockClientQuery.mock.calls.map((call) => call[0]);
    expect(statements).toContain("BEGIN");
    expect(statements).toContain("COMMIT");
    expect(joined(log)).toContain("db_transaction_committed");
  });
});

describe("metrics shape", () => {
  test("the summary exposes a histogram, an average and the slowest statement", async () => {
    const { db, getDbMetrics } = await freshDb();

    const clock = clockAdvancingBy(40);
    await db.execute({ sql: "SELECT 1", args: [] });
    await db.execute({ sql: "SELECT 2", args: [] });
    clock.mockRestore();

    const metrics = getDbMetrics();
    expect(metrics.queries).toBe(2);
    expect(metrics.dbMs).toBe(80);
    expect(metrics.avgMs).toBe(40);
    expect(metrics.histogram).toEqual({ lt100: 2, lt500: 0, lt1000: 0, gte1000: 0 });
  });
});
