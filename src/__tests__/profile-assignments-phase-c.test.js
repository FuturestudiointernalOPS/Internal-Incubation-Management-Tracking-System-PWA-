/**
 * PHASE C — the unified assignment registry
 * (docs/ROADMAP_ROLES_PROFILES_ACCESS.md).
 *
 * Three surfaces:
 *   1. the PURE decisions — date normalisation, the active predicate, manual
 *      validation, and the relation → source mapping;
 *   2. the STORE's schema self-heal, its three reads and its write shape (one
 *      period = one INSERT; closing is guarded on `status = 'active'`);
 *   3. the API contract (GET by person, POST open, PATCH close, both writes
 *      gated) run against the REAL store over a mocked database.
 */

const mockState = {
  assignments: [],
  activeKeys: [],
  activeFound: [],
  contextRows: [],
  rowById: null,
  profiles: [],
  updateAffected: 1,
  audit: [],
};

function mockExecute(query) {
  const sql = typeof query === "string" ? query : query.sql || "";

  if (/^\s*(CREATE TABLE|CREATE INDEX)/i.test(sql)) return { rows: [] };

  // getProfileAssignmentById — checked BEFORE the generic list read.
  if (sql.includes("FROM profile_assignments") && sql.includes("WHERE id = ?")) {
    return { rows: mockState.rowById ? [mockState.rowById] : [] };
  }
  // findActiveAssignment
  if (sql.includes("FROM profile_assignments") && sql.includes("LIMIT 1")) {
    return { rows: mockState.activeFound };
  }
  // listActiveProfileKeys
  if (sql.includes("DISTINCT profile_key")) {
    return { rows: mockState.activeKeys };
  }
  // listAssignmentsForContextAndProfile (context_id IS NOT DISTINCT FROM)
  if (
    sql.includes("FROM profile_assignments") &&
    sql.includes("context_id IS NOT DISTINCT FROM")
  ) {
    return { rows: mockState.contextRows };
  }
  // listProfileAssignments
  if (sql.includes("FROM profile_assignments") && sql.includes("WHERE contact_cid = ?")) {
    return { rows: mockState.assignments };
  }
  if (sql.includes("INSERT INTO profile_assignments")) {
    return { rows: [{ id: 900 + mockState.assignments.length }] };
  }
  if (sql.includes("UPDATE profile_assignments")) {
    return { rows: [], rowsAffected: mockState.updateAffected };
  }
  if (sql.includes("FROM profiles")) return { rows: mockState.profiles };

  return { rows: [] };
}

const mockDb = { execute: jest.fn(async (query) => mockExecute(query)) };

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn(async () => true),
}));

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => ({ cid: "U-ADMIN", name: "Admin" })),
}));

jest.mock("@/models/authorization/accessQueries", () => ({
  logPermissionAudit: jest.fn(async (entry) => {
    mockState.audit.push(entry);
  }),
}));

jest.mock("@/lib/requestOrigin", () => ({
  requireSameOrigin: jest.fn(() => null),
}));

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const {
  ASSIGNMENT_SOURCES,
  CLOSE_ACTIONS,
  deriveAssignmentSource,
  isAssignmentActive,
  normalizeAssignmentDate,
  validateProfileAssignment,
} = require("@/services/authorization/profileAssignments");

const sqlOf = (call) => {
  const first = call[0];
  return typeof first === "string" ? first : String(first?.sql || "");
};
const callsMatching = (pattern) =>
  mockDb.execute.mock.calls.filter((call) => pattern.test(sqlOf(call)));

beforeEach(() => {
  mockDb.execute.mockClear();
  mockDb.execute.mockImplementation(async (query) => mockExecute(query));
  mockState.assignments = [];
  mockState.activeKeys = [];
  mockState.activeFound = [];
  mockState.contextRows = [];
  mockState.rowById = null;
  mockState.profiles = [];
  mockState.updateAffected = 1;
  mockState.audit = [];
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── 1. Pure decisions ────────────────────────────────────────────────────────

describe("normalizeAssignmentDate", () => {
  test("an absent date is open-ended, not an error", () => {
    expect(normalizeAssignmentDate(null)).toEqual({ ok: true, value: null });
    expect(normalizeAssignmentDate("")).toEqual({ ok: true, value: null });
    expect(normalizeAssignmentDate(undefined)).toEqual({ ok: true, value: null });
  });

  test("a valid date becomes a full ISO string", () => {
    const result = normalizeAssignmentDate("2026-03-01");
    expect(result.ok).toBe(true);
    expect(result.value).toMatch(/^2026-03-01T00:00:00/);
  });

  test("an unparseable date is refused", () => {
    expect(normalizeAssignmentDate("not a date").ok).toBe(false);
  });
});

describe("isAssignmentActive", () => {
  const NOW = "2026-06-15T00:00:00.000Z";

  test("active with no end is live", () => {
    expect(isAssignmentActive({ status: "active", ends_at: null }, NOW)).toBe(true);
  });
  test("active with a future end is live", () => {
    expect(isAssignmentActive({ status: "active", ends_at: "2026-12-31" }, NOW)).toBe(true);
  });
  test("active but EXPIRED is not live", () => {
    expect(isAssignmentActive({ status: "active", ends_at: "2026-01-01" }, NOW)).toBe(false);
  });
  test("ended or revoked is never live", () => {
    expect(isAssignmentActive({ status: "ended", ends_at: null }, NOW)).toBe(false);
    expect(isAssignmentActive({ status: "revoked", ends_at: null }, NOW)).toBe(false);
  });
});

describe("validateProfileAssignment", () => {
  test("accepts a known profile and defaults the context from the catalogue", () => {
    const result = validateProfileAssignment({ cid: "C1", profile_key: "founder" });
    expect(result.valid).toBe(true);
    expect(result.normalized).toMatchObject({
      contactCid: "C1",
      profileKey: "founder",
      contextType: "venture",
      source: "manual",
    });
  });

  test("refuses an unknown profile", () => {
    const result = validateProfileAssignment({ cid: "C1", profile_key: "ghost" });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown profile");
  });

  test("refuses a context that does not match the profile", () => {
    const result = validateProfileAssignment({
      cid: "C1",
      profile_key: "founder",
      context_type: "program",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("does not match");
  });

  test("refuses an end before the start", () => {
    const result = validateProfileAssignment({
      cid: "C1",
      profile_key: "founder",
      started_at: "2026-06-01",
      ends_at: "2026-01-01",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("ends_at must be at or after");
  });

  test("refuses an invalid date and an unknown source", () => {
    expect(validateProfileAssignment({ cid: "C1", profile_key: "founder", ends_at: "nope" }).valid).toBe(false);
    expect(validateProfileAssignment({ cid: "C1", profile_key: "founder", source: "guessed" }).valid).toBe(false);
  });

  test("requires the person's id", () => {
    expect(validateProfileAssignment({ profile_key: "founder" }).valid).toBe(false);
  });

  test("the two sources are exactly manual and automatic", () => {
    expect(ASSIGNMENT_SOURCES).toEqual(["manual", "automatic"]);
  });
});

describe("deriveAssignmentSource", () => {
  test("maps a known relationship to its context and the automatic source", () => {
    expect(
      deriveAssignmentSource({ type: "venture_founder", contextId: "VNT-1" }),
    ).toEqual({ source: "automatic", contextType: "venture", contextId: "VNT-1" });
    expect(deriveAssignmentSource({ type: "program_manager" })).toEqual({
      source: "automatic",
      contextType: "program",
      contextId: null,
    });
  });

  test("an unmapped relationship yields nothing (never a contextless record)", () => {
    expect(deriveAssignmentSource({ type: "made_up" })).toBeNull();
    expect(deriveAssignmentSource(null)).toBeNull();
  });

  test("close action 'close' ends a period, 'revoke' revokes it", () => {
    expect(CLOSE_ACTIONS).toEqual({ close: "ended", revoke: "revoked" });
  });
});

// ── 2. Store ─────────────────────────────────────────────────────────────────

describe("profile assignments store", () => {
  const loadStore = () => {
    jest.resetModules();
    return require("@/models/authorization/profileAssignmentsStore");
  };

  test("creates its table once per process, idempotently", async () => {
    const { ensureProfileAssignmentsSchema } = loadStore();
    await ensureProfileAssignmentsSchema();
    await ensureProfileAssignmentsSchema();
    expect(callsMatching(/CREATE TABLE IF NOT EXISTS profile_assignments/i)).toHaveLength(1);
  });

  test("listActiveProfileKeys excludes ended/revoked and expired rows in SQL", async () => {
    const { listActiveProfileKeys } = loadStore();
    await listActiveProfileKeys("C1");
    const sql = sqlOf(callsMatching(/DISTINCT profile_key/i)[0]);
    expect(sql).toMatch(/status = 'active'/i);
    expect(sql).toMatch(/ends_at IS NULL OR ends_at > NOW\(\)/i);
  });

  test("a reactivation is a SECOND insert — an existing period is never rewritten", async () => {
    const { insertProfileAssignment } = loadStore();
    const base = {
      contactCid: "C1",
      profileKey: "founder",
      contextType: "venture",
      startedAt: "2026-01-01T00:00:00.000Z",
    };
    await insertProfileAssignment(base);
    await insertProfileAssignment({ ...base, startedAt: "2026-06-01T00:00:00.000Z" });
    expect(callsMatching(/INSERT INTO profile_assignments/i)).toHaveLength(2);
    expect(callsMatching(/UPDATE profile_assignments/i)).toHaveLength(0);
  });

  test("closing is guarded on the row still being active", async () => {
    const { closeProfileAssignment } = loadStore();
    await closeProfileAssignment({ id: 5, status: "ended" });
    const sql = sqlOf(callsMatching(/UPDATE profile_assignments/i)[0]);
    expect(sql).toMatch(/SET status = \?/i);
    expect(sql).toMatch(/status = 'active'/i);
    expect(sql).toMatch(/ended_at = COALESCE\(\?, NOW\(\)\)/i);
  });
});

// ── 3. Route contract ────────────────────────────────────────────────────────

describe("GET/POST/PATCH /api/engineering/permissions/profile-assignments", () => {
  const loadRoute = () => {
    jest.resetModules();
    return require("@/app/api/engineering/permissions/profile-assignments/route");
  };

  const getReq = (cid) =>
    new Request(
      `http://localhost/api/engineering/permissions/profile-assignments${cid ? `?cid=${cid}` : ""}`,
    );
  const jsonReq = (method, body) =>
    new Request("http://localhost/api/engineering/permissions/profile-assignments", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  test("GET is gated on view_matrix, needs a cid, and returns periods + catalogue", async () => {
    const route = loadRoute();
    const { requireAuthorization } = require("@/models/authorization/index");
    mockState.assignments = [
      { id: 1, profile_key: "founder", context_type: "venture", context_id: null, status: "active", source: "manual" },
    ];
    mockState.profiles = [{ key: "founder", context: "venture", is_active: 1 }];

    const res = await route.GET(getReq("C1"));
    const body = await res.json();

    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
    expect(body.success).toBe(true);
    expect(body.assignments).toHaveLength(1);
    expect(body.profiles[0]).toMatchObject({
      key: "founder",
      context: "venture",
      label_key: "engineering.permissions.profileFounder",
    });
  });

  test("GET without a cid is a 400 and reads nothing", async () => {
    const route = loadRoute();
    const res = await route.GET(getReq());
    expect(res.status).toBe(400);
    expect(callsMatching(/FROM profile_assignments/i)).toHaveLength(0);
  });

  test("POST is gated on assign_responsibilities, opens a NEW period and audits", async () => {
    const route = loadRoute();
    const { requireAuthorization } = require("@/models/authorization/index");
    mockState.activeFound = []; // nothing active → allowed

    const res = await route.POST(
      jsonReq("POST", { cid: "C1", profile_key: "founder", reason: "pilot" }),
    );
    const body = await res.json();

    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "assign_responsibilities");
    expect(body.success).toBe(true);
    expect(callsMatching(/INSERT INTO profile_assignments/i)).toHaveLength(1);
    expect(mockState.audit[0]).toMatchObject({
      action: "profile_assignment_created",
      targetCid: "C1",
    });
  });

  test("POST refuses a duplicate ACTIVE period with 409 and writes nothing", async () => {
    const route = loadRoute();
    mockState.activeFound = [{ id: 7 }];

    const res = await route.POST(jsonReq("POST", { cid: "C1", profile_key: "founder" }));

    expect(res.status).toBe(409);
    expect(callsMatching(/INSERT INTO profile_assignments/i)).toHaveLength(0);
  });

  test("POST refuses an invalid profile before touching the database", async () => {
    const route = loadRoute();
    const res = await route.POST(jsonReq("POST", { cid: "C1", profile_key: "ghost" }));
    expect(res.status).toBe(400);
    expect(callsMatching(/INSERT INTO profile_assignments/i)).toHaveLength(0);
  });

  test("PATCH closes an active period and audits", async () => {
    const route = loadRoute();
    mockState.rowById = {
      id: 5,
      contact_cid: "C1",
      profile_key: "founder",
      context_type: "venture",
      context_id: null,
      status: "active",
    };

    const res = await route.PATCH(jsonReq("PATCH", { id: 5, action: "close" }));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.status).toBe("ended");
    expect(mockState.audit[0]).toMatchObject({ action: "profile_assignment_closed" });
  });

  test("PATCH revoke uses the revoked status", async () => {
    const route = loadRoute();
    mockState.rowById = { id: 5, contact_cid: "C1", profile_key: "founder", context_type: "venture", status: "active" };
    const res = await route.PATCH(jsonReq("PATCH", { id: 5, action: "revoke" }));
    expect((await res.json()).status).toBe("revoked");
  });

  test("PATCH refuses an unknown action, an unknown id and an already-closed row", async () => {
    const route = loadRoute();
    expect((await route.PATCH(jsonReq("PATCH", { id: 5, action: "archive" }))).status).toBe(400);

    mockState.rowById = null;
    expect((await route.PATCH(jsonReq("PATCH", { id: 5, action: "close" }))).status).toBe(404);

    mockState.rowById = { id: 5, contact_cid: "C1", profile_key: "founder", context_type: "venture", status: "ended" };
    expect((await route.PATCH(jsonReq("PATCH", { id: 5, action: "close" }))).status).toBe(409);
  });
});
