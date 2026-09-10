/**
 * PHASE 5b/5c — venture scoped gate (STRICT ONLY, no legacy fallback).
 *
 * Locks:
 *   1. The gate decides with capability + scope alone; Super Admin keeps its
 *      resolver bypass.
 *   2. Every denial is explicit and diagnosable (X-Authz-Decision header +
 *      `missing` payload) — "what is working and what is not" must be visible.
 *   3. The legacy pair cannot come back: neither the helper nor the converted
 *      routes may reference requireAuth / requireVentureAccess.
 *   4. The strict-mode readiness audit reports who would lose access.
 */

const fs = require("fs");
const path = require("path");

let mockSession = { cid: "C1", name: "Actor", role: "staff", email: "a@b.c" };
jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => mockSession),
  requireAuth: jest.fn(),
  logPermissionAudit: jest.fn().mockResolvedValue(true),
}));

let mockCtx = null;
let mockCapError = null;
jest.mock("@/lib/authorization", () => ({
  getAuthorizationContext: jest.fn(async () => mockCtx),
  requireAuthorization: jest.fn(async () => mockCapError),
}));

let mockWithin = false;
jest.mock("@/lib/authorization/scope", () => ({
  resolveVentureScopeId: jest.fn(async () => "VNT-1"),
  isWithinScope: jest.fn(async () => mockWithin),
}));

const { requireVentureScopedAccess } = require("@/lib/ventureScopedAccess");
const { requireAuthorization } = require("@/lib/authorization");
const { isWithinScope } = require("@/lib/authorization/scope");
const { summarizeVentureStrictAudit } = require("@/models/authorization/ventureScopeAudit");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const callHelper = (overrides = {}) =>
  requireVentureScopedAccess({
    ventureId: "9f1c-uuid",
    module: "ventures",
    capability: "view",
    ...overrides,
  });

beforeEach(() => {
  mockSession = { cid: "C1", name: "Actor", role: "staff", email: "a@b.c" };
  mockCtx = null;
  mockCapError = null;
  mockWithin = false;
  jest.clearAllMocks();
});

describe("Phase 5c — the venture gate (strict only)", () => {
  test("Super Admin bypasses capability and scope (no extra lookups)", async () => {
    mockCtx = { isSuperAdmin: true };
    const out = await callHelper();
    expect(out.path).toBe("super-admin");
    expect(requireAuthorization).not.toHaveBeenCalled();
    expect(isWithinScope).not.toHaveBeenCalled();
  });

  test("unauthenticated → 401, nothing else evaluated", async () => {
    mockSession = null;
    const out = await callHelper();
    expect(out.error.status).toBe(401);
    expect(out.error.headers.get("X-Authz-Decision")).toBe("unauthenticated");
    expect(requireAuthorization).not.toHaveBeenCalled();
  });

  test("capability missing → 403 naming the exact key (no scope call)", async () => {
    mockCapError = new Response(JSON.stringify({ success: false }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    const out = await callHelper();
    expect(out.error.status).toBe(403);
    expect(out.error.headers.get("X-Authz-Decision")).toBe("capability-missing");
    const body = await out.error.json();
    expect(body.missing).toEqual({ capability: "ventures.view" });
    expect(isWithinScope).not.toHaveBeenCalled();
  });

  test("capability present but the venture is not theirs → out-of-scope denial", async () => {
    mockCapError = null;
    mockWithin = false;
    const out = await callHelper();
    expect(out.error.status).toBe(403);
    expect(out.error.headers.get("X-Authz-Decision")).toBe("out-of-scope");
    const body = await out.error.json();
    expect(body.missing).toEqual({
      capability: "ventures.view",
      scope: "venture_own",
    });
  });

  test("capability + scope → allowed", async () => {
    mockCapError = null;
    mockWithin = true;
    const out = await callHelper();
    expect(out.path).toBe("capability+scope");
    expect(out.session.cid).toBe("C1");
  });

  test("an internal failure is an explicit system failure (never a silent allow)", async () => {
    requireAuthorization.mockRejectedValueOnce(new Error("resolver down"));
    const out = await callHelper();
    expect(out.error.status).toBe(500);
    expect(out.error.headers.get("X-Authz-Decision")).toBe("system-failure");
  });
});

describe("Phase 5c — the old gate cannot come back", () => {
  test("the helper contains no legacy fallback", () => {
    const src = read("src/lib/ventureScopedAccess.js");
    expect(src).not.toContain("legacy-fallback");
    expect(src).not.toMatch(/requireAuth\(/);
    expect(src).not.toMatch(/requireVentureAccess\(/);
    expect(src).toContain("capability+scope");
  });

  const converted = [
    "src/app/api/ventures/[id]/route.js",
    "src/app/api/ventures/[id]/blockers/route.js",
    "src/app/api/ventures/[id]/business-model/route.js",
    "src/app/api/ventures/[id]/action-plans/route.js",
    "src/app/api/ventures/[id]/calendar/route.js",
    "src/app/api/ventures/[id]/coaches/route.js",
    "src/app/api/ventures/[id]/dashboard/route.js",
    "src/app/api/ventures/[id]/followups/route.js",
    "src/app/api/ventures/[id]/interviews/route.js",
    "src/app/api/ventures/[id]/investment-readiness/route.js",
    "src/app/api/ventures/[id]/knowledge/route.js",
    "src/app/api/ventures/[id]/kpis/route.js",
    "src/app/api/ventures/[id]/milestones/route.js",
    "src/app/api/ventures/[id]/milestones/archive/route.js",
    "src/app/api/ventures/[id]/milestones/duplicate/route.js",
    "src/app/api/ventures/[id]/playbook/route.js",
    "src/app/api/ventures/[id]/pmf/route.js",
    "src/app/api/ventures/[id]/retros/route.js",
    "src/app/api/ventures/[id]/sessions/route.js",
    "src/app/api/ventures/[id]/standups/route.js",
    "src/app/api/ventures/[id]/tasks/route.js",
    "src/app/api/ventures/[id]/tasks/archive/route.js",
    "src/app/api/ventures/[id]/tasks/duplicate/route.js",
    "src/app/api/ventures/[id]/timeline/route.js",
    "src/app/api/ventures/[id]/validations/route.js",
    "src/app/api/ventures/[id]/venture-history/route.js",
  ];

  test.each(converted)("%s is on the canonical gate only", (rel) => {
    const src = read(rel);
    expect(src).toContain("requireVentureScopedAccess");
    expect(src).toContain('module: "ventures"');
    expect(src).toMatch(/capability: "(view|edit)"/);
    expect(src).not.toContain("legacyRoles");
    expect(src).not.toMatch(/requireAuth\(/);
    expect(src).not.toMatch(/requireVentureAccess\(/);
    // The dead legacy role lists are gone too.
    expect(src).not.toMatch(/const (ROLES|ALLOWED) = \[/);
  });

  test("the gate is never called before params are destructured", () => {
    // Regression guard: `ventureId: id` evaluated before `const { id } = await
    // params;` is a TDZ ReferenceError — the route would 500 on every call.
    const root = path.join(process.cwd(), "src", "app", "api", "ventures");
    const files = [];
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name === "route.js") files.push(full);
      }
    })(root);
    const offenders = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      if (!src.includes("requireVentureScopedAccess")) continue;
      const lines = src.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!line.includes("requireVentureScopedAccess") || !line.includes("ventureId: id")) return;
        let declared = false;
        for (let j = i - 1; j >= 0; j--) {
          if (/const \{ id \}[^=]*= await params/.test(lines[j])) { declared = true; break; }
          if (/export (async )?function|export const [A-Z]+ = createHandler/.test(lines[j])) break;
        }
        if (!declared) offenders.push(`${path.relative(process.cwd(), file)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe("Phase 5c — strict-mode readiness audit", () => {
  test("names the missing key per person", () => {
    const summary = summarizeVentureStrictAudit([
      { cid: "C1", name: "David", role: "member", ventures: ["V1", "V2"], viewAllowed: true, editAllowed: false, scopeCount: 2 },
      { cid: "C2", name: "Sara", role: "staff", ventures: ["V1"], viewAllowed: false, editAllowed: false, scopeCount: 1 },
    ]);
    expect(summary.total).toBe(2);
    expect(summary.viewAllowed).toBe(1);
    expect(summary.viewMissing.map((r) => r.cid)).toEqual(["C2"]);
    expect(summary.viewMissing[0].missing).toEqual(["ventures.view"]);
    expect(summary.editMissing.map((r) => r.cid)).toEqual(["C1"]);
    expect(summary.editMissing[0].missing).toEqual(["ventures.edit"]);
  });

  test("a fully-keyed person reports nothing missing", () => {
    const summary = summarizeVentureStrictAudit([
      { cid: "C3", ventures: ["V1"], viewAllowed: true, editAllowed: true, scopeCount: 1 },
    ]);
    expect(summary.viewMissing).toEqual([]);
    expect(summary.editMissing).toEqual([]);
    expect(summary.rows[0].missing).toEqual([]);
  });

  test("handles empty input", () => {
    expect(summarizeVentureStrictAudit()).toEqual({
      total: 0,
      viewAllowed: 0,
      viewMissing: [],
      editMissing: [],
      rows: [],
    });
  });
});
