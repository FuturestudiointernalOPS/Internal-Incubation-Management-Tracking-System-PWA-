/**
 * THE ONE MEMBER DASHBOARD — the gate that matters.
 *
 * The rule this suite locks: a section exists only when the person really holds
 * the relationship behind it, and the gating happens in the RESPONSE, not in the
 * screen. A member with no program seat must receive NO program block at all —
 * not an empty one — so no program figure can leak through a rendering mistake.
 */

const { buildMemberDashboard } = require("@/services/member/dashboard");
const { resolveParticipantParticipation } = require("@/services/participant/participation");
const { buildParticipantHome } = require("@/services/participant/home");
const { buildParticipantProgress } = require("@/services/participant/progress");
const { learnerHasEnrollments, getLearnerCourses } = require("@/services/lms/learning");
const { buildInvestorDashboardSummary } = require("@/services/investor/dashboard");
const { getVentureMembershipsForContact } = require("@/models/contacts/programMembership");
const { getApprovedInvestorProfileIdByUserId } = require("@/models/investor");
const { listFacilitatedPrograms, listUpcomingSessionsForPrograms } = require("@/models/memberDashboard");

jest.mock("@/services/participant/participation", () => ({ resolveParticipantParticipation: jest.fn() }));
jest.mock("@/services/participant/home", () => ({ buildParticipantHome: jest.fn() }));
jest.mock("@/services/participant/progress", () => ({ buildParticipantProgress: jest.fn() }));
jest.mock("@/services/lms/learning", () => ({
  learnerHasEnrollments: jest.fn(),
  getLearnerCourses: jest.fn(),
}));
jest.mock("@/services/investor/dashboard", () => ({ buildInvestorDashboardSummary: jest.fn() }));
jest.mock("@/models/contacts/programMembership", () => ({ getVentureMembershipsForContact: jest.fn() }));
jest.mock("@/models/investor", () => ({ getApprovedInvestorProfileIdByUserId: jest.fn() }));
jest.mock("@/models/memberDashboard", () => ({
  listFacilitatedPrograms: jest.fn(),
  listUpcomingSessionsForPrograms: jest.fn(),
}));

const SESSION = { cid: "C1", email: "amina@example.com", role: "member", name: "Amina Koné" };
const CONTACT = { cid: "C1", name: "Amina Koné", email: "amina@example.com", group_name: "Cohort 1" };

const HOME = {
  primaryProgram: {
    id: "P1",
    name: "Come UP",
    status: "Active",
    currentWeek: 2,
    durationWeeks: 12,
  },
  programsData: [{ id: "P1" }],
  actionCenter: { overdue: [], dueSoon: [], pendingSubmissions: [], upcomingSessions: [] },
  calendarEvents: [{ id: "s1", title: "Session", date: "2026-11-20", type: "session", programId: "P1" }],
  announcements: [{ id: 1, title: "Hello", message: "World" }],
};

const PROGRESS = {
  overall: { programCompletion: 60, attendanceRate: 75, assignmentCompletion: 100, kpiCompletion: 80 },
  totals: { submissions: 4, approved: 4, sessions: 4, attended: 3, deliverables: 5, completedDeliverables: 3 },
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: a person with no relationship at all.
  resolveParticipantParticipation.mockResolvedValue({ memberships: [], isProgramParticipant: false });
  getVentureMembershipsForContact.mockResolvedValue({ rows: [] });
  getApprovedInvestorProfileIdByUserId.mockResolvedValue({ rows: [] });
  learnerHasEnrollments.mockResolvedValue(false);
  listFacilitatedPrograms.mockResolvedValue({ rows: [] });
  listUpcomingSessionsForPrograms.mockResolvedValue({ rows: [] });
  buildParticipantHome.mockResolvedValue(HOME);
  buildParticipantProgress.mockResolvedValue(PROGRESS);
  getLearnerCourses.mockResolvedValue([]);
  buildInvestorDashboardSummary.mockResolvedValue(null);
});

describe("a member with no relationship", () => {
  test("receives no program, facilitation, venture, learning or investor block", async () => {
    const dashboard = await buildMemberDashboard({ session: SESSION, contact: CONTACT });

    expect(dashboard.programs).toBeNull();
    expect(dashboard.facilitator).toBeNull();
    expect(dashboard.ventures).toBeNull();
    expect(dashboard.learning).toBeNull();
    expect(dashboard.investor).toBeNull();
    expect(dashboard.profiles).toEqual({
      isProgramParticipant: false,
      isFacilitator: false,
      isVentureMember: false,
      isFounder: false,
      isLearner: false,
      isInvestor: false,
    });
  });

  test("no program data is even READ for them", async () => {
    await buildMemberDashboard({ session: SESSION, contact: CONTACT });

    expect(buildParticipantProgress).not.toHaveBeenCalled();
    expect(getLearnerCourses).not.toHaveBeenCalled();
    expect(buildInvestorDashboardSummary).not.toHaveBeenCalled();
    expect(listUpcomingSessionsForPrograms).not.toHaveBeenCalled();
  });

  test("their personal announcements and agenda are still theirs", async () => {
    const dashboard = await buildMemberDashboard({ session: SESSION, contact: CONTACT });
    expect(dashboard.announcements).toHaveLength(1);
    expect(dashboard.agenda).toHaveLength(1);
  });
});

describe("each relationship opens exactly its own block", () => {
  test("a program seat opens the program block and reads the cross-program report", async () => {
    resolveParticipantParticipation.mockResolvedValue({
      memberships: [{ program_id: "P1", program_name: "Come UP", status: "active" }],
      isProgramParticipant: true,
    });

    const dashboard = await buildMemberDashboard({ session: SESSION, contact: CONTACT });

    expect(dashboard.programs).not.toBeNull();
    expect(dashboard.programs.seats).toEqual([
      { id: "P1", name: "Come UP", status: "active", completed: false, readOnly: false },
    ]);
    expect(dashboard.programs.primary.name).toBe("Come UP");
    expect(dashboard.programs.progress.overall.programCompletion).toBe(60);
    expect(buildParticipantProgress).toHaveBeenCalledTimes(1);
    expect(dashboard.facilitator).toBeNull();
  });

  test("a facilitation assignment opens the facilitation block, with its own sessions", async () => {
    listFacilitatedPrograms.mockResolvedValue({
      rows: [{ id: "P2", name: "Alpha", status: "Active" }],
    });
    listUpcomingSessionsForPrograms.mockResolvedValue({
      rows: [{ id: "S9", title: "Workshop", date: "2026-12-01", start_time: "09:00", program_id: "P2", program_name: "Alpha" }],
    });

    const dashboard = await buildMemberDashboard({ session: SESSION, contact: CONTACT });

    expect(dashboard.facilitator.programs).toEqual([{ id: "P2", name: "Alpha", status: "Active" }]);
    expect(dashboard.facilitator.upcoming[0].title).toBe("Workshop");
    // The sessions are asked for the programs the assignment resolved.
    expect(listUpcomingSessionsForPrograms).toHaveBeenCalledWith(["P2"]);
    expect(dashboard.programs).toBeNull();
  });

  test("a venture membership opens the venture block; founding adds the founder flag", async () => {
    getVentureMembershipsForContact.mockResolvedValue({
      rows: [
        { venture_id: "V1", name: "Acme", status: "active", member_type: "founder", is_owner: true },
      ],
    });

    const dashboard = await buildMemberDashboard({ session: SESSION, contact: CONTACT });

    expect(dashboard.ventures.isFounder).toBe(true);
    expect(dashboard.ventures.items[0]).toEqual({
      id: "V1",
      name: "Acme",
      status: "active",
      memberType: "founder",
      isOwner: true,
    });
    expect(dashboard.programs).toBeNull();
  });

  test("a live enrolment opens the learning block", async () => {
    learnerHasEnrollments.mockResolvedValue(true);
    getLearnerCourses.mockResolvedValue([
      {
        course: { id: "L1", title: "Impact 101" },
        progress: { completedLessons: 2, totalLessons: 4, percent: 50 },
        continueLesson: { id: "lesson-3" },
        certificate: null,
      },
    ]);

    const dashboard = await buildMemberDashboard({ session: SESSION, contact: CONTACT });

    expect(dashboard.learning.courses[0]).toEqual({
      id: "L1",
      title: "Impact 101",
      completedLessons: 2,
      totalLessons: 4,
      percent: 50,
      complete: false,
      continueLessonId: "lesson-3",
      certificateIssued: false,
    });
    expect(dashboard.investor).toBeNull();
  });

  test("an approved investor profile opens the investor block", async () => {
    getApprovedInvestorProfileIdByUserId.mockResolvedValue({ rows: [{ id: 7 }] });
    buildInvestorDashboardSummary.mockResolvedValue({
      profile: { name: "Amina", organization: "Fund", visibility_mode: "deal_flow_only" },
      stats: { total_pipeline: 3, watchlist_count: 2, invested_count: 1 },
      recommendations: [{ id: "V1", name: "Acme" }],
    });

    const dashboard = await buildMemberDashboard({ session: SESSION, contact: CONTACT });

    expect(dashboard.profiles.isInvestor).toBe(true);
    expect(dashboard.investor.stats.total_pipeline).toBe(3);
    expect(dashboard.investor.recommendations).toHaveLength(1);
    expect(dashboard.programs).toBeNull();
  });
});

describe("one broken source never blanks the page", () => {
  test("a failing block read answers empty while the rest still renders", async () => {
    resolveParticipantParticipation.mockResolvedValue({
      memberships: [{ program_id: "P1", program_name: "Come UP", status: "active" }],
      isProgramParticipant: true,
    });
    buildParticipantProgress.mockRejectedValue(new Error("progress down"));

    const dashboard = await buildMemberDashboard({ session: SESSION, contact: CONTACT });

    expect(dashboard.programs).not.toBeNull();
    expect(dashboard.programs.progress).toBeNull();
    expect(dashboard.agenda).toHaveLength(1);
  });
});
