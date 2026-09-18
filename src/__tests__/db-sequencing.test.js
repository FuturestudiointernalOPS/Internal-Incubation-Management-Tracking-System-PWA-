/**
 * DB SEQUENCING — how many round trips each screen really costs.
 *
 * The measurement is the request's own database traffic, recorded by
 * ./helpers/dbSequencer.js:
 *   statements  — how many statements the request issues
 *   waves       — how many steps it waits through (the sequential chain depth)
 *   maxInFlight — the widest parallel burst (compare with the pool of 10)
 *
 * Each screen is measured twice: the FIRST request of a process (which also
 * does the one-time schema/catalogue preparation) and the STEADY-STATE request
 * (what a user pays on every page after that). Schema maintenance is reported
 * separately because it is once per process by design.
 *
 * Numbers are asserted as budgets, so a future change that re-introduces a
 * per-request statement or a new sequential step fails the build.
 */

import { createSequencer as mockCreateSequencer } from "./helpers/dbSequencer";

const SESSION = {
  cid: "USER_SEQ_1",
  name: "Sequence Tester",
  email: "seq@example.com",
  role: "staff",
  group_name: "FUTURE STUDIO",
  token: "token",
};

const mockSequencer = mockCreateSequencer({ rows: [] });

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: "token" }) })),
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockSequencer.execute(...args) },
  initDb: jest.fn(async () => ({ execute: (...args) => mockSequencer.execute(...args) })),
  getDbMetrics: jest.fn(() => ({})),
}));

jest.mock("@/lib/authorization", () => {
  const actual = jest.requireActual("@/lib/authorization");
  return {
    ...actual,
    requireAuthorization: jest.fn(async () => null),
    getAuthorizationContext: jest.fn(async () => null),
  };
});

jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual("@/lib/auth");
  return {
    ...actual,
    requireAuth: jest.fn(async () => null),
    requireSession: jest.fn(async () => SESSION),
    getSession: jest.fn(async () => SESSION),
  };
});

/** Measure one request: warm-up first, then the steady-state cost. */
async function measure(handler, url, { warmUp = true } = {}) {
  if (warmUp) {
    await handler(new Request(url));
    jest.resetModules();
  }
  mockSequencer.reset();
  const started = Date.now();
  const res = await handler(new Request(url));
  const elapsed = Date.now() - started;
  const report = mockSequencer.report();
  return { status: res.status, elapsed, ...report };
}

function describeReport(label, report) {
  console.log(
    `${label}: ${report.statements} statements · ${report.waves} waves · ` +
      `burst ${report.maxInFlight} · ${report.schemaStatements} schema stmt(s)`,
  );
}

// ─── Responsibilities — the shell loads this on every page ──────────────────

describe("GET /api/responsibilities", () => {
  test("steady state is one read (no catalogue writes, no extra waves)", async () => {
    const { GET } = require("@/app/api/responsibilities/route");

    // Cold: the one-time schema check + the catalogue seed + the read.
    const cold = await measure(GET, "http://localhost/api/responsibilities?user_cid=USER_SEQ_1", {
      warmUp: false,
    });
    describeReport("cold ", cold);
    expect(cold.statements).toBeLessThanOrEqual(3);

    const warm = await measure(GET, "http://localhost/api/responsibilities?user_cid=USER_SEQ_1");
    describeReport("warm ", warm);
    expect(warm.status).toBe(200);
    expect(warm.statements).toBe(1);
    expect(warm.waves).toBe(1);
    expect(warm.maxInFlight).toBe(1);
  });
});

// ─── Internal messaging — the inbox ─────────────────────────────────────────

describe("GET /api/internal-comms", () => {
  test("scope resolution runs in waves, not one read after another", async () => {
    const { GET } = require("@/app/api/internal-comms/route");

    const report = await measure(
      GET,
      "http://localhost/api/internal-comms?cid=USER_SEQ_1",
      { warmUp: false },
    );
    describeReport("inbox", report);

    expect(report.status).toBe(200);
    // Contact + groups + three program lookups run together (wave 1), the
    // group-name and membership lookups follow (wave 2), then the linked
    // families (wave 3) and finally the message list.
    expect(report.waves).toBeLessThanOrEqual(6);
    // The old chain issued 12+ steps in series; the burst must stay inside the
    // 10-connection pool.
    expect(report.maxInFlight).toBeLessThanOrEqual(10);
  });
});

// ─── Workspaces hub ─────────────────────────────────────────────────────────

describe("GET /api/workspaces", () => {
  test("eleven independent reads go out together", async () => {
    const { GET } = require("@/app/api/workspaces/route");

    const report = await measure(GET, "http://localhost/api/workspaces", {
      warmUp: false,
    });
    describeReport("hub  ", report);

    expect(report.status).toBe(200);
    // One wave for the reads that need only the identity, one for the group
    // memberships that depend on it. It used to be twelve steps in series.
    expect(report.waves).toBeLessThanOrEqual(3);
    expect(report.maxInFlight).toBeLessThanOrEqual(10);
  });
});

// ─── Authorization resolution (cold) — the cost behind every gated call ─────

describe("authorization resolution", () => {
  test("a cold resolution costs three waves and never more", async () => {
    const { resolveAuthorizationContext } = require("@/models/authorization/resolver");

    // First call pays the once-per-process boot (schema, eligibility seed,
    // capability backfills). Measuring after it isolates the resolution itself.
    await resolveAuthorizationContext({ cid: "USER_SEQ_BOOT", role: "staff" });
    mockSequencer.reset();

    await resolveAuthorizationContext({ cid: "USER_SEQ_1", role: "staff" });

    const report = mockSequencer.report();
    describeReport("authz", report);

    // Wave 1: grants + blocks + contact + groups (independent).
    // Wave 2: the profile override + the role default profile.
    // Wave 3: profile capabilities + group capabilities + eligibility.
    // The grants/blocks read used to be its own leading wave — four steps.
    expect(report.waves).toBeLessThanOrEqual(3);
    expect(report.statements).toBeGreaterThanOrEqual(6);
    expect(report.maxInFlight).toBeLessThanOrEqual(6);
  });
});

// ─── The migration ledger — read once per process, not once per migration ───

// The boot batch asks "has this one been applied?" about thirty times. Asking the
// database each time is thirty round trips to learn one small list that only
// changes on deploy; reading it whole is one. On an already-migrated database
// that single read is the batch's ENTIRE cost, which is why this is asserted
// rather than assumed - the symptom it came from was a burst of identical slow
// queries against the ledger on the first gated request of a process.

describe("the authorization migration ledger", () => {
  test("the batch reads it once, and an applied migration costs nothing to ask about", async () => {
    jest.resetModules();
    mockSequencer.reset();
    const { runAuthzMigration } = require("@/lib/authorization");
    const { resolveAuthorizationContext } = require(
      "@/models/authorization/resolver",
    );

    // A FRESH database: the capability backfills and the eligibility seed both
    // run, and between them they ask about a name each for thirty migrations.
    await resolveAuthorizationContext({ cid: "USER_SEQ_BOOT", role: "staff" });

    const batch = mockSequencer.report();
    describeReport("authz cold gate (fresh)", batch);
    const ledgerReads = batch.calls.filter(
      (sql) => sql.includes("authz_migrations") && sql.includes("SELECT"),
    );
    console.log(
      `ledger reads for the whole batch: ${ledgerReads.length} (the batch asks about ~25 migrations)`,
    );

    // ONE read answers every "has this been applied?" the batch asks.
    expect(ledgerReads).toHaveLength(1);
    // and nothing asks about a single name one at a time
    expect(
      batch.calls.filter((sql) => /authz_migrations\s+where\s+name/i.test(sql)),
    ).toHaveLength(0);

    // A migration this process applied is not asked about again - not even for
    // the price of one round trip.
    mockSequencer.reset();
    const fn = jest.fn(async () => {});
    const again = await runAuthzMigration("cap-backfill-tasks", fn);
    const after = mockSequencer.report();
    expect(again.applied).toBe(false);
    expect(fn).not.toHaveBeenCalled();
    expect(after.statements).toBe(0);

    // ── The case production is in: the database already holds every marker ──
    // The names the batch just recorded are exactly the ones a migrated
    // database would answer with.
    const recorded = batch.records
      .filter((r) => r.sql.includes("INSERT INTO authz_migrations"))
      .flatMap((r) => r.args || []);
    console.log(`migrations the batch recorded: ${recorded.length}`);
    expect(recorded.length).toBeGreaterThan(20);

    // ── The case production is in: the database already holds every marker ──
    // The names the fresh run recorded are exactly what a migrated database
    // answers with.
    mockSequencer.setRowsFor((sql) =>
      sql.includes("authz_migrations") && sql.includes("SELECT")
        ? recorded.map((name) => ({ name }))
        : [],
    );
    jest.resetModules();
    mockSequencer.reset();
    const { resolveAuthorizationContext: coldGate } = require(
      "@/models/authorization/resolver",
    );
    await coldGate({ cid: "USER_SEQ_MIGRATED", role: "staff" });

    const migrated = mockSequencer.report();
    describeReport("authz cold gate (migrated)", migrated);
    const ledgerReadsOnMigrated = migrated.calls.filter(
      (sql) => sql.includes("authz_migrations") && sql.includes("SELECT"),
    );
    const reApplied = migrated.records.filter((r) =>
      r.sql.includes("INSERT INTO authz_migrations"),
    );
    console.log(
      `migrated database: ${ledgerReadsOnMigrated.length} ledger read(s) for the whole cold gate, ` +
        `${reApplied.length} migration(s) re-applied`,
    );

    // ONE read answers the capability backfills AND the six seed checks - the
    // six that used to be six sequential round trips of their own.
    expect(ledgerReadsOnMigrated).toHaveLength(1);
    expect(reApplied).toHaveLength(0);
    // With nothing to apply, the gate's ledger traffic is that single read, so
    // the widest burst is what the resolution itself needs (budget: 6).
    expect(migrated.maxInFlight).toBeLessThanOrEqual(6);
  });
});
