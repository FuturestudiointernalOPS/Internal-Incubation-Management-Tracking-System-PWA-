/**
 * Participant progress — the DECISIONS.
 *
 * These used to sit inline in `src/app/api/participant/progress/route.js`. They
 * now live in `src/services/participant/progress.js`. This suite pins the
 * observable behaviour: the per-program metrics, the milestone timeline, the
 * per-week history, and the overall aggregation.
 */

jest.mock("@/models/participant-membership", () => ({
  getParticipantProgramIds: jest.fn(),
}));

jest.mock("@/models/participantPortal", () => ({
  getProgressProgramById: jest.fn(),
  getProgressSessionsByProgramId: jest.fn(),
  getProgressDeliverablesByProgramId: jest.fn(),
  getProgressSubmissionsByProgram: jest.fn(),
  getProgressAttendanceByProgram: jest.fn(),
  getProgressKpisByProgramId: jest.fn(),
  getProgressStandupsByUser: jest.fn(),
  getProgressCheckinsByParticipantProgram: jest.fn(),
  getProgressRetrosByUser: jest.fn(),
  getProgressReflectionsByUser: jest.fn(),
  countProgressAttendanceByProgramId: jest.fn(),
}));

jest.mock("@/services/workspace/calendar", () => ({
  getCalendarVentureSessions: jest.fn(),
}));

const membership = require("@/models/participant-membership");
const portal = require("@/models/participantPortal");
const {
  computeProgramProgress,
  summarizeProgress,
  buildParticipantProgress,
} = require("@/services/participant/progress");

const DAY = new Date("2026-06-10T00:00:00");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("computeProgramProgress", () => {
  function run(overrides = {}) {
    return computeProgramProgress({
      program: { duration_weeks: 4 },
      sessions: [
        { id: "s1", status: "completed", week_number: 1, title: "Kickoff" },
        { id: "s2", status: "completed", week_number: 2, title: "Deep dive" },
      ],
      deliverables: [
        { id: "d1", title: "Essay", week_number: 1 },
        { id: "d2", title: "Attendance", week_number: 1 },
      ],
      submissions: [{ document_id: "d1", status: "approved", created_at: "c", score: 8 }],
      attendance: [{ status: "present", session_id: "s1", date: "2026-01-01" }],
      kpis: [],
      standups: [{ week_number: 1 }],
      checkins: [{ week_number: 2 }],
      retros: [],
      reflections: [],
      attendanceTracked: true,
      today: DAY,
      ...overrides,
    });
  }

  it("computes the five rates", () => {
    const { currentWeek, metrics } = run();

    expect(currentWeek).toBe(2);
    expect(metrics).toEqual({
      programCompletion: 100, // d1 approved, the attendance task excluded
      attendanceRate: 50, // 1 of 2 unlocked sessions marked present
      assignmentCompletion: 100,
      kpiCompletion: 100, // attendance joins as a factor (marked days all present)
      ritualParticipation: 50, // 2 weeks with a ritual over 4
    });
  });

  it("builds the stats and the overall contribution", () => {
    const { stats, contribution } = run();

    expect(stats).toEqual({
      totalDeliverables: 1,
      completedDeliverables: 1,
      totalSessions: 2,
      attendedSessions: 1,
      totalSubmissions: 1,
      approvedSubmissions: 1,
      totalKpis: 0,
      targetMetKpis: 0,
      standups: 1,
      checkins: 1,
      retros: 0,
      reflections: 0,
    });
    expect(contribution).toEqual(expect.objectContaining({ kpiPoints: 100, kpiMax: 100 }));
  });

  it("orders the milestones achieved-first, then by week, skipping attendance tasks", () => {
    const { milestones } = run();

    expect(milestones.map((milestone) => milestone.id)).toEqual([
      "session-s1", // achieved, week 1
      "deliverable-d1", // achieved, week 0
      "session-s2", // not achieved, week 2
    ]);
  });

  it("builds the per-week history", () => {
    const { history } = run();

    expect(history).toEqual([
      {
        week: 1,
        deliverablesCompleted: 1,
        deliverablesTotal: 1,
        sessionsAttended: 1,
        sessionsTotal: 1,
        hasRitual: true,
      },
      {
        week: 2,
        deliverablesCompleted: 0,
        deliverablesTotal: 0,
        sessionsAttended: 0,
        sessionsTotal: 1,
        hasRitual: true,
      },
    ]);
  });
});

describe("summarizeProgress", () => {
  it("aggregates the contributions into the overall figures and totals", () => {
    const programs = [{ metrics: { ritualParticipation: 50 } }];
    const contributions = [
      {
        totalDeliverables: 1,
        completedDeliverables: 1,
        totalSessions: 2,
        attendedSessions: 1,
        totalSubmissions: 1,
        approvedSubmissions: 1,
        kpiPoints: 100,
        kpiMax: 100,
        standups: 1,
        checkins: 1,
        retros: 0,
        reflections: 0,
      },
    ];

    const { overall, totals } = summarizeProgress(programs, contributions);

    expect(overall).toEqual({
      programCompletion: 100,
      attendanceRate: 50,
      assignmentCompletion: 100,
      kpiCompletion: 100,
      ritualParticipation: 50,
    });
    expect(totals).toEqual({
      submissions: 1,
      approved: 1,
      sessions: 2,
      attended: 1,
      deliverables: 1,
      completedDeliverables: 1,
      rituals: 2,
      programs: 1,
    });
  });
});

describe("buildParticipantProgress", () => {
  it("reads the programs and returns the report", async () => {
    membership.getParticipantProgramIds.mockResolvedValue(["p1"]);
    portal.getProgressProgramById.mockResolvedValue({
      rows: [{ id: "p1", name: "Alpha", duration_weeks: 4 }],
    });
    portal.getProgressSessionsByProgramId.mockResolvedValue({
      rows: [{ id: "s1", status: "completed", week_number: 1, title: "Kickoff" }],
    });
    portal.getProgressDeliverablesByProgramId.mockResolvedValue({
      rows: [{ id: "d1", title: "Essay", week_number: 1 }],
    });
    portal.getProgressSubmissionsByProgram.mockResolvedValue({
      rows: [{ document_id: "d1", status: "approved" }],
    });
    portal.getProgressAttendanceByProgram.mockResolvedValue({ rows: [] });
    portal.getProgressKpisByProgramId.mockResolvedValue({ rows: [] });
    portal.getProgressStandupsByUser.mockResolvedValue({ rows: [] });
    portal.getProgressCheckinsByParticipantProgram.mockResolvedValue({ rows: [] });
    portal.getProgressRetrosByUser.mockResolvedValue({ rows: [] });
    portal.getProgressReflectionsByUser.mockResolvedValue({ rows: [] });
    portal.countProgressAttendanceByProgramId.mockResolvedValue({ rows: [{ total: 0 }] });

    const report = await buildParticipantProgress({
      cid: "c1",
      email: "e@x",
      contact: { group_name: "Cohort 1" },
    });

    expect(report.programs).toHaveLength(1);
    expect(report.programs[0].metrics.programCompletion).toBe(100);
    expect(report.overall.programCompletion).toBe(100);
    expect(report.totals.programs).toBe(1);
  });
});
