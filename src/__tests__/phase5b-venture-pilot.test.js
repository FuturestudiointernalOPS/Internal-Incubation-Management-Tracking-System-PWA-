/**
 * PHASE 5b — Venture scope pilot: the canonical gate's semantics.
 *
 * Contracts locked here:
 *   1. The pilot gate preserves EXACT prior behavior through the transitional
 *      fallback: legacy role denial keeps its 403, membership denial keeps its
 *      404, Super Admin keeps resolver bypass semantics.
 *   2. The canonical path (capability + scope) short-circuits the legacy pair.
 *   3. The two pilot route files use the gate directly — no legacy calls.
 */

const fs = require("fs");
const path = require("path");

let mockSession = { cid: "C1", name: "Actor", role: "staff" };
let mockLegacyRoleError = null;
jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => mockSession),
  requireAuth: jest.fn(async () => mockLegacyRoleError),
  logPermissionAudit: jest.fn().mockResolvedValue(true),
}));

let mockCtx = null;
let mockCapError = null;
jest.mock("@/lib/authorization", () => ({
  getAuthorizationContext: jest.fn(async () => mockCtx),
  requireAuthorization: jest.fn(async () => mockCapError),
}));

let mockScopeId = "VNT-1";
let mockWithin = false;
jest.mock("@/lib/authorization/scope", () => ({
  resolveVentureScopeId: jest.fn(async () => mockScopeId),
  isWithinScope: jest.fn(async () => mockWithin),
}));

let mockLegacySession = null;
jest.mock("@/lib/ventureAuth", () => ({
  requireVentureAccess: jest.fn(async () => ({
    session: mockLegacySession,
    ventureId: "VNT-1",
  })),
}));

const { requireVentureScopedAccess } = require("@/lib/ventureScopedAccess");
const { requireAuth } = require("@/lib/auth");
const { requireAuthorization } = require("@/lib/authorization");
const { isWithinScope, resolveVentureScopeId } = require("@/lib/authorization/scope");
const { requireVentureAccess } = require("@/lib/ventureAuth");

const callHelper = (overrides = {}) =>
  requireVentureScopedAccess({
    db: {},
    ventureId: "9f1c-uuid",
    module: "ventures",
    capability: "view",
    legacyRoles: ["staff", "super_admin"],
    ...overrides,
  });

beforeEach(() => {
  mockSession = { cid: "C1", name: "Actor", role: "staff" };
  mockLegacyRoleError = null;
  mockCtx = null;
  mockCapError = null;
  mockScopeId = "VNT-1";
  mockWithin = false;
  mockLegacySession = null;
  jest.clearAllMocks();
});

describe("Phase 5b — requireVentureScopedAccess semantics", () => {
  test("Super Admin bypasses scope (resolver semantics, no extra lookups)", async () => {
    mockCtx = { isSuperAdmin: true };
    const out = await callHelper();
    expect(out.path).toBe("super-admin");
    expect(out.session).toBeTruthy();
    expect(requireAuthorization).not.toHaveBeenCalled();
    expect(isWithinScope).not.toHaveBeenCalled();
  });

  test("unauthenticated → 401 (no capability or scope evaluation)", async () => {
    mockSession = null;
    const out = await callHelper();
    expect(out.error.status).toBe(401);
    expect(requireAuthorization).not.toHaveBeenCalled();
  });

  test("capability + scope → allowed via the canonical path (no legacy calls)", async () => {
    mockCapError = null;
    mockWithin = true;
    const out = await callHelper();
    expect(out.path).toBe("capability+scope");
    expect(requireAuth).not.toHaveBeenCalled();
    expect(requireVentureAccess).not.toHaveBeenCalled();
  });

  test("scope denial with capability → falls back to legacy (never a new denial path)", async () => {
    mockCapError = null;
    mockWithin = false;
    mockLegacySession = { cid: "C1", role: "staff" };
    const out = await callHelper();
    expect(out.path).toBe("legacy-fallback");
  });

  test("legacy role denial keeps its original response (403 parity)", async () => {
    mockCapError = new Response(JSON.stringify({ success: false }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    mockLegacyRoleError = new Response(
      JSON.stringify({ success: false, error: "forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
    const out = await callHelper();
    expect(out.error.status).toBe(403);
    expect(requireVentureAccess).not.toHaveBeenCalled();
  });

  test("membership denial keeps 404 (existence never leaked as 403)", async () => {
    mockCapError = new Response(JSON.stringify({ success: false }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    mockLegacyRoleError = null;
    mockLegacySession = null;
    const out = await callHelper();
    expect(out.error.status).toBe(404);
  });

  test("scope resolution receives the raw route id (UUIDs normalized inside)", async () => {
    mockCapError = null;
    mockWithin = true;
    await callHelper({ ventureId: "9f1c-uuid" });
    expect(resolveVentureScopeId).toHaveBeenCalledWith("9f1c-uuid");
  });
});

describe("Phase 5c — strict mode (staging verification)", () => {
  afterEach(() => {
    delete process.env.AUTHZ_VENTURE_STRICT;
  });

  test("strict on: capability missing → denied by the new system alone (no legacy calls)", async () => {
    process.env.AUTHZ_VENTURE_STRICT = "1";
    mockCapError = new Response(JSON.stringify({ success: false }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    const out = await callHelper();
    expect(out.error.status).toBe(403);
    const body = await out.error.json();
    expect(body.strict).toBe(true);
    expect(body.missing.capability).toBe("ventures.view");
    expect(out.error.headers.get("X-Authz-Decision")).toBe("capability-or-scope-denied");
    expect(requireAuth).not.toHaveBeenCalled();
    expect(requireVentureAccess).not.toHaveBeenCalled();
  });

  test("strict on: capability held but out of scope → denied, scope named in the payload", async () => {
    process.env.AUTHZ_VENTURE_STRICT = "1";
    mockCapError = null;
    mockWithin = false;
    const out = await callHelper();
    expect(out.error.status).toBe(403);
    const body = await out.error.json();
    expect(body.missing.scope).toBe("venture_own");
    expect(requireVentureAccess).not.toHaveBeenCalled();
  });

  test("strict on: the canonical path still allows (no fallback involved)", async () => {
    process.env.AUTHZ_VENTURE_STRICT = "1";
    mockCapError = null;
    mockWithin = true;
    const out = await callHelper();
    expect(out.path).toBe("capability+scope");
  });

  test("strict on: Super Admin bypass is unaffected", async () => {
    process.env.AUTHZ_VENTURE_STRICT = "1";
    mockCtx = { isSuperAdmin: true };
    const out = await callHelper();
    expect(out.path).toBe("super-admin");
  });

  test("strict off (default): the same denial falls back to legacy (parity)", async () => {
    mockCapError = new Response(JSON.stringify({ success: false }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    mockLegacySession = { cid: "C1", role: "staff" };
    const out = await callHelper();
    expect(out.path).toBe("legacy-fallback");
  });

  test("an unexpected failure in the new path never 500s a working route (strict off)", async () => {
    const { requireAuthorization } = require("@/lib/authorization");
    requireAuthorization.mockRejectedValueOnce(new Error("resolver unavailable"));
    mockLegacySession = { cid: "C1", role: "staff" };
    const out = await callHelper();
    expect(out.path).toBe("legacy-fallback");
  });

  test("strict on: an unexpected failure denies explicitly (no silent allow)", async () => {
    process.env.AUTHZ_VENTURE_STRICT = "1";
    const { requireAuthorization } = require("@/lib/authorization");
    requireAuthorization.mockRejectedValueOnce(new Error("resolver unavailable"));
    const out = await callHelper();
    expect(out.error.status).toBe(403);
    expect(out.error.headers.get("X-Authz-Decision")).toBe("capability-or-scope-denied");
    expect(requireVentureAccess).not.toHaveBeenCalled();
  });
});

describe("Phase 5b — pilot route contract", () => {
  const pilots = [
    "src/app/api/ventures/[id]/blockers/route.js",
    "src/app/api/ventures/[id]/business-model/route.js",
  ];

  test.each(pilots)("%s uses the canonical venture gate (no direct legacy calls)", (rel) => {
    const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    expect(src).toContain("requireVentureScopedAccess");
    expect(src).toContain('module: "ventures"');
    expect(src).toContain('capability: "view"');
    expect(src).toContain('capability: "edit"');
    // The legacy pair lives only inside the helper's fallback.
    expect(src).not.toMatch(/requireAuth\(/);
    expect(src).not.toMatch(/requireVentureAccess\(/);
  });
});

/**
 * PHASE 5c — the batch-converted venture surfaces. Every entry must keep using
 * the canonical gate: no direct requireAuth / requireVentureAccess calls may
 * creep back in, and writes must ask for the edit capability.
 */
describe("Phase 5c — batch-converted venture routes", () => {
  const converted = [
    "src/app/api/ventures/[id]/action-plans/route.js",
    "src/app/api/ventures/[id]/calendar/route.js",
    "src/app/api/ventures/[id]/followups/route.js",
    "src/app/api/ventures/[id]/interviews/route.js",
    "src/app/api/ventures/[id]/investment-readiness/route.js",
    "src/app/api/ventures/[id]/kpis/route.js",
    "src/app/api/ventures/[id]/playbook/route.js",
    "src/app/api/ventures/[id]/pmf/route.js",
    "src/app/api/ventures/[id]/retros/route.js",
    "src/app/api/ventures/[id]/standups/route.js",
    "src/app/api/ventures/[id]/validations/route.js",
  ];

  test.each(converted)("%s stays on the canonical gate", (rel) => {
    const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    expect(src).toContain("requireVentureScopedAccess");
    expect(src).toContain('module: "ventures"');
    expect(src).not.toMatch(/requireAuth\(/);
    expect(src).not.toMatch(/requireVentureAccess\(/);
    // The legacy role array is still handed to the fallback (parity), never
    // dropped: a conversion must not silently widen access.
    expect(src).toMatch(/legacyRoles: (ROLES|ALLOWED)/);
  });
});
