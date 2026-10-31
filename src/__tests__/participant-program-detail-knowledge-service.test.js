jest.mock("@/models/programMembership", () => ({
  getKnowledgeBankAttachmentsByNoteIds: jest.fn(async () => ({
    rows: [{ note_id: 7, name: "Guide", url: "/guide.pdf" }],
  })),
  getParticipantKnowledgeBankItemById: jest.fn(async () => ({
    rows: [
      {
        id: 7,
        title: "Programme guide",
        description: "Only this programme's resource",
        created_at: "2026-10-29T00:00:00.000Z",
      },
    ],
  })),
  getParticipantProgramDetailAttendance: jest.fn(async () => ({ rows: [] })),
  getParticipantProgramDetailById: jest.fn(async () => ({
    rows: [{ id: "P1", note_id: "7", assigned_pm_id: null }],
  })),
  getParticipantProgramDetailDeliverables: jest.fn(async () => ({ rows: [] })),
  getParticipantProgramDetailKpis: jest.fn(async () => ({ rows: [] })),
  getParticipantProgramDetailPmName: jest.fn(async () => ({ rows: [] })),
  getParticipantProgramDetailSessions: jest.fn(async () => ({ rows: [] })),
  getParticipantProgramDetailStaff: jest.fn(async () => ({ rows: [] })),
  getParticipantProgramDetailSubmissions: jest.fn(async () => ({ rows: [] })),
  getParticipantProgramEnrollmentByCid: jest.fn(async () => ({
    rows: [{ program_id: "P1" }],
  })),
  getParticipantProgramFollowups: jest.fn(async () => ({ rows: [] })),
  getProgramDetailAttendanceCount: jest.fn(async () => ({ rows: [{ total: 0 }] })),
}));

jest.mock("@/models/participant-membership", () => ({
  isParticipantInProgram: jest.fn(async () => true),
}));

jest.mock("@/models/lms/programRequirements", () => ({
  getProgramLearningForParticipant: jest.fn(async () => []),
}));

const {
  getKnowledgeBankAttachmentsByNoteIds,
  getParticipantKnowledgeBankItemById,
  getParticipantProgramDetailById,
} = require("@/models/programMembership");
const { getParticipantProgramDetailService } = require("@/services/programs/participant");

describe("participant program detail knowledge resources", () => {
  beforeEach(() => jest.clearAllMocks());

  test("uses only the note linked to the assigned programme and its attachments", async () => {
    const result = await getParticipantProgramDetailService({
      cid: "C1",
      email: "participant@example.test",
      programId: "P1",
    });

    expect(result.status).toBe(200);
    expect(getParticipantKnowledgeBankItemById).toHaveBeenCalledWith("7");
    expect(getKnowledgeBankAttachmentsByNoteIds).toHaveBeenCalledWith([7]);
    const resources = Object.values(result.body.resources.byWeek).flat();
    expect(result.body.resources.total).toBe(1);
    expect(resources).toMatchObject([
      {
        id: 7,
        title: "Programme guide",
        url: "/guide.pdf",
        attachments: [{ name: "Guide", url: "/guide.pdf" }],
      },
    ]);
  });

  test("returns no Knowledge Bank resources when the programme has no linked note", async () => {
    getParticipantProgramDetailById.mockResolvedValueOnce({
      rows: [{ id: "P1", note_id: null, assigned_pm_id: null }],
    });

    const result = await getParticipantProgramDetailService({
      cid: "C1",
      email: "participant@example.test",
      programId: "P1",
    });

    expect(result.status).toBe(200);
    expect(result.body.resources.total).toBe(0);
    expect(getParticipantKnowledgeBankItemById).not.toHaveBeenCalled();
    expect(getKnowledgeBankAttachmentsByNoteIds).not.toHaveBeenCalled();
  });
});
