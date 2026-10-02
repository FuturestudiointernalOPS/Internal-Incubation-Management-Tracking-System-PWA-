/**
 * Participant support routes — the DECISIONS.
 *
 * The follow-up, full-state, ritual and timeline decisions used to sit inline in
 * their controllers. They now live in `src/services/participant/*`. This suite
 * pins the observable behaviour, not the implementation.
 */

jest.mock("@/models/participantPortal", () => ({
  getFollowupEventsByParticipant: jest.fn(),
  getFollowupTableRowsByParticipant: jest.fn(),
  getFullStateContactCidByEmail: jest.fn(),
  getFullStateProgramByName: jest.fn(),
  getFullStateSubmissionsByParticipant: jest.fn(),
  getFullStateSessionsByProgram: jest.fn(),
  getFullStateNotificationsByRecipient: jest.fn(),
  getFullStateKpisByProgram: jest.fn(),
  getFullStateDocumentsByProgram: jest.fn(),
  getFullStateFollowupsByProgram: jest.fn(),
  getFullStateTeamByGroupName: jest.fn(),
  getFullStateFamilyByName: jest.fn(),
  createCheckin: jest.fn(),
  createStandup: jest.fn(),
  createRetro: jest.fn(),
  createReflection: jest.fn(),
  getSubmissionProgramCompletionStatus: jest.fn(),
  insertParticipantSubmission: jest.fn(),
  getSubmissionsByParticipantOrTeam: jest.fn(),
}));

const portal = require("@/models/participantPortal");
const {
  mapFollowupEvents,
  mapFollowupRows,
  mergeFollowups,
  buildParticipantFollowups,
} = require("@/services/participant/followups");
const {
  canReadFullState,
  resolveFullStateCid,
  aggregateGrades,
  buildParticipantFullState,
} = require("@/services/participant/fullState");
const {
  buildReflectionContent,
  currentYear,
  recordCheckin,
  recordReflection,
} = require("@/services/participant/rituals");
const { clampTimelineLimit } = require("@/services/participant/timeline");
const {
  resolveSubmissionReadScope,
  resolveSubmissionWriteScope,
  isProgramViewOnly,
} = require("@/services/participant/submissions");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("follow-ups", () => {
  it("derives the duration from the event window, defaulting to 30", () => {
    const [withWindow, withoutWindow] = mapFollowupEvents([
      { id: 1, title: "A", start_time: "2026-01-01T09:00:00Z", end_time: "2026-01-01T10:00:00Z" },
      { id: 2, title: "B", start_time: "2026-01-02T09:00:00Z" },
    ]);

    expect(withWindow).toEqual(expect.objectContaining({ id: "evt-1", duration_minutes: 60, status: "scheduled" }));
    expect(withoutWindow.duration_minutes).toBe(30);
  });

  it("defaults the table row title, duration and status", () => {
    const [row] = mapFollowupRows([{ fu_id: 5, scheduled_at: "2026-01-01" }]);
    expect(row).toEqual({
      id: "fu-5",
      program_name: undefined,
      title: "Follow-up meeting",
      description: undefined,
      scheduled_at: "2026-01-01",
      duration_minutes: 30,
      meeting_link: undefined,
      status: "scheduled",
    });
  });

  it("merges both sources, most recent first", () => {
    const merged = mergeFollowups(
      [{ id: "evt-1", scheduled_at: "2026-01-01" }],
      [{ id: "fu-1", scheduled_at: "2026-03-01" }],
    );
    expect(merged.map((row) => row.id)).toEqual(["fu-1", "evt-1"]);
  });

  it("keeps the events when the follow-up table read fails (fail-open)", async () => {
    portal.getFollowupEventsByParticipant.mockResolvedValue({
      rows: [{ id: 1, title: "A", start_time: "2026-01-01T09:00:00Z" }],
    });
    portal.getFollowupTableRowsByParticipant.mockRejectedValue(new Error("no table"));

    const followups = await buildParticipantFollowups("c1");
    expect(followups).toHaveLength(1);
    expect(followups[0].id).toBe("evt-1");
  });
});

describe("full state", () => {
  it("lets internal roles read anyone, and everyone else only their own email", () => {
    expect(canReadFullState({ role: "super_admin", sessionEmail: "a@x", email: "b@x" })).toBe(true);
    expect(canReadFullState({ role: "staff", sessionEmail: "a@x", email: "b@x" })).toBe(true);
    expect(canReadFullState({ role: "participant", sessionEmail: "a@x", email: " A@X " })).toBe(true);
    expect(canReadFullState({ role: "participant", sessionEmail: "a@x", email: "b@x" })).toBe(false);
  });

  it("resolves the participant id, falling back to the email", () => {
    expect(resolveFullStateCid([{ cid: "c9" }], "e@x")).toBe("c9");
    expect(resolveFullStateCid([], "e@x")).toBe("e@x");
  });

  it("aggregates the grades from the scores", () => {
    expect(
      aggregateGrades([{ score: 10 }, { grade: "5" }, { score: null }]),
    ).toEqual({ individualScore: 15, groupScore: 0, finalGrade: 15 });
  });

  it("assembles the state bundle", async () => {
    portal.getFullStateContactCidByEmail.mockResolvedValue({ rows: [{ cid: "c1" }] });
    portal.getFullStateProgramByName.mockResolvedValue({ rows: [{ id: "p1" }] });
    portal.getFullStateSubmissionsByParticipant.mockResolvedValue({ rows: [{ score: 7 }] });
    portal.getFullStateSessionsByProgram.mockResolvedValue({ rows: [] });
    portal.getFullStateNotificationsByRecipient.mockResolvedValue({ rows: [] });
    portal.getFullStateKpisByProgram.mockResolvedValue({ rows: [] });
    portal.getFullStateDocumentsByProgram.mockResolvedValue({ rows: [] });
    portal.getFullStateFollowupsByProgram.mockResolvedValue({ rows: [] });
    portal.getFullStateTeamByGroupName.mockResolvedValue({ rows: [{ id: "t1" }] });
    portal.getFullStateFamilyByName.mockResolvedValue({ rows: [] });

    const state = await buildParticipantFullState({ email: "e@x", groupName: "G" });

    expect(state.program).toEqual({ id: "p1" });
    expect(state.team).toEqual({ id: "t1" });
    expect(state.grades).toEqual({ individualScore: 7, groupScore: 0, finalGrade: 7 });
  });
});

describe("rituals", () => {
  it("assembles the reflection content from the optional fields", () => {
    expect(
      buildReflectionContent({ learnings: "a", challenges: "b", suggestions: "c" }),
    ).toBe("Learnings: a\nChallenges: b\nSuggestions: c");
    expect(buildReflectionContent({ learnings: "a" })).toBe("Learnings: a");
    expect(buildReflectionContent({})).toBe("");
  });

  it("reads the year from the given date", () => {
    expect(currentYear(new Date("2030-05-01T00:00:00Z"))).toBe(2030);
  });

  it("records a check-in with the default status and notes", async () => {
    await recordCheckin({ cid: "c1", programId: "p1" });
    expect(portal.createCheckin).toHaveBeenCalledWith("c1", "p1", "checked_in", "");
  });

  it("records a reflection with the assembled content and the defaults", async () => {
    await recordReflection({ cid: "c1", userName: "N", learnings: "a" });
    expect(portal.createReflection).toHaveBeenCalledWith(
      "c1",
      "N",
      "Learnings: a",
      1,
      expect.any(Number),
    );
  });
});

describe("submission scope", () => {
  it("lets an internal role read anything", () => {
    expect(
      resolveSubmissionReadScope({ role: "facilitator", sessionCid: "c1", participantId: "c2", teamId: null }),
    ).toEqual({ participantId: "c2", teamId: null });
  });

  it("keeps a participant on their own submissions and defaults to self", () => {
    expect(
      resolveSubmissionReadScope({ role: "participant", sessionCid: "c1", participantId: null, teamId: null }),
    ).toEqual({ participantId: "c1", teamId: null });
    expect(
      resolveSubmissionReadScope({ role: "participant", sessionCid: "c1", participantId: "c2", teamId: null }),
    ).toEqual({ error: "You can only access your own submissions.", status: 403 });
    expect(
      resolveSubmissionReadScope({ role: "participant", sessionCid: "c1", participantId: null, teamId: "t1" }),
    ).toEqual({ error: "You cannot access team submissions.", status: 403 });
  });

  it("flags a non-privileged writer for the view-only gate", () => {
    expect(
      resolveSubmissionWriteScope({ role: "participant", sessionCid: "c1", participantId: null, teamId: null }),
    ).toEqual({ participantId: "c1", teamId: null, privileged: false });
    expect(
      resolveSubmissionWriteScope({ role: "staff", sessionCid: "c1", participantId: "c2", teamId: null }),
    ).toEqual({ participantId: "c2", teamId: null, privileged: true });
  });

  it("blocks a non-privileged writer on a completed program, and fails open", async () => {
    portal.getSubmissionProgramCompletionStatus.mockResolvedValue({ rows: [{ status: "completed" }] });
    expect(await isProgramViewOnly({ role: "participant", sessionCid: "c1", programId: "p1" })).toBe(true);
    expect(await isProgramViewOnly({ role: "staff", sessionCid: "c1", programId: "p1" })).toBe(false);

    portal.getSubmissionProgramCompletionStatus.mockRejectedValue(new Error("boom"));
    expect(await isProgramViewOnly({ role: "participant", sessionCid: "c1", programId: "p1" })).toBe(false);
  });
});

describe("clip the timeline page size", () => {
  it("defaults to 100, caps at 200, ignores nonsense", () => {
    expect(clampTimelineLimit(null)).toBe(100);
    expect(clampTimelineLimit("50")).toBe(50);
    expect(clampTimelineLimit("500")).toBe(200);
    expect(clampTimelineLimit("abc")).toBe(100);
    expect(clampTimelineLimit("0")).toBe(100);
  });
});
