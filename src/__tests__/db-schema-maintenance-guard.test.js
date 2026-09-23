/**
 * RUNTIME SCHEMA MAINTENANCE GUARD — src/lib/db.js
 *
 * ~40 `ensure*` helpers keep older databases usable by issuing idempotent DDL.
 * Most were never memoised, so every request that touched their read path paid
 * for them (~130ms each on the current link). The engine now answers them
 * locally after the first execution in a process.
 *
 * These tests drive the real engine against a fake connection, so they check the
 * guard itself rather than a helper:
 *   - repeated idempotent DDL is sent ONCE per process,
 *   - data statements are NEVER skipped,
 *   - a failed statement is not recorded as applied (it must retry),
 *   - the pool/statement behaviour for ordinary queries is unchanged.
 */

const mockQuery = jest.fn(async () => ({ rows: [], fields: [], rowCount: 0 }));

jest.mock("pg", () => ({
  __esModule: true,
  Pool: jest.fn(() => ({
    query: (...args) => mockQuery(...args),
    on: jest.fn(),
    end: jest.fn(async () => {}),
  })),
}));

beforeEach(() => {
  mockQuery.mockClear();
  jest.resetModules();
});

/** Load a fresh engine with the given environment. */
async function freshDb(env = {}) {
  delete process.env.SKIP_RUNTIME_SCHEMA_MAINTENANCE;
  Object.assign(process.env, env);
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/test";
  const dbModule = await import("@/lib/db");
  return { db: dbModule.default, ...dbModule };
}

const sent = (pattern) =>
  mockQuery.mock.calls.filter((call) => pattern.test(String(call[0])));

describe("idempotent DDL runs once per process", () => {
  test("a repeated CREATE TABLE IF NOT EXISTS is sent once", async () => {
    const { db } = await freshDb();
    const sql = "CREATE TABLE IF NOT EXISTS demo_table (id SERIAL PRIMARY KEY)";

    await db.execute({ sql, args: [] });
    await db.execute({ sql, args: [] });
    await db.execute({ sql, args: [] });

    expect(sent(/CREATE TABLE IF NOT EXISTS demo_table/)).toHaveLength(1);
  });

  test("a repeated ADD COLUMN IF NOT EXISTS is sent once, however it is called", async () => {
    const { db } = await freshDb();
    const sql = "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS nick_name TEXT";

    await db.execute(sql);
    await db.execute({ sql, args: [] });

    expect(sent(/ADD COLUMN IF NOT EXISTS nick_name/)).toHaveLength(1);
  });

  test("a skipped statement resolves with an empty result, not an error", async () => {
    const { db } = await freshDb();
    const sql = "CREATE INDEX IF NOT EXISTS idx_demo ON demo_table (id)";

    await db.execute({ sql, args: [] });
    const second = await db.execute({ sql, args: [] });

    expect(second).toEqual({
      rows: [],
      columns: [],
      rowsAffected: 0,
      lastInsertRowid: null,
    });
  });

  test("the counters report what was sent and what was answered locally", async () => {
    const { db, getDbMetrics } = await freshDb();
    const sql = "CREATE TABLE IF NOT EXISTS demo_counters (id INT)";

    await db.execute({ sql, args: [] });
    await db.execute({ sql, args: [] });

    const metrics = getDbMetrics();
    expect(metrics.ddl).toBe(1);
    expect(metrics.skippedDdl).toBe(1);
    expect(metrics.queries).toBe(1);
  });
});

describe("data statements are never skipped", () => {
  test("a repeated INSERT is sent every time", async () => {
    const { db } = await freshDb();
    const sql = "INSERT INTO contacts (cid) VALUES (?)";

    await db.execute({ sql, args: ["C1"] });
    await db.execute({ sql, args: ["C2"] });

    expect(sent(/INSERT INTO contacts/)).toHaveLength(2);
  });

  test("a repeated SELECT is sent every time", async () => {
    const { db } = await freshDb();
    const sql = "SELECT * FROM contacts WHERE cid = ?";

    await db.execute({ sql, args: ["C1"] });
    await db.execute({ sql, args: ["C1"] });

    expect(sent(/SELECT \* FROM contacts/)).toHaveLength(2);
  });

  test("a DROP CONSTRAINT without IF EXISTS is not treated as maintenance", async () => {
    const { db } = await freshDb();
    const sql = "ALTER TABLE demo_counters DROP CONSTRAINT demo_check";

    await db.execute({ sql, args: [] });
    await db.execute({ sql, args: [] });

    expect(sent(/DROP CONSTRAINT demo_check/)).toHaveLength(2);
  });
});

describe("failures and the deploy switch", () => {
  test("a statement that failed is retried instead of being remembered", async () => {
    const { db } = await freshDb();
    const sql = "CREATE TABLE IF NOT EXISTS demo_retry (id INT)";

    mockQuery.mockRejectedValueOnce(new Error("transient failure"));
    await expect(db.execute({ sql, args: [] })).rejects.toThrow("transient failure");

    await db.execute({ sql, args: [] });
    expect(sent(/CREATE TABLE IF NOT EXISTS demo_retry/)).toHaveLength(2);
  });

  test("SKIP_RUNTIME_SCHEMA_MAINTENANCE sends no maintenance statement at all", async () => {
    const { db } = await freshDb({ SKIP_RUNTIME_SCHEMA_MAINTENANCE: "true" });
    const maintenanceSql = "CREATE TABLE IF NOT EXISTS demo_skipped (id INT)";
    const data = "SELECT 1";

    const result = await db.execute({ sql: maintenanceSql, args: [] });
    await db.execute({ sql: data, args: [] });

    expect(sent(/CREATE TABLE IF NOT EXISTS demo_skipped/)).toHaveLength(0);
    expect(sent(/^SELECT 1$/)).toHaveLength(1); // ordinary queries still run
    expect(result.rows).toEqual([]);
  });
});

describe("ordinary queries keep their behaviour", () => {
  test("parameters are still translated and rows are returned", async () => {
    const { db } = await freshDb();
    mockQuery.mockResolvedValueOnce({
      rows: [{ cid: "C1" }],
      fields: [{ name: "cid" }],
      rowCount: 1,
    });

    const res = await db.execute({
      sql: "SELECT cid FROM contacts WHERE cid = ? AND status = ?",
      args: ["C1", "active"],
    });

    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT cid FROM contacts WHERE cid = $1 AND status = $2",
      ["C1", "active"],
    );
    expect(res.rows).toEqual([{ cid: "C1" }]);
    expect(res.columns).toEqual(["cid"]);
  });

  test("the legacy datetime() dialect is still translated", async () => {
    const { db } = await freshDb();

    await db.execute({ sql: "UPDATE t SET x = datetime('now')", args: [] });

    expect(mockQuery).toHaveBeenCalledWith(
      "UPDATE t SET x = NOW()",
      [],
    );
  });
});
