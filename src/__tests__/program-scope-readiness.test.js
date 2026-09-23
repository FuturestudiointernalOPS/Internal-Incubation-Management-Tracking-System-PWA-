/**
 * PROGRAM SCOPE READINESS — the measurement that makes enforcing the program
 * scope rule safe.
 *
 * Three answers are locked here, because each one decides whether the rule can
 * be switched on:
 *
 *   1. UNMANAGED — a running program with no manager recorded can never be
 *      matched by the rule, so enforcing it first would make the program
 *      unreachable. Ended programs are not a defect and must not be reported.
 *   2. HOLDERS — who currently resolves to a template that grants program
 *      editing, and whether they are attached to a running program. A holder
 *      attached to nothing loses everything; that count decides the cutover.
 *   3. REMOVALS — which capabilities a portfolio template would stop granting,
 *      reported as a property of the TEMPLATE (the same for everyone on it).
 *
 * The report is read-only: nothing in this suite, or in the model, changes
 * access.
 */

let mockState = {};

async function mockExecute(query) {
  const sqlText = typeof query === "string" ? query : query.sql || "";
  if (/^\s*(CREATE TABLE|CREATE INDEX)/i.test(sqlText)) return { rows: [] };
  if (sqlText.includes("FROM role_access_profile_defaults")) {
    return { rows: mockState.roleDefaults };
  }
  if (sqlText.includes("EXISTS (")) return { rows: mockState.templates };
  if (sqlText.includes("FROM contacts")) return { rows: mockState.holders };
  if (sqlText.includes("FROM access_profile_capabilities")) {
    return { rows: mockState.profileCaps };
  }
  if (sqlText.includes("FROM v2_program_staff")) return { rows: mockState.attachments };
  if (sqlText.includes("FROM v2_programs")) return { rows: mockState.programs };
  return { rows: [] };
}

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async (query) => mockExecute(query)) },
  initDb: jest.fn(async () => true),
}));

const { buildProgramScopeReadiness } = require("@/models/authorization/programScopeReadiness");

const OPEN_END = "2099-06-30";

beforeEach(() => {
  mockState = {
    templates: [{ id: 7, name: "Program Manager", is_active: 1 }],
    profileCaps: [
      { profile_id: 7, module: "programs", capability: "view", access_level: 1 },
      { profile_id: 7, module: "programs", capability: "edit", access_level: 3 },
      { profile_id: 7, module: "programs", capability: "publish", access_level: 4 },
      // The two misplaced bundles this report exists to surface.
      { profile_id: 7, module: "contacts", capability: "create", access_level: 2 },
      { profile_id: 7, module: "ventures", capability: "edit", access_level: 3 },
    ],
    roleDefaults: [{ role_name: "program_manager", access_profile_id: 7 }],
    holders: [],
    programs: [],
    attachments: [],
  };
});

describe("unmanaged programs — the repair worklist", () => {
  test("a running program with no manager recorded is reported", async () => {
    mockState.programs = [
      {
        id: "P1",
        name: "Cohort 1",
        status: "Active",
        end_date: OPEN_END,
        is_archived: 0,
        assigned_pm_id: null,
      },
    ];

    const report = await buildProgramScopeReadiness();

    expect(report.unmanaged).toEqual([
      { id: "P1", name: "Cohort 1", status: "Active", endDate: OPEN_END },
    ]);
    expect(report.summary.unmanaged).toBe(1);
  });

  test("a program with a named manager is NOT reported", async () => {
    mockState.programs = [
      {
        id: "P1",
        name: "Cohort 1",
        status: "Active",
        end_date: OPEN_END,
        is_archived: 0,
        assigned_pm_id: "USR_PM",
      },
    ];

    const report = await buildProgramScopeReadiness();
    expect(report.unmanaged).toEqual([]);
  });

  test("a manager recorded only as a staff row still counts as managed", async () => {
    mockState.programs = [
      {
        id: "P1",
        name: "Cohort 1",
        status: "Active",
        end_date: OPEN_END,
        is_archived: 0,
        assigned_pm_id: null,
      },
    ];
    // The two are read together everywhere else, so they must be here too.
    mockState.attachments = [
      { program_id: "P1", cid: "USR_PM", status: "Active", end_date: OPEN_END, is_archived: 0 },
    ];

    const report = await buildProgramScopeReadiness();
    expect(report.unmanaged).toEqual([]);
  });

  test("an ENDED program with no manager is not a defect", async () => {
    mockState.programs = [
      {
        id: "P1",
        name: "Old cohort",
        status: "Completed",
        end_date: "2020-01-01",
        is_archived: 0,
        assigned_pm_id: null,
      },
      {
        id: "P2",
        name: "Archived",
        status: "Active",
        end_date: OPEN_END,
        is_archived: 1,
        assigned_pm_id: null,
      },
    ];

    const report = await buildProgramScopeReadiness();
    expect(report.unmanaged).toEqual([]);
    expect(report.summary.runningPrograms).toBe(0);
  });
});

describe("holders — who the rule would affect", () => {
  test("a holder attached to no running program loses everything", async () => {
    mockState.holders = [
      { cid: "USR_ORPHAN", name: "Orphan PM", role: "program_manager", access_profile_id: null },
    ];

    const report = await buildProgramScopeReadiness();

    expect(report.holders).toHaveLength(1);
    expect(report.holders[0]).toMatchObject({
      cid: "USR_ORPHAN",
      profile: "Program Manager",
      viaRole: "program_manager",
      keptCount: 0,
      losesEverything: true,
    });
    expect(report.summary.losesEverything).toBe(1);
    expect(report.summary.keptSome).toBe(0);
  });

  test("a holder attached to a running program keeps it", async () => {
    mockState.holders = [
      { cid: "USR_PM", name: "Real PM", role: "program_manager", access_profile_id: null },
    ];
    mockState.attachments = [
      { program_id: "P1", cid: "USR_PM", status: "Active", end_date: OPEN_END, is_archived: 0 },
    ];

    const report = await buildProgramScopeReadiness();

    expect(report.holders[0]).toMatchObject({
      keptPrograms: ["P1"],
      keptCount: 1,
      losesEverything: false,
    });
    expect(report.summary.keptSome).toBe(1);
    expect(report.summary.losesEverything).toBe(0);
  });

  test("an attachment to an ENDED program does not count as kept", async () => {
    mockState.holders = [
      { cid: "USR_PM", name: "Former PM", role: "program_manager", access_profile_id: null },
    ];
    mockState.attachments = [
      { program_id: "P1", cid: "USR_PM", status: "Completed", end_date: "2020-01-01", is_archived: 0 },
    ];

    const report = await buildProgramScopeReadiness();
    expect(report.holders[0].losesEverything).toBe(true);
  });

  test("an explicit profile override wins over the role default", async () => {
    mockState.holders = [
      {
        cid: "USR_OVERRIDE",
        name: "Overridden",
        role: "staff",
        access_profile_id: 7,
        override_profile_name: "Program Manager",
      },
    ];

    const report = await buildProgramScopeReadiness();
    expect(report.holders[0]).toMatchObject({
      profileId: "7",
      profile: "Program Manager",
      viaRole: null,
    });
  });
});

describe("template split — what the portfolio template would stop granting", () => {
  test("the two misplaced bundles are reported with the template that grants them", async () => {
    mockState.holders = [
      { cid: "USR_A", name: "A", role: "program_manager", access_profile_id: null },
    ];

    const report = await buildProgramScopeReadiness();

    const reported = report.removals.map((removal) => `${removal.module}.${removal.capability}`).sort();
    expect(reported).toEqual(["contacts.create", "ventures.edit"]);
    for (const removal of report.removals) {
      expect(removal.profile).toBe("Program Manager");
      expect(removal.holders).toBe(1);
      expect(removal.why).toBeTruthy();
    }
  });

  test("a template without the bundles reports nothing", async () => {
    mockState.profileCaps = [
      { profile_id: 7, module: "programs", capability: "edit", access_level: 3 },
      { profile_id: 7, module: "contacts", capability: "view", access_level: 1 },
      { profile_id: 7, module: "ventures", capability: "view", access_level: 1 },
    ];

    const report = await buildProgramScopeReadiness();
    // Reading people and ventures stays; only the WRITES are the problem.
    expect(report.removals).toEqual([]);
  });

  test("the portfolio templates are listed with their capabilities", async () => {
    const report = await buildProgramScopeReadiness();

    expect(report.portfolioTemplates).toHaveLength(1);
    expect(report.portfolioTemplates[0]).toMatchObject({
      id: 7,
      name: "Program Manager",
      isActive: true,
    });
    expect(report.portfolioTemplates[0].capabilities).toContain("programs.edit");
  });

  test("a template that only grants program VIEW is not a portfolio template", async () => {
    // Seeing the catalogue is deliberately portfolio-wide; only edit/publish
    // are narrowed by the scope rule.
    mockState.templates = [];
    const report = await buildProgramScopeReadiness();
    expect(report.portfolioTemplates).toEqual([]);
    expect(report.removals).toEqual([]);
    expect(report.holders).toEqual([]);
  });
});
