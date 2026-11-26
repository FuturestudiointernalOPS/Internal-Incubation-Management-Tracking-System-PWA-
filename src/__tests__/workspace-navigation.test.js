/**
 * Workspace navigation — the DECISIONS.
 *
 * These decisions used to sit inline in `src/app/api/workspaces/route.js`. They
 * now live in `src/services/workspace/navigation.js`, and the participation
 * verdict comes from the ONE rule in
 * `src/services/participant/participation.js`. This suite pins the observable
 * behaviour — which workspaces appear, how the enrollments are derived, which
 * contexts are built, how the identity is labelled — not the implementation.
 */

jest.mock("@/models/workspace", () => ({
  getStaffAssignmentsForUser: jest.fn(),
  getProgramAssignmentsFromContactRoles: jest.fn(),
  getActiveResponsibilitiesForUser: jest.fn(),
  getActiveVentureMembershipsForContact: jest.fn(),
}));

jest.mock("@/services/participant/participation", () => ({
  resolveParticipantParticipation: jest.fn(),
}));

jest.mock("@/services/authorization/membership", () => ({
  getEffectiveGroupsAndHistory: jest.fn(),
}));

jest.mock("@/services/lms/learning", () => ({
  learnerHasEnrollments: jest.fn(),
}));

jest.mock("@/models/platform/roles", () => ({
  roleHomeHref: (role) => `/home/${role}`,
}));

const model = require("@/models/workspace");
const participation = require("@/services/participant/participation");
const membership = require("@/services/authorization/membership");
const lms = require("@/services/lms/learning");
const {
  buildWorkspaceNavigation,
  deriveBaselineRole,
} = require("@/services/workspace/navigation");

const SESSION = { cid: "c1", email: "e@example.com", role: "staff" };

function setUpReads({
  staff = [],
  contactRoles = [],
  participations = [],
  groups = [],
  history = [],
  responsibilities = [],
  ventures = [],
  enrolled = false,
} = {}) {
  model.getStaffAssignmentsForUser.mockResolvedValue({ rows: staff });
  model.getProgramAssignmentsFromContactRoles.mockResolvedValue({ rows: contactRoles });
  participation.resolveParticipantParticipation.mockResolvedValue({
    programIds: participations.map((entry) => entry.program_id),
    memberships: participations,
    hasCompleted: participations.some((entry) => entry.completed),
    isProgramParticipant: participations.length > 0,
  });
  membership.getEffectiveGroupsAndHistory.mockResolvedValue({ groups, history });
  model.getActiveResponsibilitiesForUser.mockResolvedValue({ rows: responsibilities });
  model.getActiveVentureMembershipsForContact.mockResolvedValue({ rows: ventures });
  lms.learnerHasEnrollments.mockResolvedValue(enrolled);
}

const activeSeat = (overrides = {}) => ({
  program_id: "p2",
  program_name: "Beta",
  status: "active",
  completed: false,
  readOnly: false,
  completed_at: null,
  outcome: null,
  certificate_issued: false,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("buildWorkspaceNavigation — the hub list", () => {
  it("lists staff assignments and enrollments, and builds every context", async () => {
    setUpReads({
      staff: [{ program_id: "p1", program_name: "Alpha", role: "facilitator" }],
      participations: [activeSeat()],
      groups: ["B", "A"],
      enrolled: true,
    });

    const nav = await buildWorkspaceNavigation(SESSION, false);

    expect(nav.workspaces).toHaveLength(2);
    expect(nav.workspaces).toContainEqual({
      type: "program",
      title: "facilitator",
      program_id: "p1",
      program_name: "Alpha",
      href: "/member/facilitator/program/p1",
    });
    expect(nav.workspaces).toContainEqual({
      type: "program",
      title: "participant",
      program_id: "p2",
      program_name: "Beta",
      completed: false,
      href: "/member/participant/p2",
    });

    // The legacy staff row is echoed as a program assignment (not mirrored).
    expect(nav.contexts.program_assignments).toEqual([
      expect.objectContaining({ source: "v2_program_staff", href: "/member/facilitator/program/p1" }),
    ]);

    expect(nav.contexts.program_participations).toEqual([
      {
        program_id: "p2",
        program_name: "Beta",
        status: "active",
        completed: false,
        readonly: false,
        completed_at: null,
        outcome: null,
        certificate_issued: false,
        href: "/member/participant/p2",
      },
    ]);

    expect(nav.contexts.org_memberships).toEqual([
      { group_name: "A", href: "/home/staff" },
      { group_name: "B", href: "/home/staff" },
    ]);
    expect(nav.contexts.learning).toEqual({
      enrolled: true,
      href: "/member/participant/learning",
    });
  });

  it("does not enroll someone in a program they already staff", async () => {
    setUpReads({
      staff: [{ program_id: "p1", program_name: "Alpha", role: "staff" }],
      contactRoles: [{ program_id: "p1", role: "staff", is_current: true }],
      participations: [activeSeat({ program_id: "p1", program_name: "Alpha" })],
    });

    const nav = await buildWorkspaceNavigation(SESSION, false);

    // Only the staff workspace; the participant duplicate is filtered out.
    expect(nav.workspaces).toEqual([
      {
        type: "program",
        title: "staff",
        program_id: "p1",
        program_name: "Alpha",
        href: "/home/staff",
      },
    ]);
    // The contact_roles row is current, so no legacy duplicate is appended.
    expect(nav.contexts.program_assignments).toEqual([
      expect.objectContaining({ program_id: "p1", source: "contact_roles", href: "/home/staff" }),
    ]);
  });

  it("skips the hub-only reads in contexts scope", async () => {
    setUpReads({
      staff: [{ program_id: "p1", role: "staff" }],
      contactRoles: [{ program_id: "p1", role: "staff", is_current: true }],
      participations: [activeSeat()],
    });

    const nav = await buildWorkspaceNavigation(SESSION, true);

    expect(model.getStaffAssignmentsForUser).not.toHaveBeenCalled();
    expect(model.getProgramAssignmentsFromContactRoles).not.toHaveBeenCalled();
    expect(nav.contexts.program_assignments).toEqual([]);
    expect(nav.workspaces).toHaveLength(1);
  });

  it("keeps a completed participation listed, read-only", async () => {
    setUpReads({
      participations: [
        activeSeat({
          program_id: "p9",
          program_name: "Done",
          status: "completed",
          completed: true,
          readOnly: true,
          completed_at: "2025-01-01",
        }),
      ],
    });

    const nav = await buildWorkspaceNavigation(SESSION, false);

    // The door stays in the hub…
    expect(nav.workspaces).toContainEqual(
      expect.objectContaining({ program_id: "p9", completed: true, href: "/member/participant/p9" }),
    );
    // …and the context says it is read-only.
    expect(nav.contexts.program_participations[0]).toEqual(
      expect.objectContaining({ completed: true, readonly: true, href: "/member/participant/p9" }),
    );
  });
});

describe("deriveBaselineRole", () => {
  it("surfaces a stored baseline member as the session role", () => {
    expect(deriveBaselineRole({ role: "participant" }, "member")).toEqual({
      baselineRole: "member",
      derivedRole: "participant",
    });
  });

  it("does not derive when the stored role is already contextual", () => {
    expect(deriveBaselineRole({ role: "participant" }, "staff")).toEqual({
      baselineRole: "staff",
      derivedRole: null,
    });
  });

  it("falls back to the session role when nothing is stored", () => {
    expect(deriveBaselineRole({ role: "participant" }, undefined)).toEqual({
      baselineRole: "participant",
      derivedRole: null,
    });
  });

  it("lowercases the stored role", () => {
    expect(deriveBaselineRole({ role: "staff" }, "MEMBER")).toEqual({
      baselineRole: "member",
      derivedRole: "staff",
    });
  });
});
