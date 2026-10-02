/**
 * OBSERVABILITY — the error-ingest endpoint (/api/errors).
 *
 * This is both an observability primitive (client and server errors land here)
 * and an unauthenticated write endpoint, so its tests are about the guards as
 * much as the happy path:
 *   - a flood from one client is throttled BEFORE any database work,
 *   - a report without a message is rejected,
 *   - a repeat of the same unresolved error deduplicates instead of inserting,
 *   - reading and triaging errors requires a capability,
 *   - the response never echoes the submitted payload back.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  initDb: jest.fn(async () => {}),
  default: { execute: jest.fn(async () => ({ rows: [] })) },
}));

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

jest.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: jest.fn(() => null),
  getClientIp: jest.fn(() => "203.0.113.9"),
}));

jest.mock("@/models/adminOps", () => ({
  findRecentErrorByFingerprint: jest.fn(async () => ({ rows: [] })),
  findRecentErrorByMessageAndPage: jest.fn(async () => ({ rows: [] })),
  incrementErrorOccurrence: jest.fn(async () => ({})),
  insertErrorLog: jest.fn(async () => ({ rows: [{ id: 42 }] })),
  listErrorLogs: jest.fn(async () => ({ rows: [{ id: 1, message: "boom" }] })),
  updateErrorResolution: jest.fn(async () => ({})),
  updateErrorResolutionNotes: jest.fn(async () => ({})),
  updateErrorTaskId: jest.fn(async () => ({})),
}));

const { POST, GET, PATCH } = require("@/app/api/errors/route");
const { requireAuthorization } = require("@/models/authorization/index");
const { enforceRateLimit } = require("@/lib/rate-limit");
const { NextResponse } = require("next/server");
const adminOps = require("@/models/adminOps");
const { initDb } = require("@/lib/db");

const post = (body) =>
  new Request("http://localhost/api/errors", {
    method: "POST",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jest.clearAllMocks();
  enforceRateLimit.mockReturnValue(null);
  requireAuthorization.mockResolvedValue(null);
  adminOps.findRecentErrorByFingerprint.mockResolvedValue({ rows: [] });
  adminOps.findRecentErrorByMessageAndPage.mockResolvedValue({ rows: [] });
  adminOps.insertErrorLog.mockResolvedValue({ rows: [{ id: 42 }] });
  adminOps.listErrorLogs.mockResolvedValue({ rows: [{ id: 1, message: "boom" }] });
});

describe("POST /api/errors — ingestion", () => {
  test("a report without a message is a 400 and touches nothing", async () => {
    const res = await POST(post({ page: "/x" }));
    expect(res.status).toBe(400);
    expect(initDb).not.toHaveBeenCalled();
    expect(adminOps.insertErrorLog).not.toHaveBeenCalled();
  });

  test("a throttled client gets 429 before any database work", async () => {
    enforceRateLimit.mockReturnValueOnce(
      NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 }),
    );

    const res = await POST(post({ message: "boom" }));

    expect(res.status).toBe(429);
    expect(initDb).not.toHaveBeenCalled();
    expect(adminOps.findRecentErrorByFingerprint).not.toHaveBeenCalled();
  });

  test("a new error is categorised, fingerprinted and inserted", async () => {
    const res = await POST(
      post({
        message: "API GET /api/x returned 500",
        status_code: 500,
        endpoint: "/api/x",
        page: "/admin",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deduplicated).toBe(false);
    expect(adminOps.insertErrorLog).toHaveBeenCalledTimes(1);
    const [, category, fingerprint] = adminOps.insertErrorLog.mock.calls[0];
    expect(category).toBe("server_error");
    expect(typeof fingerprint).toBe("string");
    expect(fingerprint.length).toBeGreaterThan(0);
  });

  test("a repeat of the same unresolved error increments instead of inserting", async () => {
    adminOps.findRecentErrorByFingerprint.mockResolvedValue({
      rows: [{ id: 7, occurrence_count: 3 }],
    });

    const res = await POST(post({ message: "boom", page: "/admin" }));
    const body = await res.json();

    expect(body.deduplicated).toBe(true);
    expect(body.occurrence_count).toBe(4);
    expect(adminOps.incrementErrorOccurrence).toHaveBeenCalledWith(7, 4, expect.anything());
    expect(adminOps.insertErrorLog).not.toHaveBeenCalled();
  });

  test("falls back to message+page matching when the fingerprint column is absent", async () => {
    adminOps.findRecentErrorByFingerprint.mockRejectedValueOnce(
      new Error('column "fingerprint" does not exist'),
    );
    adminOps.findRecentErrorByMessageAndPage.mockResolvedValue({
      rows: [{ id: 9, occurrence_count: 1 }],
    });

    const res = await POST(post({ message: "boom", page: "/admin" }));
    const body = await res.json();

    expect(body.deduplicated).toBe(true);
    expect(adminOps.findRecentErrorByMessageAndPage).toHaveBeenCalled();
  });

  test("never echoes the submitted payload back to the client", async () => {
    const res = await POST(
      post({ message: "boom", sessionToken: "secret-token", email: "person@example.com" }),
    );
    const text = await res.text();

    expect(text).not.toContain("secret-token");
    expect(text).not.toContain("person@example.com");
  });
});

describe("GET /api/errors — triage requires a capability", () => {
  test("a caller without the capability is refused and reads nothing", async () => {
    requireAuthorization.mockResolvedValueOnce(
      NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { status: 403 }),
    );

    const res = await GET(new Request("http://localhost/api/errors"));

    expect(res.status).toBe(403);
    expect(adminOps.listErrorLogs).not.toHaveBeenCalled();
  });

  test("an authorised caller lists the errors", async () => {
    const res = await GET(new Request("http://localhost/api/errors?severity=error"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.errors).toHaveLength(1);
    expect(requireAuthorization).toHaveBeenCalledWith("engineering", "manage_errors");
  });
});

describe("PATCH /api/errors — triage updates", () => {
  test("a patch without an id is a 400", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/errors", {
        method: "PATCH",
        body: JSON.stringify({ resolved: true }),
      }),
    );
    expect(res.status).toBe(400);
    expect(adminOps.updateErrorResolution).not.toHaveBeenCalled();
  });

  test("resolving an error writes the resolution and the task link", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/errors", {
        method: "PATCH",
        body: JSON.stringify({ id: 5, resolved: true, resolution_notes: "fixed", task_id: 99 }),
      }),
    );

    expect(res.status).toBe(200);
    expect(adminOps.updateErrorResolution).toHaveBeenCalledWith(5, true, "fixed");
    expect(adminOps.updateErrorTaskId).toHaveBeenCalledWith(5, 99);
  });

  test("a caller without the capability cannot triage", async () => {
    requireAuthorization.mockResolvedValueOnce(
      NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { status: 403 }),
    );

    const res = await PATCH(
      new Request("http://localhost/api/errors", {
        method: "PATCH",
        body: JSON.stringify({ id: 5, resolved: true }),
      }),
    );

    expect(res.status).toBe(403);
    expect(adminOps.updateErrorResolution).not.toHaveBeenCalled();
  });
});
