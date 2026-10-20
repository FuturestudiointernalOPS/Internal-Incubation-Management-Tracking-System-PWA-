/**
 * PERMISSIONS — CHARACTERIZATION of the 24 riskiest server-side, role-based
 * access decisions (inventories A and D2, `docs/permissions/`).
 *
 * These tests FREEZE what the code does TODAY. They are not aspirational: a
 * failure means the current behaviour changed, and whoever changed it must say
 * whether that was intended. No access is widened and no app file is touched.
 *
 * Two techniques are used, chosen per case:
 *   - source-pin : read the `route.js` and assert the exact guard literal is
 *     present (same technique as `security-lot*.test.js`). Deterministic, no
 *     database. Used whenever the guard string is the authoritative contract.
 *   - behaviour  : mock the guard layer (`jest.mock`) and drive the real handler,
 *     asserting the status (same pattern as `security-lot9-admin-scope.test.js`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * route (method)                                 | mécanisme actuel                        | risque | technique
 * ───────────────────────────────────────────────┼─────────────────────────────────────────┼────────┼───────────
 * GET  /api/migrate/phase0                        | requireAuth() + settings.edit            | élevé  | source-pin
 * POST /api/migrate/phase1                        | requireAuth() + settings.edit            | élevé  | source-pin
 * POST /api/migrate/phase5                        | requireAuth() + settings.edit            | élevé  | source-pin
 * POST /api/admin/run-migration                   | requireAuth() + settings.edit            | élevé  | source-pin + comportement
 * GET  /api/admin/projects                        | requireAuth(["super_admin"])            | élevé  | source-pin
 * GET  /api/admin/analytics (+ /users)            | requireAuth(["super_admin"])            | élevé  | source-pin
 * GET  /api/admin/blockers                        | createHandler({roles:["super_admin"]})  | élevé  | source-pin
 * GET  /api/admin/tasks                           | createHandler({roles:["super_admin"]})  | élevé  | source-pin
 * GET  /api/admin/finance/data-sources            | createHandler({roles:["super_admin"]})  | élevé  | source-pin
 * POST /api/admin/ventures/create                 | createHandler({roles:["super_admin"]})  | élevé  | source-pin
 * POST /api/admin/projects/[id]/reports/generate  | requireAuth(["super_admin","staff","program_manager"]) | élevé | source-pin
 * GET+PATCH /api/security/events                  | users.view / users.edit                  | élevé  | source-pin + comportement
 * GET+POST  /api/security/sessions                | users.view / users.edit                  | élevé  | source-pin
 * GET  /api/security/login-history                | users.view (administration)              | élevé  | source-pin
 * GET  /api/audit-logs (+ /[id])                  | users.view                               | élevé  | source-pin
 * GET  /api/superadmin/full-state                 | createHandler() + settings.view          | élevé  | source-pin + comportement
 * POST /api/superadmin/groups/assignment          | createHandler({roles:["super_admin"]})  | élevé  | source-pin
 * /api/superadmin/standard-types                  | const ROLE = { roles: ['super_admin'] }  | élevé  | source-pin
 * GET/POST/PUT/DELETE /api/platform/collections   | requireAuth super_admin (GET: +staff)   | élevé  | source-pin
 * /api/platform/import/{preview,execute,review-flags} | requireAuth() + settings.edit      | élevé  | source-pin
 * DELETE /api/crm/leads/[id]                      | createHandler({roles:["super_admin"]}) + requireAuthorization("crm","delete") | élevé | source-pin + comportement
 * POST /api/ventures/[id]/lifecycle               | ["super_admin"].includes(session.role)  | élevé  | source-pin
 * POST /api/engineering/permissions (promote/remove_super_admin) | session.role !== "super_admin" | élevé | source-pin
 * POST /api/engineering/permissions/profile-role-defaults | PROFILE_BASELINE_ROLES.includes(roleName) | élevé | source-pin
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * UI masks, `ROLE_LABELS` constants and pure-rendering `role ===` branches were
 * excluded as interface masks / false positives (inventory A "faible" rows).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const count = (src, re) => (src.match(re) || []).length;

/* ─────────────────────────── behaviour: mocked guard layer ───────────────── */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/server/auth/guards", () => ({
  requireAuth: jest.fn(async () => null),
}));

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => null),
}));

jest.mock("@/models/adminOps", () => ({
  executeMigrationStatement: jest.fn(async () => ({})),
  countActiveV2Programs: jest.fn(async () => ({ rows: [{ n: 0 }] })),
  countActiveProjects: jest.fn(async () => ({ rows: [{ n: 0 }] })),
  countParticipantContacts: jest.fn(async () => ({ rows: [{ n: 0 }] })),
  countStaffContacts: jest.fn(async () => ({ rows: [{ n: 0 }] })),
  listRecentActivityLogs: jest.fn(async () => ({ rows: [] })),
  listActiveV2Programs: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/services/ventures/auditSecurity", () => ({
  querySecurityEvents: jest.fn(async () => []),
  resolveSecurityEvent: jest.fn(async () => ({})),
  getSecurityStats: jest.fn(async () => ({ total: 0 })),
  logAuditEvent: jest.fn(async () => ({})),
}));

jest.mock("@/models/authorization/index", () => ({
  getAuthorizationContext: jest.fn(async () => ({ isSuperAdmin: false })),
  requireAuthorization: jest.fn(async () => null),
  authorize: jest.fn(() => false),
}));

jest.mock("@/models/crm/leads", () => ({
  getCrmLeadById: jest.fn(async () => ({ rows: [] })),
  updateCrmLead: jest.fn(async () => ({})),
  softDeleteCrmLead: jest.fn(async () => ({})),
}));

jest.mock("@/services/contacts/timeline", () => ({
  addContactTimelineEvent: jest.fn(async () => ({})),
}));

const { NextResponse } = require("next/server");
const { requireAuth } = require("@/server/auth/guards");
const { getSession } = require("@/server/auth/session");

const forbidden = () =>
  NextResponse.json(
    { success: false, error: "errors.insufficientPermissions" },
    { status: 403 },
  );

beforeEach(() => {
  jest.clearAllMocks();
  requireAuth.mockImplementation(async () => null);
  getSession.mockImplementation(async () => null);
});

/* ───────────────────────────── source-pinning ────────────────────────────── */

describe("admin / migrate — mutating endpoints pin their capability guard", () => {
  test("GET /api/migrate/phase0 — exige settings.edit (comportement actuel figé)", () => {
    const src = read("src/app/api/migrate/phase0/route.js");
    expect(src).toMatch(/requireAuth\(\)/);
    expect(src).toMatch(/requireAuthorization\("settings", "edit"\)/);
    expect(src).toMatch(/export async function GET/);
  });

  test("POST /api/migrate/phase1 — exige settings.edit (comportement actuel figé)", () => {
    const src = read("src/app/api/migrate/phase1/route.js");
    expect(src).toMatch(/export async function POST/);
    expect(count(src, /requireAuthorization\("settings", "edit"\)/g)).toBe(2); // POST + GET
  });

  test("POST /api/migrate/phase5 — exige settings.edit (comportement actuel figé)", () => {
    const src = read("src/app/api/migrate/phase5/route.js");
    expect(src).toMatch(/export async function POST/);
    expect(count(src, /requireAuthorization\("settings", "edit"\)/g)).toBe(2); // POST + GET
  });

  test("POST /api/admin/run-migration — exige settings.edit (comportement actuel figé)", () => {
    const src = read("src/app/api/admin/run-migration/route.js");
    expect(src).toMatch(/export async function POST/);
    expect(src).toMatch(/requireAuthorization\("settings", "edit"\)/);
  });

  test("GET /api/admin/projects — exige le rôle super_admin (comportement actuel figé)", () => {
    const src = read("src/app/api/admin/projects/route.js");
    expect(src).toMatch(/requireAuth\(\["super_admin"\]\)/);
  });

  test("GET /api/admin/analytics — exige le rôle super_admin, y compris la route sœur /users (comportement actuel figé)", () => {
    expect(read("src/app/api/admin/analytics/route.js")).toMatch(
      /requireAuth\(\["super_admin"\]\)/,
    );
    expect(read("src/app/api/admin/analytics/users/route.js")).toMatch(
      /requireAuth\(\["super_admin"\]\)/,
    );
  });

  test.each([
    ["GET /api/admin/blockers", "src/app/api/admin/blockers/route.js"],
    ["GET /api/admin/tasks", "src/app/api/admin/tasks/route.js"],
    ["GET /api/admin/finance/data-sources", "src/app/api/admin/finance/data-sources/route.js"],
  ])("%s — createHandler restreint à super_admin (comportement actuel figé)", (_label, file) => {
    const src = read(file);
    expect(src).toMatch(
      /createHandler\(\s*\{\s*roles:\s*\["super_admin"\]\s*\}/,
    );
  });

  test("POST /api/admin/ventures/create — createHandler restreint à super_admin (comportement actuel figé)", () => {
    expect(read("src/app/api/admin/ventures/create/route.js")).toMatch(
      /createHandler\(\s*\{\s*roles:\s*\["super_admin"\]\s*\}/,
    );
  });

  test("POST /api/admin/projects/[id]/reports/generate — exige super_admin/staff/program_manager (comportement actuel figé)", () => {
    const src = read("src/app/api/admin/projects/[id]/reports/generate/route.js");
    expect(src).toMatch(
      /requireAuth\(\["super_admin", "staff", "program_manager"\]\)/,
    );
  });
});

describe("security — audit/session surfaces pin their role allowlist", () => {
  test("GET+PATCH /api/security/events — users.view / users.edit (comportement actuel figé)", () => {
    const src = read("src/app/api/security/events/route.js");
    expect(count(src, /requireAuthorization\("users", "view"\)/g)).toBe(1);
    expect(count(src, /requireAuthorization\("users", "edit"\)/g)).toBe(1);
  });

  test("GET+POST /api/security/sessions — users.view / users.edit (comportement actuel figé)", () => {
    const src = read("src/app/api/security/sessions/route.js");
    expect(count(src, /requireAuthorization\("users", "view"\)/g)).toBe(1);
    expect(count(src, /requireAuthorization\("users", "edit"\)/g)).toBe(1);
  });

  test("GET /api/security/login-history — users.view, administration only (décision 2026-10-20)", () => {
    const src = read("src/app/api/security/login-history/route.js");
    expect(src).toMatch(/requireAuthorization\("users", "view"\)/);
    expect(src).not.toMatch(/roles:\s*\[/);
  });

  test("GET /api/audit-logs (+ /[id]) — users.view (comportement actuel figé)", () => {
    expect(read("src/app/api/audit-logs/route.js")).toMatch(
      /requireAuthorization\("users", "view"\)/,
    );
    expect(read("src/app/api/audit-logs/[id]/route.js")).toMatch(
      /requireAuthorization\("users", "view"\)/,
    );
  });
});

describe("superadmin — full-state, group assignment and standard types are super_admin only", () => {
  test("GET /api/superadmin/full-state — exige settings.view (comportement actuel figé)", () => {
    const src = read("src/app/api/superadmin/full-state/route.js");
    expect(src).toMatch(/createHandler\(async/);
    expect(src).toMatch(/requireAuthorization\("settings", "view"\)/);
  });

  test("POST /api/superadmin/groups/assignment — createHandler restreint à super_admin (comportement actuel figé)", () => {
    expect(read("src/app/api/superadmin/groups/assignment/route.js")).toMatch(
      /createHandler\(\s*\{\s*roles:\s*\["super_admin"\]\s*\}/,
    );
  });

  test("/api/superadmin/standard-types — constante ROLE = super_admin (comportement actuel figé)", () => {
    expect(read("src/app/api/superadmin/standard-types/route.js")).toMatch(
      /const ROLE = \{ roles: \['super_admin'\] \}/,
    );
  });
});

describe("platform — collections and import pipelines are super_admin gated", () => {
  test("GET /api/platform/collections — super_admin ou staff ; POST/PUT/DELETE — super_admin (comportement actuel figé)", () => {
    const src = read("src/app/api/platform/collections/route.js");
    expect(src).toMatch(/requireAuth\(\["super_admin", "staff"\]\)/);
    expect(count(src, /requireAuth\(\["super_admin"\]\)/g)).toBe(3);
  });

  test.each([
    ["POST /api/platform/import/preview", "src/app/api/platform/import/preview/route.js"],
    ["POST /api/platform/import/execute", "src/app/api/platform/import/execute/route.js"],
    ["POST /api/platform/import/review-flags", "src/app/api/platform/import/review-flags/route.js"],
  ])("%s — exige settings.edit (comportement actuel figé)", (_label, file) => {
    expect(read(file)).toMatch(/requireAuthorization\("settings", "edit"\)/);
  });
});

describe("crm / ventures — destructive and lifecycle endpoints pin their role lists", () => {
  test("DELETE /api/crm/leads/[id] — allowlist super_admin puis requireAuthorization(crm,delete) (comportement actuel figé)", () => {
    const src = read("src/app/api/crm/leads/[id]/route.js");
    expect(src).toMatch(/export const DELETE = createHandler\(/);
    expect(src).toMatch(/\{\s*roles:\s*\["super_admin"\]\s*\}/);
    expect(src).toMatch(/requireAuthorization\("crm", "delete"\)/);
  });

  test("DELETE /api/crm/opportunities/[id] et /organizations/[id] — super_admin only (comportement actuel figé)", () => {
    expect(read("src/app/api/crm/opportunities/[id]/route.js")).toMatch(
      /\{\s*roles:\s*\["super_admin"\]\s*\}/,
    );
    expect(read("src/app/api/crm/organizations/[id]/route.js")).toMatch(
      /\{\s*roles:\s*\["super_admin"\]\s*\}/,
    );
  });

  test("POST /api/ventures/[id]/lifecycle — super_admin only (comportement actuel figé)", () => {
    const src = read("src/app/api/ventures/[id]/lifecycle/route.js");
    expect(src).toMatch(/export async function POST/);
    expect(src).toMatch(/if \(!\["super_admin"\]\.includes\(session\.role\)\)/);
  });

  test("POST /api/ventures/[id]/verification — super_admin only (comportement actuel figé)", () => {
    const src = read("src/app/api/ventures/[id]/verification/route.js");
    expect(src).toMatch(/if \(!\["super_admin"\]\.includes\(session\.role\)\)/);
    expect(src).toMatch(/if \(\["super_admin"\]\.includes\(session\.role\)\) return true;/);
  });
});

describe("engineering/permissions — role changes are not capability grants", () => {
  test("POST /api/engineering/permissions — promouvoir/rétrograder super_admin exige le rôle super_admin (comportement actuel figé)", () => {
    const src = read("src/app/api/engineering/permissions/route.js");
    expect(src).toMatch(/promote_super_admin/);
    expect(src).toMatch(/remove_super_admin/);
    expect(src).toMatch(/session\.role !== "super_admin"/);
  });

  test("POST /api/engineering/permissions/profile-role-defaults — borne PROFILE_BASELINE_ROLES (comportement actuel figé)", () => {
    const src = read("src/app/api/engineering/permissions/profile-role-defaults/route.js");
    expect(src).toMatch(/PROFILE_BASELINE_ROLES/);
    expect(src).toMatch(/if \(!PROFILE_BASELINE_ROLES\.includes\(roleName\)\)/);
  });
});

/* ─────────────────────────── behaviour checks ───────────────────────────── */

describe("behaviour — the guard's denial is returned before any work", () => {
  test("POST /api/admin/run-migration — refus 403 quand requireAuth refuse (comportement actuel figé)", async () => {
    requireAuth.mockImplementationOnce(async () => forbidden());
    const route = require("@/app/api/admin/run-migration/route");
    const adminOps = require("@/models/adminOps");

    const res = await route.POST(new Request("http://localhost/api/admin/run-migration", { method: "POST" }));

    expect(res.status).toBe(403);
    expect(adminOps.executeMigrationStatement).not.toHaveBeenCalled();
  });

  test("GET /api/security/events — refus 403 quand requireAuth refuse (comportement actuel figé)", async () => {
    requireAuth.mockImplementationOnce(async () => forbidden());
    const route = require("@/app/api/security/events/route");

    const res = await route.GET(new Request("http://localhost/api/security/events?type=stats"));

    expect(res.status).toBe(403);
  });

  test("GET /api/security/events — un super_admin authentifié obtient 200 (comportement actuel figé)", async () => {
    requireAuth.mockImplementationOnce(async () => null);
    getSession.mockImplementationOnce(async () => ({ cid: "USR_SA", role: "super_admin", name: "SA" }));
    const route = require("@/app/api/security/events/route");

    const res = await route.GET(new Request("http://localhost/api/security/events?type=stats"));

    expect(res.status).toBe(200);
  });

  test("GET /api/superadmin/full-state — refus 403 quand requireAuth refuse (comportement actuel figé)", async () => {
    requireAuth.mockImplementationOnce(async () => forbidden());
    const route = require("@/app/api/superadmin/full-state/route");

    const res = await route.GET(new Request("http://localhost/api/superadmin/full-state"));

    expect(res.status).toBe(403);
  });

  test("DELETE /api/crm/leads/[id] — refus 403 quand requireAuth refuse (comportement actuel figé)", async () => {
    requireAuth.mockImplementationOnce(async () => forbidden());
    const route = require("@/app/api/crm/leads/[id]/route");

    const res = await route.DELETE(
      new Request("http://localhost/api/crm/leads/L-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "L-1" }) },
    );

    expect(res.status).toBe(403);
  });
});
