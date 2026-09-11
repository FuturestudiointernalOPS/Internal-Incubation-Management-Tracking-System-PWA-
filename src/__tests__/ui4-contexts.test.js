/**
 * PHASE UI-4c — contexts on Individual Access.
 *
 * Locks the fifth defect class from the intern report: a person's contextual
 * relationships were nowhere on the screen, so a program participant read as
 * "member" with an empty capability list and the panel looked broken.
 *
 * Two contracts:
 *   1. getContactContexts reads the SAME assignment authority the scope engine
 *      enforces from, states the role inside each context, and reports a failed
 *      lookup as `unavailable` instead of flattening it into "no memberships".
 *   2. The identities/context-roles split stays one set split in two — the
 *      labels can never disagree with the ceilings the engine enforces.
 */

const fs = require("fs");
const path = require("path");

const mockState = {
  ventureScope: [],
  programScope: [],
  courseScope: [],
  ventureRows: [],
  programRows: [],
  courseRows: [],
  ventureMemberRows: [],
  programStaffRows: [],
  participantRows: [],
  throwOn: null,
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async (queryObj) => {
      const sql = typeof queryObj === "string" ? queryObj : queryObj?.sql || "";
      const s = String(sql);
      if (mockState.throwOn && s.includes(mockState.throwOn)) {
        throw new Error("lookup failed");
      }
      if (s.includes("CAST(venture_id AS TEXT) AS id") && s.includes("UNION")) {
        return { rows: mockState.ventureScope };
      }
      if (s.includes("CAST(program_id AS TEXT) AS id") && s.includes("UNION")) {
        return { rows: mockState.programScope };
      }
      if (s.includes("CAST(course_id AS TEXT) AS id")) {
        return { rows: mockState.courseScope };
      }
      if (s.includes("FROM ventures")) return { rows: mockState.ventureRows };
      if (s.includes("FROM v2_programs")) return { rows: mockState.programRows };
      if (s.includes("FROM lms_courses")) return { rows: mockState.courseRows };
      if (s.includes("member_type")) return { rows: mockState.ventureMemberRows };
      if (s.includes("FROM venture_staff_assignments")) return { rows: [] };
      if (s.includes("SELECT CAST(program_id AS TEXT) AS id, role")) {
        return { rows: mockState.programStaffRows };
      }
      if (s.includes("FROM participant_programs")) return { rows: mockState.participantRows };
      return { rows: [] };
    }),
  },
  initDb: jest.fn(async () => {}),
}));

const {
  getContactContexts,
} = require("@/models/authorization/contactContexts");
const {
  ELIGIBILITY_IDENTITIES,
  BASELINE_IDENTITIES,
  CONTEXT_ROLES,
  ELIGIBILITY_IDENTITY_GROUPS,
} = require("@/models/authorization/eligibility-admin");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

beforeEach(() => {
  mockState.ventureScope = [];
  mockState.programScope = [];
  mockState.courseScope = [];
  mockState.ventureRows = [];
  mockState.programRows = [];
  mockState.courseRows = [];
  mockState.ventureMemberRows = [];
  mockState.programStaffRows = [];
  mockState.participantRows = [];
  mockState.throwOn = null;
});

describe("UI-4c — getContactContexts", () => {
  test("lists every context with the role the person holds inside it", async () => {
    mockState.ventureScope = [{ id: "VNT-1" }];
    mockState.programScope = [{ id: "PRG-9" }];
    mockState.courseScope = [{ id: "CRS-3" }];
    mockState.ventureRows = [{ id: "VNT-1", label: "Acme" }];
    mockState.programRows = [{ id: "PRG-9", label: "Founders Bootcamp" }];
    mockState.courseRows = [{ id: "CRS-3", label: "GTM 101" }];
    mockState.ventureMemberRows = [{ id: "VNT-1", member_type: "founder", is_owner: 1 }];
    mockState.participantRows = [{ id: "PRG-9" }];

    const { contexts, unavailable } = await getContactContexts("USR-1");

    expect(unavailable).toEqual([]);
    expect(contexts).toEqual([
      {
        type: "venture",
        id: "VNT-1",
        label: "Acme",
        role: "founder",
        scopePolicy: "venture_own",
        scopeImplemented: true,
      },
      {
        type: "program",
        id: "PRG-9",
        label: "Founders Bootcamp",
        role: "participant",
        scopePolicy: "program_assigned",
        scopeImplemented: true,
      },
      {
        type: "course",
        id: "CRS-3",
        label: "GTM 101",
        role: "learner",
        scopePolicy: "learning_own",
        scopeImplemented: true,
      },
    ]);
  });

  test("a failing lookup is reported, not flattened into 'no contexts'", async () => {
    mockState.programScope = [{ id: "PRG-9" }];
    mockState.programRows = [{ id: "PRG-9", label: "Bootcamp" }];
    mockState.participantRows = [{ id: "PRG-9" }];
    // Only the venture resolution breaks.
    mockState.throwOn = "FROM venture_members";

    const { contexts, unavailable } = await getContactContexts("USR-1");

    expect(unavailable).toEqual(["venture"]);
    expect(contexts.map((c) => c.type)).toEqual(["program"]);
  });

  test("a person with no relationships gets an empty list, not an error", async () => {
    const { contexts, unavailable } = await getContactContexts("USR-1");
    expect(contexts).toEqual([]);
    expect(unavailable).toEqual([]);
  });

  test("no cid means no lookup at all", async () => {
    expect(await getContactContexts(null)).toEqual({ contexts: [], unavailable: [] });
    expect(await getContactContexts("")).toEqual({ contexts: [], unavailable: [] });
  });

  test("a missing label falls back to the id, never to a blank chip", async () => {
    mockState.ventureScope = [{ id: "VNT-7" }];
    mockState.ventureMemberRows = [{ id: "VNT-7", member_type: "team_member", is_owner: 0 }];

    const { contexts } = await getContactContexts("USR-1");
    expect(contexts[0]).toMatchObject({ label: "VNT-7", role: "team_member" });
  });
});

describe("UI-4c — identities and context roles stay one set split in two", () => {
  test("the groups do not overlap and cover the full identity list", () => {
    expect(BASELINE_IDENTITIES).toEqual(["super_admin", "staff", "member"]);
    expect(CONTEXT_ROLES).toEqual(["participant", "facilitator", "investor", "founder"]);
    for (const ident of BASELINE_IDENTITIES) expect(CONTEXT_ROLES).not.toContain(ident);
    expect([...BASELINE_IDENTITIES, ...CONTEXT_ROLES]).toEqual(ELIGIBILITY_IDENTITIES);
    expect(ELIGIBILITY_IDENTITY_GROUPS).toEqual({
      identities: BASELINE_IDENTITIES,
      contextRoles: CONTEXT_ROLES,
    });
  });
});

describe("UI-4c — the screens use them", () => {
  test("the context endpoint carries contexts and their availability", () => {
    const src = read("src/app/api/engineering/permissions/user-context/route.js");
    expect(src).toContain("getContactContexts");
    expect(src).toContain("contexts: contextData.contexts");
    expect(src).toContain("contextsUnavailable: contextData.unavailable");
  });

  test("the eligibility feed tells the UI which columns are context roles", () => {
    const src = read("src/app/api/engineering/permissions/eligibility/route.js");
    expect(src).toContain("ELIGIBILITY_IDENTITY_GROUPS");
    expect(src).toContain("identityGroups:");
  });

  test("Individual Access renders the contexts panel", () => {
    const src = read("src/components/permissions/PeopleView.js");
    expect(src).toContain("peopleContextsTitle");
    expect(src).toContain("contextKind_");
    expect(src).toContain("peopleContextsPartial");
  });

  test("both matrices label context roles as such", () => {
    const center = read("src/components/permissions/PermissionCenter.js");
    const matrix = read("src/components/permissions/DefaultsMatrixView.js");
    expect(center).toContain("contextRoleTag");
    expect(matrix).toContain("contextRoleTag");
  });

  test("every new string exists in English and French", () => {
    for (const key of [
      "engineering.permissions.peopleContextsTitle",
      "engineering.permissions.peopleContextsNone",
      "engineering.permissions.peopleContextsPartial",
      "engineering.permissions.peopleContextsNote",
      "engineering.permissions.contextKind_program",
      "engineering.permissions.contextKind_venture",
      "engineering.permissions.contextKind_course",
      "engineering.permissions.contextPending",
      "engineering.permissions.contextRoleTag",
      "engineering.permissions.identityGroupsNote",
    ]) {
      expect(typeof resolveKey(EN, key)).toBe("string");
      expect(typeof resolveKey(FR, key)).toBe("string");
    }
  });
});
