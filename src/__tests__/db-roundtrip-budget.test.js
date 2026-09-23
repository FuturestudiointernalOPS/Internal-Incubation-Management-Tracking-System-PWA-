/**
 * DB ROUND-TRIP BUDGET — measurable guard for the read paths we optimised.
 *
 * In the observed environment one database round trip costs ~130ms, so what
 * makes a screen slow is the NUMBER of statements a request issues, not the SQL
 * itself. These tests pin that number per endpoint:
 *
 *   - a budget per request (fail the build if a change adds round trips back),
 *   - and the end of the per-request schema maintenance (statements that must
 *     only ever happen once per process).
 *
 * Counting the calls the route actually makes is the measurement: it is exact,
 * repeatable in CI, and does not need a database.
 */

jest.mock("next/headers", () => ({ cookies: jest.fn(async () => ({ get: () => null })) }));

const executed = [];
const mockExecute = jest.fn(async (query = {}) => {
  const sql = typeof query === "string" ? query : query.sql || "";
  executed.push(sql);
  return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: null };
});

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn(async () => ({ execute: (...args) => mockExecute(...args) })),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
  getAuthorizationContext: jest.fn(async () => null),
  authorize: jest.fn(() => true),
}));

jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual("@/lib/auth");
  return {
    ...actual,
    requireAuth: jest.fn(async () => null),
    getSession: jest.fn(async () => ({ cid: "USER_TEST", role: "super_admin" })),
  };
});

beforeEach(() => {
  executed.length = 0;
  mockExecute.mockClear();
  // The per-process memos (catalogue seed, schema check) are intentionally
  // stored in module state, so every test starts from a fresh process view.
  jest.resetModules();
});

/** Load a module against the freshly reset registry. */
const fresh = (path) => require(path);

const statements = () => executed.length;

/** Statement texts that change the schema — must never leave the boot path. */
const schemaStatements = () =>
  executed.filter((sql) =>
    /^\s*(create\s+table|create\s+(unique\s+)?index|alter\s+table|drop\s+index)/i.test(
      String(sql).replace(/^\s*(--[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/g, ""),
    ),
  );

// ─── Responsibilities: the screen that cost ~25 sequential round trips ──────
// 12 definition upserts + 12 allowed-roles backfills, per request, on a screen
// the application shell loads on every page.

describe("responsibilities — round-trip budget", () => {
  test("a full list costs the one-time seed plus one read, then one read", async () => {
    const { GET } = fresh("@/app/api/responsibilities/route");

    const firstResponse = await GET(new Request("http://localhost/api/responsibilities"));
    expect(firstResponse.status).toBe(200);
    const afterFirst = statements();

    // First request of a process: the one-time schema check (memoised, ~20
    // statements) + the catalogue seed (2 statements) + the read. Before this
    // work the seed alone was 24 statements and it re-ran on EVERY request.
    expect(afterFirst).toBeLessThanOrEqual(25);

    const secondResponse = await GET(new Request("http://localhost/api/responsibilities"));
    expect(secondResponse.status).toBe(200);
    const afterSecond = statements() - afterFirst;

    // Warm process: the whole catalogue and schema work is done — the request
    // costs exactly one read. This is the number that matters: it used to be 25.
    expect(afterSecond).toBe(1);
  });

  test("the catalogue seed itself is two statements, not twenty-four", async () => {
    const { seedDefaultResponsibilities } = fresh("@/lib/auth");
    await fresh("@/lib/auth").ensureResponsibilitiesSchema();
    executed.length = 0;

    await seedDefaultResponsibilities();

    expect(statements()).toBe(2);
  });

  test("a repeated catalogue seed costs nothing further", async () => {
    const { seedDefaultResponsibilities } = fresh("@/lib/auth");
    await seedDefaultResponsibilities();
    executed.length = 0;

    const result = await seedDefaultResponsibilities();

    expect(result).toEqual({ success: true });
    expect(statements()).toBe(0);
  });

  test("seeding the catalogue never costs one statement per responsibility", async () => {
    const { GET } = fresh("@/app/api/responsibilities/route");
    await GET(new Request("http://localhost/api/responsibilities"));

    const inserts = executed.filter((sql) =>
      /insert\s+into\s+responsibilities/i.test(String(sql)),
    );
    const allowanceUpdates = executed.filter((sql) =>
      /update\s+responsibilities/i.test(String(sql)),
    );

    // One batched INSERT and one batched UPDATE — not 12 + 12.
    expect(inserts).toHaveLength(1);
    expect(allowanceUpdates).toHaveLength(1);
    // …and they still follow the original upsert / fill-only semantics.
    expect(inserts[0]).toMatch(/ON CONFLICT \(key\) DO UPDATE/i);
    expect(allowanceUpdates[0]).toMatch(/allowed_roles IS NULL/i);
  });

  test("a per-person read never writes to the catalogue", async () => {
    const { GET } = fresh("@/app/api/responsibilities/route");

    // Warm the catalogue seed first.
    await GET(new Request("http://localhost/api/responsibilities"));
    executed.length = 0;

    const res = await GET(
      new Request("http://localhost/api/responsibilities?user_cid=USER_TEST"),
    );
    expect(res.status).toBe(200);

    expect(executed.filter((sql) => /^(insert|update|delete)/i.test(String(sql).trim()))).toHaveLength(0);
    expect(statements()).toBeLessThanOrEqual(2);
  });
});

// ─── The schema maintenance must not repeat within a process ────────────────
// Guarded at the engine level (src/lib/db.js): every `ensure*` helper can keep
// calling its idempotent DDL, but only the first call in a process reaches the
// database. This test drives the same helper twice through the public surface.

describe("runtime schema maintenance — once per process", () => {
  test("repeating the responsibilities schema check issues no further statements", async () => {
    const { ensureResponsibilitiesSchema } = fresh("@/lib/auth");
    executed.length = 0;

    await ensureResponsibilitiesSchema();
    const firstRun = schemaStatements().length;
    expect(firstRun).toBeGreaterThan(0); // it is genuinely needed on a fresh process

    // The helper is memoised, so a second call is already free — this asserts the
    // contract the engine guard exists to guarantee for the helpers that are NOT
    // memoised.
    executed.length = 0;
    await ensureResponsibilitiesSchema();
    expect(schemaStatements()).toHaveLength(0);
  });
});
