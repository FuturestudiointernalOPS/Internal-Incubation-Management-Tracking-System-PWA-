/**
 * SECURITY — Lot 10 (task listing fail-closed, supervisor self-grant, anonymous
 * contact enrollment).
 *
 * Registry findings:
 *   - IDOR-TASK-2: the task scope could fall through to an UNFILTERED list when
 *     the scope was not recognised, and `supervisor_id` (which grants access to
 *     a task) could be set by anyone.
 *   - PUB-CONTACTS-1: an anonymous public submission could name any `program_id`
 *     and enroll the new contact into a program.
 */

const mockExecute = jest.fn(async () => ({ rows: [] }));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn(async () => true),
}));

const fs = require("fs");
const path = require("path");
const { getTasksByFilters } = require("@/models/tasks");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", "..", file), "utf8");

beforeEach(() => {
  mockExecute.mockClear();
});

describe("task listing fails closed", () => {
  test("a non-super-admin with no recognised scope is denied, never unfiltered", async () => {
    await getTasksByFilters({ isSuperAdmin: false, scope: undefined, sessionCid: "U1" });

    const { sql } = mockExecute.mock.calls[0][0];
    expect(sql).toContain("1 = 0");
    // No owner/assignee escape hatch must be added.
    expect(sql).not.toContain("user_id = ?");
  });

  test("the self scope restricts to owned, assigned or supervised tasks", async () => {
    await getTasksByFilters({ isSuperAdmin: false, scope: "self", sessionCid: "U1" });

    const { sql, args } = mockExecute.mock.calls[0][0];
    expect(sql).toContain("(user_id = ? OR assigned_to = ? OR supervisor_id = ?)");
    expect(args).toEqual(["U1", "U1", "U1"]);
  });

  test("the super-admin path is not forced into the deny clause", async () => {
    await getTasksByFilters({ isSuperAdmin: true, scope: undefined, sessionCid: "SA" });

    const { sql } = mockExecute.mock.calls[0][0];
    expect(sql).not.toContain("1 = 0");
  });
});

describe("supervisor_id is a management field", () => {
  const src = read("src/app/api/tasks/route.js");

  test("the role list exists and gates the supervisor on create", () => {
    expect(src).toContain('const STAFF_SIDE_ROLES = ["super_admin", "staff", "program_manager"]');
    expect(src).toMatch(
      /supervisor_id: STAFF_SIDE_ROLES\.includes\(session\.role\) \? supervisor_id \|\| null : null/,
    );
  });

  test("the supervisor cannot be changed on update by a non-staff caller", () => {
    expect(src).toMatch(/STAFF_SIDE_ROLES\.includes\(session\.role\) &&\s*\n\s*supervisor_id !== undefined/);
  });
});

describe("anonymous contacts cannot enroll into a program", () => {
  const src = read("src/app/api/contacts/route.js");

  test("program_id and program_name are only honoured for an authenticated caller", () => {
    expect(src).toMatch(/program_id: session \? contact\.program_id \|\| null : null/);
    expect(src).toMatch(/program_name: session \? contact\.program_name \|\| null : null/);
  });
});
