/**
 * Participant assignments — the DECISIONS.
 *
 * The first slice of the participant-portal domain. These used to sit inline in
 * `src/app/api/participant/assignments/route.js`. They now live in
 * `src/services/participant/assignments.js`. This suite pins the observable
 * behaviour: which requirements a participant sees, how a submission is matched,
 * the ordering, and the version decision.
 */

jest.mock("@/models/participant-membership", () => ({
  getParticipantProgramIds: jest.fn(),
}));

jest.mock("@/models/participantPortal", () => ({
  getAssignmentsProgramById: jest.fn(),
  getAssignmentsDeliverablesByProgramId: jest.fn(),
  getAssignmentsSubmissionsByProgram: jest.fn(),
  getExistingSubmission: jest.fn(),
  archiveSubmissionVersion: jest.fn(),
  updateSubmissionVersion: jest.fn(),
  insertSubmission: jest.fn(),
}));

const membership = require("@/models/participant-membership");
const portal = require("@/models/participantPortal");
const {
  deliverableTargetsParticipant,
  sortAssignments,
  buildParticipantAssignments,
  submitAssignmentVersion,
} = require("@/services/participant/assignments");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("deliverableTargetsParticipant", () => {
  const ctx = { cid: "c1", teamIds: ["t1"] };

  it("shows an unscoped requirement to everyone", () => {
    expect(deliverableTargetsParticipant({ assignee_type: "all" }, ctx)).toBe(true);
    expect(deliverableTargetsParticipant({}, ctx)).toBe(true);
  });

  it("shows a team requirement only to that team", () => {
    expect(
      deliverableTargetsParticipant({ assignee_type: "team", assignee_id: "t1" }, ctx),
    ).toBe(true);
    expect(
      deliverableTargetsParticipant({ assignee_type: "team", assignee_id: "t2" }, ctx),
    ).toBe(false);
    expect(
      deliverableTargetsParticipant(
        { assignee_type: "team", assignee_id: "t1" },
        { cid: "c1", teamIds: [] },
      ),
    ).toBe(false);
  });

  it("shows an individual requirement only to that person", () => {
    expect(
      deliverableTargetsParticipant({ assignee_type: "individual", assignee_id: "c1" }, ctx),
    ).toBe(true);
    expect(
      deliverableTargetsParticipant({ assignee_type: "individual", assignee_id: "c2" }, ctx),
    ).toBe(false);
  });

  it("keeps an unknown scope visible (never hides work we do not understand)", () => {
    expect(deliverableTargetsParticipant({ assignee_type: "???" }, ctx)).toBe(true);
  });
});

describe("sortAssignments", () => {
  it("puts an overdue unsubmitted requirement first, then the newest due date", () => {
    const now = new Date("2030-01-01T00:00:00Z");
    const list = [
      { id: "a", submission: { id: "s" }, dueDate: "2029-01-01" },
      { id: "b", submission: null, dueDate: "2028-01-01" },
      { id: "c", submission: null, dueDate: "2031-01-01" },
    ];

    expect(sortAssignments(list, now).map((row) => row.id)).toEqual(["b", "c", "a"]);
    // The caller's list is untouched.
    expect(list.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});

describe("buildParticipantAssignments", () => {
  it("keeps only the requirements that target the participant, and matches the submission", async () => {
    membership.getParticipantProgramIds.mockResolvedValue(["p1", "p2"]);

    portal.getAssignmentsProgramById.mockImplementation(async (programId) =>
      programId === "p1" ? { rows: [{ name: "Alpha" }] } : { rows: [] },
    );
    portal.getAssignmentsDeliverablesByProgramId.mockResolvedValue({
      rows: [
        { id: "d1", title: "Everyone", assignee_type: "all", due_date: "2099-02-01" },
        { id: "d2", title: "Team", assignee_type: "team", assignee_id: "t1", due_date: "2099-01-01" },
        { id: "d3", title: "Someone else", assignee_type: "individual", assignee_id: "c9" },
      ],
    });
    portal.getAssignmentsSubmissionsByProgram.mockResolvedValue({
      rows: [
        {
          id: "s1",
          document_id: "d1",
          status: "approved",
          file_url: "u1",
          score: 9,
          created_at: "2026-01-01",
        },
      ],
    });

    const assignments = await buildParticipantAssignments({
      cid: "c1",
      contact: { v2_team_id: "t1" },
    });

    expect(assignments.map((row) => row.id)).toEqual(["d1", "d2"]);
    expect(assignments[0]).toEqual(
      expect.objectContaining({
        programId: "p1",
        programName: "Alpha",
        submission: expect.objectContaining({ id: "s1", status: "approved", score: 9 }),
      }),
    );
    expect(assignments[1].submission).toBeNull();
  });

  it("honours the program filter", async () => {
    membership.getParticipantProgramIds.mockResolvedValue(["p1", "p2"]);

    const assignments = await buildParticipantAssignments({
      cid: "c1",
      contact: {},
      filterProgramId: "p2",
    });

    // p1 is filtered out before any read; p2 has no program row.
    expect(portal.getAssignmentsProgramById).toHaveBeenCalledTimes(1);
    expect(portal.getAssignmentsProgramById).toHaveBeenCalledWith("p2");
    expect(assignments).toEqual([]);
  });
});

describe("submitAssignmentVersion", () => {
  it("archives the previous version and advances when one exists", async () => {
    portal.getExistingSubmission.mockResolvedValue({
      rows: [{ id: "old-1", file_url: "u0", version: 3 }],
    });

    await submitAssignmentVersion({
      cid: "c1",
      programId: "p1",
      deliverableId: "d1",
      fileUrl: "u1",
    });

    expect(portal.archiveSubmissionVersion).toHaveBeenCalledWith("old-1", "c1", "d1", "u0", 3);
    expect(portal.updateSubmissionVersion).toHaveBeenCalledWith("u1", "old-1");
    expect(portal.insertSubmission).not.toHaveBeenCalled();
  });

  it("inserts a first version when none exists", async () => {
    portal.getExistingSubmission.mockResolvedValue({ rows: [] });

    await submitAssignmentVersion({
      cid: "c1",
      programId: "p1",
      deliverableId: "d1",
      fileUrl: null,
    });

    expect(portal.insertSubmission).toHaveBeenCalledWith("c1", "p1", "d1", null);
    expect(portal.archiveSubmissionVersion).not.toHaveBeenCalled();
  });
});
