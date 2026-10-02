/**
 * Workspace calendar — the scope/visibility DECISIONS.
 *
 * These decisions used to sit inline in `src/app/api/calendar/route.js`. They
 * now live in `src/services/workspace/calendar.js`. This suite pins the
 * observable behaviour (who may see which programs/ventures/follow-ups, and the
 * fail-closed rules), not the implementation — the same net that lets us keep
 * moving the code without silently changing access.
 */

jest.mock("@/models/workspace", () => ({
  getFacilitatorProgramScopePids: jest.fn(),
  getParticipantProgramScopePids: jest.fn(),
}));

jest.mock("@/models/workspaceCalendarStore", () => ({
  selectVentureScope: jest.fn(),
  selectInternalVentureIds: jest.fn(),
  selectPersonalVentureSessions: jest.fn(),
  selectCalendarVentureScope: jest.fn(),
  selectCoachedVentureIds: jest.fn(),
  selectVentureIdsByCodes: jest.fn(),
}));

const workspaceModel = require("@/models/workspace");
const store = require("@/models/workspaceCalendarStore");
const {
  resolveCalendarProgramScope,
  resolveCalendarFollowupVisibility,
  resolveCalendarVentureScope,
} = require("@/services/workspace/calendar");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("resolveCalendarProgramScope", () => {
  it("leaves the privileged platform roles unscoped", async () => {
    const res = await resolveCalendarProgramScope("cid-1", "staff");
    expect(res).toEqual({
      scopedProgramIds: null,
      programScopeSql: "",
      programTableScopeSql: "",
      programScopeArgs: [],
    });
    expect(workspaceModel.getFacilitatorProgramScopePids).not.toHaveBeenCalled();
  });

  it("scopes a participant to their assigned and enrolled programs", async () => {
    workspaceModel.getFacilitatorProgramScopePids.mockResolvedValue({
      rows: [{ pid: 1 }],
    });
    workspaceModel.getParticipantProgramScopePids.mockResolvedValue({
      rows: [{ pid: 2 }, { pid: 1 }],
    });

    const res = await resolveCalendarProgramScope("cid-1", "participant");

    expect(new Set(res.scopedProgramIds)).toEqual(new Set(["1", "2"]));
    expect(res.programScopeArgs).toEqual(res.scopedProgramIds);
    expect(res.programScopeSql).toBe(" AND CAST(program_id AS TEXT) IN (?,?)");
    expect(res.programTableScopeSql).toBe(" AND CAST(id AS TEXT) IN (?,?)");
  });

  it("fails CLOSED when the caller has no program relationship", async () => {
    workspaceModel.getFacilitatorProgramScopePids.mockResolvedValue({ rows: [] });
    workspaceModel.getParticipantProgramScopePids.mockResolvedValue({ rows: [] });

    const res = await resolveCalendarProgramScope("cid-1", "member");

    expect(res.scopedProgramIds).toEqual(["__no_program_scope__"]);
    expect(res.programScopeSql).toBe(" AND CAST(program_id AS TEXT) IN (?)");
    expect(res.programScopeArgs).toEqual(["__no_program_scope__"]);
  });

  it("leaves an anonymous caller unscoped", async () => {
    const res = await resolveCalendarProgramScope(null, undefined);
    expect(res.scopedProgramIds).toBeNull();
    expect(workspaceModel.getParticipantProgramScopePids).not.toHaveBeenCalled();
  });
});

describe("resolveCalendarFollowupVisibility", () => {
  it("shows a participant only their own follow-ups", () => {
    expect(resolveCalendarFollowupVisibility("cid-9", "participant")).toEqual({
      followupVisibilitySql: " AND f.participant_id = ?",
      followupVisibilityArgs: ["cid-9"],
    });
  });

  it("shows a super admin everything", () => {
    expect(resolveCalendarFollowupVisibility("cid-9", "super_admin")).toEqual({
      followupVisibilitySql: "",
      followupVisibilityArgs: [],
    });
  });

  it("restricts everyone else to what they created, keeping legacy rows", () => {
    expect(resolveCalendarFollowupVisibility("cid-9", "staff")).toEqual({
      followupVisibilitySql: " AND (f.created_by IS NULL OR f.created_by = ?)",
      followupVisibilityArgs: ["cid-9"],
    });
  });

  it("is unscoped without a session", () => {
    expect(resolveCalendarFollowupVisibility(null, "participant")).toEqual({
      followupVisibilitySql: "",
      followupVisibilityArgs: [],
    });
  });
});

describe("resolveCalendarVentureScope", () => {
  it("grants a privileged role every Venture outside personal mode", async () => {
    const res = await resolveCalendarVentureScope("cid-1", "staff", false);
    expect(res).toEqual({
      seesAllVentures: true,
      ventureScope: null,
      scopeIds: null,
    });
    expect(store.selectCalendarVentureScope).not.toHaveBeenCalled();
  });

  it("restricts a privileged role to its own Ventures in personal mode", async () => {
    store.selectCalendarVentureScope.mockResolvedValue({
      rows: [{ venture_id: "VNT-1" }],
    });
    store.selectCoachedVentureIds.mockResolvedValue({
      rows: [{ venture_id: "VNT-2" }],
    });
    store.selectVentureIdsByCodes.mockResolvedValue({
      rows: [{ venture_id: "VNT-1", id: "uuid-1" }],
    });

    const res = await resolveCalendarVentureScope("cid-1", "staff", true);

    expect(res.seesAllVentures).toBe(false);
    expect(new Set(res.ventureScope)).toEqual(new Set(["VNT-1", "VNT-2"]));
    // VNT-1 resolved to its UUID; VNT-2 stayed as a code (no match).
    expect(new Set(res.scopeIds)).toEqual(new Set(["uuid-1", "VNT-2"]));
  });

  it("keeps an empty scope empty for a non-privileged caller", async () => {
    store.selectCalendarVentureScope.mockResolvedValue({ rows: [] });

    const res = await resolveCalendarVentureScope("cid-1", "participant", false);

    expect(res).toEqual({
      seesAllVentures: false,
      ventureScope: [],
      scopeIds: null,
    });
    expect(store.selectVentureIdsByCodes).not.toHaveBeenCalled();
  });
});
