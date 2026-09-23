/**
 * SECURITY — regression tests for Lot 3 (admin / auth / session / scope).
 *
 * These pin the SERVER-SIDE invariants added in this lot by asserting on the
 * route sources: each guard must be present, and the removed holes must not
 * reappear. (Source-level checks are the same technique the identity-gate tests
 * already use — they survive refactors of the surrounding handler, which an
 * integration test mocking ~10 models would not.)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("impersonation is a Super Admin act, not an env flag", () => {
  test.each([
    "src/app/api/auth/impersonate/route.js",
    "src/app/api/auth/quick-login/route.js",
  ])("%s requires a Super Admin session", (file) => {
    const src = read(file);
    expect(src).toMatch(/requireAuth\(\["super_admin"\]\)/);
  });
});

describe("role changes are not capability grants", () => {
  test("promote/remove super admin requires the super_admin role", () => {
    const src = read("src/app/api/engineering/permissions/route.js");
    expect(src).toMatch(/promote_super_admin/);
    expect(src).toMatch(/session\.role !== "super_admin"/);
  });

  test("the CSV import cannot assign privileged roles without the capability", () => {
    const src = read("src/app/api/admin/bulk-upload/route.js");
    expect(src).toMatch(/IMPORTABLE_ROLES/);
    expect(src).toMatch(/const canAssignRole = !assignRoleError/);
  });

  test("contacts PUT gates `role` on the assign-roles capability", () => {
    const src = read("src/app/api/contacts/route.js");
    expect(src).toMatch(/\.\.\.\(canAssignRole \? \["role"\] : \[\]\)/);
  });

  test("approve-user derives the role and the actor server-side, returns no token", () => {
    const src = read("src/app/api/admin/approve-user/route.js");
    expect(src).toMatch(/APPROVABLE_ROLES/);
    expect(src).toMatch(/session\?\.name \|\| session\?\.cid \|\| "system"/);
    // The live setup token must never be echoed back to the caller.
    expect(src).not.toMatch(/\n\s+setupUrl,\n/);
  });
});

describe("object-level authorization added in this lot", () => {
  test("projects/members scopes POST and DELETE to the project", () => {
    const src = read("src/app/api/projects/members/route.js");
    const hits = src.match(/requireProjectAccess\((project_id|projectId)\)/g) || [];
    expect(hits.length).toBeGreaterThanOrEqual(2); // POST (project_id) + DELETE (projectId alias)
  });

  test("projects DELETE checks project access for non-staff", () => {
    const src = read("src/app/api/projects/route.js");
    expect(src).toMatch(/requireProjectAccess\(id\)/);
  });

  test("approvals verify the request belongs to the project in the URL", () => {
    const src = read("src/app/api/admin/projects/[id]/approvals/route.js");
    expect(src).toMatch(/approvalRequest\.project_id\) !== String\(id\)/);
  });

  test("tasks/carryover checks ownership and takes attribution from the session", () => {
    const src = read("src/app/api/tasks/carryover/route.js");
    expect(src).toMatch(/You can only carry over your own tasks/);
    // The body's user_id/user_name must no longer drive the clone.
    expect(src).not.toMatch(/const \{ task_id, target_week, target_year, user_id, user_name \}/);
  });

  test("contacts/full-state scopes the PM parameter for non-management", () => {
    const src = read("src/app/api/contacts/full-state/route.js");
    expect(src).toMatch(/pmId = session\?\.cid \|\| null/);
  });

  test("group-members requires a group (no unscoped dump)", () => {
    const src = read("src/app/api/group-members/route.js");
    expect(src).toMatch(/group_id is required/);
  });

  test("feedback binds a participant to their own feedback", () => {
    const src = read("src/app/api/feedback/route.js");
    expect(src).toMatch(/effectiveParticipantId/);
  });
});

describe("password changes invalidate older sessions", () => {
  test.each([
    "src/app/api/auth/setup-password/route.js",
    "src/app/api/auth/reset-password/route.js",
  ])("%s purges sessions after the credential change", (file) => {
    expect(read(file)).toMatch(/deleteUserSessions/);
  });

  test("profile self-change keeps only the current session", () => {
    const src = read("src/app/api/profile/route.js");
    expect(src).toMatch(/deleteUserSessionsExcept/);
  });
});
