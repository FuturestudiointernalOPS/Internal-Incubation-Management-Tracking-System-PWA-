/**
 * Participant home — the DECISIONS.
 *
 * These used to sit inline in `src/app/api/participant/home/route.js`. They now
 * live in `src/services/participant/home.js`. This suite pins the observable
 * behaviour: the unlock/week rules, the four rates, the overdue / due-soon /
 * upcoming classification, and the calendar assembly.
 */

jest.mock("@/models/participant-membership", () => ({
  getParticipantProgramIds: jest.fn(),
}));

jest.mock("@/models/participantPortal", () => ({
  getHomeProgramById: jest.fn(),
  getHomeSessionsByProgramId: jest.fn(),
  getHomeDeliverablesByProgramId: jest.fn(),
  getHomeSubmissionsByParticipantProgram: jest.fn(),
  getHomeAttendanceByProgram: jest.fn(),
  getHomeKpisByProgramId: jest.fn(),
  countHomeAttendanceByProgramId: jest.fn(),
  getHomeNotifications: jest.fn(),
  getHomeEventsByProgramIds: jest.fn(),
}));

jest.mock("@/services/workspace/calendar", () => ({
  getCalendarVentureSessions: jest.fn(),
}));

const membership = require("@/models/participant-membership");
const portal = require("@/models/participantPortal");
const workspaceCalendar = require("@/services/workspace/calendar");
const {
  isUnlockedSession,
  resolveDeliverableWeek,
  computeProgramMetrics,
  buildActionCenter,
  buildCalendarEvents,
  buildParticipantHome,
} = require("@/services/participant/home");

const DAY = new Date("2026-06-10T00:00:00");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("isUnlockedSession", () => {
  it("unlocks an active / in-progress / completed session", () => {
    expect(isUnlockedSession({ status: "active" }, DAY)).toBe(true);
    expect(isUnlockedSession({ status: "In Progress" }, DAY)).toBe(true);
    expect(isUnlockedSession({ status: "completed" }, DAY)).toBe(true);
  });

  it("unlocks a session with no date, or one whose date has passed", () => {
    expect(isUnlockedSession({ status: "upcoming" }, DAY)).toBe(true);
    expect(
      isUnlockedSession({ status: "upcoming", scheduled_date: "2026-06-01" }, DAY),
    ).toBe(true);
    expect(
      isUnlockedSession({ status: "upcoming", scheduled_date: "2026-07-01" }, DAY),
    ).toBe(false);
  });
});

describe("resolveDeliverableWeek", () => {
  it("prefers the linked session's week, then its own, then 1", () => {
    const sessions = [{ id: 7, week_number: 3 }];
    expect(resolveDeliverableWeek({ id: "d", session_id: 7 }, sessions)).toBe(3);
    expect(resolveDeliverableWeek({ id: "d", session_id: 99, week_number: 5 }, sessions)).toBe(5);
    expect(resolveDeliverableWeek({ id: "d" }, sessions)).toBe(1);
  });
});

describe("computeProgramMetrics", () => {
  it("completes a program from its approved, non-attendance deliverables", () => {
    const { currentWeek, metrics } = computeProgramMetrics({
      sessions: [{ id: 1, status: "active", week_number: 2 }],
      deliverables: [
        { id: "d1", title: "Essay", session_id: 1 },
        { id: "d2", title: "Attendance week 2" },
      ],
      submissions: [{ deliverable_id: "d1", status: "approved" }],
      attendance: [],
      kpis: [],
      attendanceTracked: false,
      today: DAY,
    });

    expect(currentWeek).toBe(2);
    expect(metrics).toEqual({
      percentComplete: 100,
      programCompletion: 100,
      attendanceRate: 0,
      assignmentCompletion: 100,
      kpiCompletion: 0,
    });
  });

  it("falls back to the submission rate when no deliverable is tracked", () => {
    const { currentWeek, metrics } = computeProgramMetrics({
      sessions: [],
      deliverables: [{ id: "d1", title: "X", week_number: 5 }],
      submissions: [{ deliverable_id: "d1", status: "approved" }],
      attendance: [],
      kpis: [],
      attendanceTracked: false,
      today: DAY,
    });

    expect(currentWeek).toBe(1);
    expect(metrics.programCompletion).toBe(100);
    expect(metrics.assignmentCompletion).toBe(100);
  });

  it("never lets duplicate attendance rows push the rate above 100%", () => {
    const { metrics } = computeProgramMetrics({
      sessions: [
        { id: "s1", status: "completed", week_number: 1 },
        { id: "s2", status: "completed", week_number: 2 },
      ],
      deliverables: [],
      submissions: [],
      attendance: [
        { status: "present", session_id: "s1", date: "2026-01-01" },
        { status: "present", session_id: "s1", date: "2026-01-02" },
      ],
      kpis: [],
      attendanceTracked: true,
      today: DAY,
    });

    // One distinct present session out of two expected.
    expect(metrics.attendanceRate).toBe(50);
    // Attendance joins the KPI factors: both marked days were present.
    expect(metrics.kpiCompletion).toBe(100);
  });
});

describe("buildActionCenter", () => {
  it("splits overdue, due-soon and upcoming, skipping attendance tasks", () => {
    const programsData = [
      {
        id: "p1",
        name: "Alpha",
        sessions: [
          { id: "se1", start_at: "2026-07-01", title: "Later" },
          { id: "se2", scheduled_date: "2026-06-01", title: "Past" },
        ],
        deliverables: [
          { id: "d1", title: "Late", due_date: "2026-06-01" },
          { id: "d2", title: "Soon", due_date: "2026-06-12" },
          { id: "d3", title: "Attendance", due_date: "2026-06-01" },
        ],
        submissions: [
          { id: "s1", status: "pending", document_id: "d9", program_id: "p1", created_at: "x" },
        ],
      },
    ];

    const center = buildActionCenter(programsData, DAY);

    expect(center.overdue).toHaveLength(1);
    expect(center.overdue[0]).toEqual(expect.objectContaining({ id: "d1", daysOverdue: 9 }));
    expect(center.dueSoon).toHaveLength(1);
    expect(center.dueSoon[0]).toEqual(expect.objectContaining({ id: "d2", daysLeft: 2 }));
    expect(center.pendingSubmissions).toHaveLength(1);
    expect(center.upcomingSessions.map((session) => session.id)).toEqual(["se1"]);
  });
});

describe("buildCalendarEvents", () => {
  it("merges sessions, deadlines, events and venture sessions, sorted by date", () => {
    const events = buildCalendarEvents({
      programsData: [
        {
          id: "p1",
          name: "Alpha",
          sessions: [{ id: 1, title: "S", start_at: "2026-01-05T09:00:00.000Z", start_time: "09:00" }],
          deliverables: [{ id: "d1", title: "Essay", due_date: "2026-01-06T00:00:00.000Z" }],
          submissions: [],
        },
      ],
      events: [{ id: 9, title: "Review", start_time: "2026-01-07T10:00:00.000Z", program_id: "p1" }],
      ventureSessions: [
        { id: 5, title: "Coaching", start_time: "2026-01-08T10:00:00.000Z", coach_name: "Dr X" },
      ],
    });

    expect(events.map((event) => event.id)).toEqual([
      "session-1",
      "deliverable-d1",
      "event-9",
      "vsess-5",
    ]);
    expect(events[0]).toEqual(expect.objectContaining({ type: "session", date: "2026-01-05" }));
    expect(events[1]).toEqual(expect.objectContaining({ type: "deadline" }));
    expect(events[3]).toEqual(expect.objectContaining({ type: "venture_session", description: "Coach: Dr X" }));
  });

  it("marks a deliverable with a submission as submitted", () => {
    const events = buildCalendarEvents({
      programsData: [
        {
          id: "p1",
          name: "Alpha",
          sessions: [],
          deliverables: [{ id: "d1", title: "Essay", due_date: "2026-01-06T00:00:00.000Z" }],
          submissions: [{ document_id: "d1", status: "approved" }],
        },
      ],
    });

    expect(events[0]).toEqual(
      expect.objectContaining({ type: "submission", title: "Essay (submitted)" }),
    );
  });
});

describe("buildParticipantHome", () => {
  it("assembles the programs, the action centre and the announcements", async () => {
    membership.getParticipantProgramIds.mockResolvedValue(["p1"]);
    portal.getHomeProgramById.mockResolvedValue({
      rows: [
        {
          id: "p1",
          name: "Alpha",
          status: "active",
          start_date: "2026-01-01",
          end_date: "2026-12-31",
          duration_weeks: 8,
        },
      ],
    });
    portal.getHomeSessionsByProgramId.mockResolvedValue({
      rows: [{ id: 1, status: "active", week_number: 1, start_at: "2099-01-01", title: "S1" }],
    });
    portal.getHomeDeliverablesByProgramId.mockResolvedValue({
      rows: [{ id: "d1", title: "Essay", session_id: 1, kpi_ids: "[]", due_date: "2099-02-01" }],
    });
    portal.getHomeSubmissionsByParticipantProgram.mockResolvedValue({
      rows: [{ deliverable_id: "d1", document_id: "d1", status: "approved" }],
    });
    portal.getHomeAttendanceByProgram.mockResolvedValue({ rows: [] });
    portal.getHomeKpisByProgramId.mockResolvedValue({ rows: [] });
    portal.countHomeAttendanceByProgramId.mockResolvedValue({ rows: [{ total: 0 }] });
    portal.getHomeNotifications.mockResolvedValue({
      rows: [{ id: 1, title: "Hi", message: "m", type: null, is_read: false, created_at: "c" }],
    });
    portal.getHomeEventsByProgramIds.mockResolvedValue({ rows: [] });
    workspaceCalendar.getCalendarVentureSessions.mockResolvedValue({ rows: [] });

    const home = await buildParticipantHome({
      cid: "c1",
      email: "e@x",
      contact: { group_name: "Cohort 1" },
    });

    expect(home.programsData).toHaveLength(1);
    expect(home.programsData[0].metrics.programCompletion).toBe(100);
    expect(home.primaryProgram.id).toBe("p1");
    expect(home.actionCenter.upcomingSessions).toHaveLength(1);
    expect(home.announcements).toEqual([
      { id: 1, title: "Hi", message: "m", type: "announcement", isRead: false, createdAt: "c" },
    ]);
  });
});
