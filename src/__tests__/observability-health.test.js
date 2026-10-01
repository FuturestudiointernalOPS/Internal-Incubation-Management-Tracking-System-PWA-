/**
 * OBSERVABILITY — health checks.
 *
 * Two questions, two endpoints, two answers:
 *   /api/health  — LIVENESS: the process is up. Cheap, no dependency, so a
 *                  database hiccup never turns into a restart.
 *   /api/ready   — READINESS: the database answers within a bound. A hung
 *                  database must produce a FAST 503, not a hung probe.
 *
 * Also pinned: both are reachable without a session (a monitor holds no cookie).
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [{ ok: 1 }], rowCount: 1 })) },
  initDb: jest.fn(async () => {}),
  pingDatabase: jest.fn(async () => ({ rows: [{ ok: 1 }], rowCount: 1 })),
  getPoolStats: jest.fn(() => ({
    initialized: true,
    total: 2,
    idle: 1,
    active: 1,
    waiting: 0,
    max: 10,
  })),
  getDbMetrics: jest.fn(() => ({ queries: 5, slow: 0, avgMs: 12 })),
}));

const dbModule = require("@/lib/db");
const { initDb, pingDatabase } = dbModule;
const { proxy } = require("@/proxy");

const anon = (pathname) => ({
  nextUrl: { pathname },
  url: `https://app.example${pathname}`,
  cookies: { get: () => undefined },
});

beforeEach(() => {
  process.env.LOG_LEVEL = "silent";
  pingDatabase.mockReset();
  pingDatabase.mockResolvedValue({ rows: [{ ok: 1 }], rowCount: 1 });
  initDb.mockReset();
  initDb.mockResolvedValue(undefined);
});

afterAll(() => {
  delete process.env.LOG_LEVEL;
});

describe("GET /api/health — liveness", () => {
  test("answers ok without touching a dependency", async () => {
    const { GET } = require("@/app/api/health/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("impactos");
    expect(typeof body.uptimeSeconds).toBe("number");
    // Liveness must not depend on the database.
    expect(pingDatabase).not.toHaveBeenCalled();
    expect(initDb).not.toHaveBeenCalled();
  });

  test("is never cached", async () => {
    const { GET } = require("@/app/api/health/route");
    const res = await GET();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});

describe("GET /api/ready — readiness", () => {
  test("reports ready with pool and db numbers when the database answers", async () => {
    const { GET } = require("@/app/api/ready/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ready");
    expect(body.checks.database.ok).toBe(true);
    expect(body.pool.waiting).toBe(0);
    expect(body.db.queries).toBe(5);
  });

  test("reports not_ready with a 503 when the database fails", async () => {
    pingDatabase.mockRejectedValueOnce(new Error("connection terminated unexpectedly"));

    const { GET } = require("@/app/api/ready/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("not_ready");
    expect(body.checks.database.ok).toBe(false);
    expect(body.checks.database.error).toContain("connection terminated");
  });

  test("a hung database becomes a fast 503, not a hung probe", async () => {
    // Never resolves — only the probe's own timeout can end it.
    pingDatabase.mockImplementationOnce(() => new Promise(() => {}));
    process.env.READY_TIMEOUT_MS = "25";
    try {
      const { GET } = require("@/app/api/ready/route");
      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.checks.database.error).toContain("timed out");
    } finally {
      delete process.env.READY_TIMEOUT_MS;
    }
  });
});

describe("the probes are public", () => {
  test.each(["/api/health", "/api/ready"])(
    "an anonymous monitor reaches %s",
    (path) => {
      expect(proxy(anon(path)).status).not.toBe(401);
    },
  );

  test("a private API is still refused anonymously", () => {
    expect(proxy(anon("/api/ventures/VNT-1/tasks")).status).toBe(401);
  });
});
