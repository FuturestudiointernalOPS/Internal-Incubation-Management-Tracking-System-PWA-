/**
 * AUTHORIZATION READS — characterisation of the model layer.
 *
 * Six reads moved out of src/lib/auth.js. They all answer a permission question
 * by reading a table, and each one has a fallback that is part of the security
 * behaviour, not an accident:
 *
 *   - a group lookup that falls back to the contact's own group, then to none;
 *   - an "is this person the program's PM / a facilitator anywhere" probe that
 *     fails CLOSED (false) so a database hiccup never widens access;
 *   - a team-scope resolution that fails to "none" (no cohort) rather than "all";
 *   - a supervision probe that grants read scoping only;
 *   - an audit write that must never break the action it records.
 */

const mockExecute = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn(async () => {}),
}));

const {
  getUserGroups,
  logPermissionAudit,
  isAssignedPmForProgram,
  hasAnyFacilitatorAssignment,
  getFacilitatorTeamScope,
  isSupervisorOf,
} = require("@/models/authorization/accessQueries");

function serveDb(routes) {
  mockExecute.mockImplementation(async (query = {}) => {
    const sql = String(query.sql || "").replace(/\s+/g, " ");
    for (const [fragment, result] of routes) {
      if (sql.includes(fragment)) return typeof result === "function" ? result(query) : result;
    }
    return { rows: [] };
  });
}

beforeEach(() => {
  mockExecute.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("getUserGroups", () => {
  it("returns every group name of the user", async () => {
    serveDb([["FROM user_groups", { rows: [{ group_name: "A" }, { group_name: "B" }] }]]);

    await expect(getUserGroups("USR1")).resolves.toEqual(["A", "B"]);
  });

  it("falls back to the contact's own group when there is no membership row", async () => {
    serveDb([["FROM contacts", { rows: [{ group_name: "FUTURE STUDIO" }] }]]);

    await expect(getUserGroups("USR1")).resolves.toEqual(["FUTURE STUDIO"]);
  });

  it("returns no groups when neither source has one", async () => {
    serveDb([["FROM contacts", { rows: [{ group_name: null }] }]]);

    await expect(getUserGroups("USR1")).resolves.toEqual([]);
  });

  it("returns no groups rather than throwing", async () => {
    mockExecute.mockRejectedValue(new Error("connection terminated"));

    await expect(getUserGroups("USR1")).resolves.toEqual([]);
  });
});

describe("isAssignedPmForProgram", () => {
  it("is true when the user is the program's assigned PM", async () => {
    serveDb([["assigned_pm_id", { rows: [{ "?column?": 1 }] }]]);

    await expect(isAssignedPmForProgram("7", "USR1")).resolves.toBe(true);
  });

  it("is false without a match, and compares both sides as text", async () => {
    serveDb([]);

    await expect(isAssignedPmForProgram(7, "USR1")).resolves.toBe(false);
    expect(mockExecute.mock.calls[0][0].args).toEqual(["7", "USR1"]);
  });

  it("is false without arguments, and does not query", async () => {
    await expect(isAssignedPmForProgram(null, "USR1")).resolves.toBe(false);
    await expect(isAssignedPmForProgram("7", null)).resolves.toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("fails closed when the lookup errors", async () => {
    mockExecute.mockRejectedValue(new Error("connection terminated"));

    await expect(isAssignedPmForProgram("7", "USR1")).resolves.toBe(false);
  });
});

describe("hasAnyFacilitatorAssignment", () => {
  it("is true when at least one facilitator assignment exists", async () => {
    serveDb([["FROM v2_program_staff", { rows: [{ "?column?": 1 }] }]]);

    await expect(hasAnyFacilitatorAssignment("USR1")).resolves.toBe(true);
  });

  it("also matches legacy rows that stored the email", async () => {
    serveDb([["FROM v2_program_staff", { rows: [{ "?column?": 1 }] }]]);

    await expect(hasAnyFacilitatorAssignment("USR1", " pm@example.com ")).resolves.toBe(true);
    expect(mockExecute.mock.calls[0][0].args).toEqual(["USR1", "pm@example.com"]);
    expect(String(mockExecute.mock.calls[0][0].sql)).toContain("LOWER(TRIM(staff_id))");
  });

  it("is false without an assignment, and fails closed on error", async () => {
    serveDb([]);
    await expect(hasAnyFacilitatorAssignment("USR1")).resolves.toBe(false);

    mockExecute.mockRejectedValue(new Error("connection terminated"));
    await expect(hasAnyFacilitatorAssignment("USR1")).resolves.toBe(false);
  });
});

describe("getFacilitatorTeamScope", () => {
  it("reports the whole program when the facilitator scope is 'all'", async () => {
    serveDb([["facilitator_scope", { rows: [{ facilitator_scope: "all" }] }]]);

    await expect(getFacilitatorTeamScope("7", "USR1")).resolves.toEqual({ scope: "all", teamIds: [] });
  });

  it("reports the teams the facilitator handles", async () => {
    serveDb([
      ["facilitator_scope", { rows: [{ facilitator_scope: "teams" }] }],
      ["FROM v2_teams", { rows: [{ id: "3" }, { id: "9" }] }],
    ]);

    await expect(getFacilitatorTeamScope("7", "USR1")).resolves.toEqual({
      scope: "teams",
      teamIds: ["3", "9"],
    });
  });

  it("reports no cohort when the facilitator handles no team", async () => {
    serveDb([["facilitator_scope", { rows: [{ facilitator_scope: "teams" }] }]]);

    await expect(getFacilitatorTeamScope("7", "USR1")).resolves.toEqual({ scope: "none", teamIds: [] });
  });

  it("never widens to 'all' when the lookup errors", async () => {
    mockExecute.mockRejectedValue(new Error("connection terminated"));

    await expect(getFacilitatorTeamScope("7", "USR1")).resolves.toEqual({ scope: "none", teamIds: [] });
  });
});

describe("isSupervisorOf", () => {
  it("is true for a current supervision relationship", async () => {
    serveDb([["contact_type", { rows: [{ "?column?": 1 }] }], ["FROM contact_roles", { rows: [{ "?column?": 1 }] }]]);

    await expect(isSupervisorOf("SUP", "SUB")).resolves.toBe(true);
    expect(mockExecute.mock.calls[0][0].args).toEqual(["SUB", "SUP"]);
    expect(String(mockExecute.mock.calls[0][0].sql)).toContain("context_type = 'supervision'");
  });

  it("is false without a relationship, without arguments, or on error", async () => {
    serveDb([]);
    await expect(isSupervisorOf("SUP", "SUB")).resolves.toBe(false);

    mockExecute.mockClear();
    await expect(isSupervisorOf(null, "SUB")).resolves.toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();

    mockExecute.mockRejectedValue(new Error("connection terminated"));
    await expect(isSupervisorOf("SUP", "SUB")).resolves.toBe(false);
  });
});

describe("logPermissionAudit", () => {
  it("records the actor, the target and what changed", async () => {
    serveDb([]);

    await logPermissionAudit({
      actorCid: "SA1",
      actorName: "Super Admin",
      targetCid: "USR1",
      targetName: "Someone",
      action: "grant",
      module: "projects",
      capability: "edit",
      previousValue: 1,
      newValue: 3,
      details: { via: "permission center" },
    });

    const insert = mockExecute.mock.calls[0][0];
    expect(String(insert.sql)).toContain("INSERT INTO permission_audit_log");
    expect(insert.args).toEqual([
      "SA1",
      "Super Admin",
      "USR1",
      "Someone",
      "grant",
      "projects",
      "edit",
      1,
      3,
      { via: "permission center" },
    ]);
  });

  it("stores null for the fields that were not supplied", async () => {
    serveDb([]);

    await logPermissionAudit({ actorCid: "SA1", targetCid: "USR1", action: "revoke" });

    expect(mockExecute.mock.calls[0][0].args).toEqual([
      "SA1",
      null,
      "USR1",
      null,
      "revoke",
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("never breaks the action it records when the write fails", async () => {
    mockExecute.mockRejectedValue(new Error("connection terminated"));

    await expect(
      logPermissionAudit({ actorCid: "SA1", targetCid: "USR1", action: "grant" }),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
