import {
  computeProgramProgress,
  toDayString,
  daysBetween,
  addDays,
} from "@/lib/programProgress";

const TODAY = "2025-03-10";
const day = (offsetDays) => addDays(TODAY, offsetDays);

describe("date helpers", () => {
  it("round-trips addDays and daysBetween", () => {
    expect(daysBetween(TODAY, addDays(TODAY, 10))).toBe(10);
    expect(daysBetween(addDays(TODAY, 10), TODAY)).toBe(-10);
    expect(daysBetween(TODAY, TODAY)).toBe(0);
    expect(addDays(TODAY, -3)).toBe("2025-03-07");
  });

  it("reads a date-only string as written", () => {
    expect(toDayString("2025-03-10")).toBe("2025-03-10");
  });

  it("reads a Date in local time so the calendar day survives", () => {
    expect(toDayString(new Date(2025, 2, 10))).toBe("2025-03-10");
    expect(toDayString(new Date(2025, 2, 10, 23, 30))).toBe("2025-03-10");
  });

  it("returns null for nothing and for garbage", () => {
    expect(toDayString(null)).toBeNull();
    expect(toDayString("")).toBeNull();
    expect(toDayString("not a date")).toBeNull();
  });
});

describe("an empty programme", () => {
  it("is not ready and reports the zero session block", () => {
    const result = computeProgramProgress({ today: TODAY });
    expect(result.ready).toBe(false);
    expect(result.headline.percent).toBe(0);
    expect(result.blocks.sessions).toEqual({ done: 0, due: 0, points: 5 });
  });
});

describe("sessions are judged against completed days only", () => {
  const result = computeProgramProgress({
    program: { start_date: day(-14) },
    sessions: [
      { id: "done", scheduled_date: day(-5), status: "completed" },
      { id: "late", scheduled_date: day(-5), status: "scheduled" },
      { id: "today", scheduled_date: day(0), status: "scheduled" },
      { id: "future", scheduled_date: day(5), status: "scheduled" },
    ],
    today: TODAY,
  });

  it("counts a held past session and its unheld counterpart", () => {
    expect(result.blocks.sessions).toEqual({ done: 1, due: 2, points: 5 });
  });

  it("never treats a deadline falling today, or a future one, as late", () => {
    expect(result.late.sessions.map((entry) => entry.id)).toEqual(["late"]);
  });
});

describe("a session without a date falls back to its week", () => {
  const undated = { id: "week1", week_number: 1, status: "scheduled" };

  it("is not due before its week has closed", () => {
    const result = computeProgramProgress({
      program: { start_date: day(-6) },
      sessions: [undated],
      today: TODAY,
    });
    expect(result.blocks.sessions.due).toBe(0);
  });

  it("is due at the close of that week, dated to today", () => {
    const result = computeProgramProgress({
      program: { start_date: day(-7) },
      sessions: [undated],
      today: TODAY,
    });
    expect(result.blocks.sessions.due).toBe(1);
    expect(result.late.sessions[0].dueDay).toBe(TODAY);
  });
});

describe("a dated deliverable is late until completed", () => {
  it("counts only the completed one", () => {
    const result = computeProgramProgress({
      program: { start_date: day(-14) },
      requirements: [
        { id: "open", due_date: day(-5), is_completed: false },
        { id: "closed", due_date: day(-5), is_completed: true },
      ],
      today: TODAY,
    });
    expect(result.blocks.deliverables).toEqual({ done: 1, due: 2, points: 2 });
  });
});

describe("a deliverable inherits its session's date", () => {
  it("uses a past session's date as the deadline", () => {
    const result = computeProgramProgress({
      program: { start_date: day(-14) },
      sessions: [{ id: "s1", scheduled_date: day(-5), status: "completed" }],
      requirements: [{ id: "r1", session_id: "s1", is_completed: false }],
      today: TODAY,
    });
    expect(result.blocks.deliverables.due).toBe(1);
    expect(result.late.deliverables[0].dueDay).toBe(day(-5));
    expect(result.late.deliverables[0].undated).toBe(false);
    expect(result.dataQuality.undatedRequirements).toBe(0);
  });
});

describe("a deliverable tied to a future session", () => {
  it("is not due yet and is not flagged as undated", () => {
    const result = computeProgramProgress({
      program: { start_date: day(-14) },
      sessions: [{ id: "s1", scheduled_date: day(5), status: "scheduled" }],
      requirements: [{ id: "r1", session_id: "s1", is_completed: false }],
      today: TODAY,
    });
    expect(result.blocks.deliverables.due).toBe(0);
    expect(result.dataQuality.undatedRequirements).toBe(0);
  });
});

describe("a deliverable with no deadline in a started programme", () => {
  it("is owed from the start and flagged undated", () => {
    const result = computeProgramProgress({
      program: { start_date: day(-14) },
      requirements: [{ id: "r1", is_completed: false }],
      today: TODAY,
    });
    expect(result.blocks.deliverables.due).toBe(1);
    expect(result.late.deliverables[0].undated).toBe(true);
    expect(result.late.deliverables[0].dueDay).toBe(day(-14));
    expect(result.dataQuality.undatedRequirements).toBe(1);
  });
});

describe("report weeks", () => {
  it("closes whole weeks and leaves the current one open", () => {
    const result = computeProgramProgress({
      program: { start_date: day(-14) },
      reports: [{ week_number: 1 }],
      today: TODAY,
    });
    expect(result.blocks.weeks).toEqual({ done: 1, due: 2, points: 10 });
    expect(result.late.weeks.map((entry) => entry.week)).toEqual([2]);
  });
});

describe("the per-block cap", () => {
  it("never lets a surplus report pay for another block", () => {
    const result = computeProgramProgress({
      program: { start_date: day(-14) },
      reports: [{ week_number: 1 }, { week_number: 2 }, { week_number: 3 }],
      today: TODAY,
    });
    expect(result.blocks.weeks).toEqual({ done: 2, due: 2, points: 10 });
    expect(result.late.weeks).toEqual([]);
  });
});

describe("a participant enrolled after a deadline", () => {
  it("is not expected to have met that deadline", () => {
    const result = computeProgramProgress({
      program: { start_date: day(-14) },
      requirements: [{ id: "r1", due_date: day(-5), is_completed: false }],
      participants: [
        { id: "early", name: "Early", enrolled_at: day(-30) },
        { id: "late", name: "Late", enrolled_at: day(-1) },
      ],
      today: TODAY,
    });
    expect(result.participantWork.expected).toBe(1);
    expect(result.participantWork.people.map((person) => person.id)).toEqual(["early"]);
  });
});

describe("submission states", () => {
  const result = computeProgramProgress({
    program: { start_date: day(-14) },
    requirements: [{ id: "r1", due_date: day(-5), is_completed: false }],
    participants: [
      { id: "p1", name: "P1", enrolled_at: day(-30) },
      { id: "p2", name: "P2", enrolled_at: day(-30) },
      { id: "p3", name: "P3", enrolled_at: day(-30) },
    ],
    submissions: [
      { deliverable_id: "r1", participant_id: "p1", status: "approved" },
      { deliverable_id: "r1", participant_id: "p2", status: "pending" },
      { deliverable_id: "r1", participant_id: "p3", status: "revision_requested" },
    ],
    today: TODAY,
  });

  it("counts an approval as done", () => {
    expect(result.participantWork.approved).toBe(1);
  });

  it("separates awaiting review from sent back", () => {
    expect(result.participantWork.awaiting).toBe(1);
    expect(result.participantWork.returned).toBe(1);
  });

  it("chases only the sent-back participant, not the one awaiting review", () => {
    expect(result.overdue.map((entry) => entry.participantId)).toEqual(["p3"]);
  });
});

describe("hand-computed headline", () => {
  // sessions     1 done ×  5 =  5 of  5
  // deliverables 1 done ×  2 =  2 of  2
  // report weeks 1 done × 10 = 10 of 20
  // submissions  1 done ×  3 =  3 of  3
  // earned 20 of possible 30 → round(66.7) = 67% → 10 points late,
  // all of it in the weeks block.
  const result = computeProgramProgress({
    program: { start_date: day(-14), duration_weeks: 4 },
    sessions: [
      { id: "held", scheduled_date: day(-5), status: "completed" },
      { id: "upcoming", scheduled_date: day(5), status: "scheduled" },
    ],
    requirements: [{ id: "r1", due_date: day(-5), is_completed: true }],
    reports: [{ week_number: 1 }],
    participants: [{ id: "p1", name: "P1", enrolled_at: day(-30) }],
    submissions: [{ deliverable_id: "r1", participant_id: "p1", status: "approved" }],
    today: TODAY,
  });

  it("earns 20 of 30 possible points", () => {
    expect(result.headline.earned).toBe(20);
    expect(result.headline.possible).toBe(30);
  });

  it("rounds the headline to 67% with 10 points late", () => {
    expect(result.headline.percent).toBe(67);
    expect(result.headline.latePoints).toBe(10);
  });

  it("attributes all lateness to the missing report week", () => {
    expect(result.headline.late).toEqual({
      sessions: 0,
      deliverables: 0,
      weeks: 1,
      submissions: 0,
    });
  });
});

describe("a system-generated attendance requirement", () => {
  const result = computeProgramProgress({
    program: { start_date: day(-14) },
    requirements: [
      { id: "att", title: "Attendance", allowed_format: "system" },
      { id: "r1", title: "Pitch Desk", allowed_format: "pdf", due_date: day(-5), is_completed: false },
    ],
    participants: [{ id: "p1", name: "P1", enrolled_at: day(-30) }],
    // Even an approval on the attendance row must move nothing.
    submissions: [{ deliverable_id: "att", participant_id: "p1", status: "approved" }],
    today: TODAY,
  });

  it("is left out of the deliverables block and of expected submissions", () => {
    expect(result.blocks.deliverables).toEqual({ done: 0, due: 1, points: 2 });
    expect(result.participantWork.expected).toBe(1);
    expect(result.participantWork.approved).toBe(0);
  });

  it("never appears as late work or as an overdue person × deliverable", () => {
    expect(result.late.deliverables.map((entry) => entry.id)).toEqual(["r1"]);
    expect(result.overdue.map((entry) => entry.requirementId)).toEqual(["r1"]);
  });

  it("is not a data-quality warning, only a counter", () => {
    expect(result.dataQuality.undatedRequirements).toBe(0);
    expect(result.dataQuality.systemRequirements).toBe(1);
  });
});

describe("the allowed_format field, not the title, decides", () => {
  const result = computeProgramProgress({
    program: { start_date: day(-14) },
    requirements: [
      { id: "s1", title: "Attendance", allowed_format: "system", due_date: day(-5), is_completed: false },
      { id: "s2", title: "Attendance — session 2", allowed_format: " System ", due_date: day(-5), is_completed: false },
      { id: "d1", title: "Attendance", allowed_format: "pdf", due_date: day(-5), is_completed: false },
    ],
    participants: [{ id: "p1", name: "P1", enrolled_at: day(-30) }],
    today: TODAY,
  });

  it("keeps an ordinary deliverable whose title merely says attendance", () => {
    expect(result.blocks.deliverables).toEqual({ done: 0, due: 1, points: 2 });
    expect(result.late.deliverables.map((entry) => entry.id)).toEqual(["d1"]);
    expect(result.participantWork.expected).toBe(1);
  });

  it("reports how many requirements were excluded", () => {
    expect(result.dataQuality.systemRequirements).toBe(2);
  });
});

describe("a submission linked to no deliverable", () => {
  it("is reported as data-quality noise and counted nowhere", () => {
    const result = computeProgramProgress({
      program: { start_date: day(-14) },
      requirements: [{ id: "r1", due_date: day(-5), is_completed: false }],
      participants: [{ id: "p1", name: "P1", enrolled_at: day(-30) }],
      submissions: [
        {
          document_id: "ghost",
          deliverable_id: "phantom",
          participant_id: "p1",
          status: "approved",
        },
      ],
      today: TODAY,
    });
    expect(result.dataQuality.unlinkedSubmissions).toBe(1);
    expect(result.participantWork.approved).toBe(0);
  });
});

describe("a past session nobody recorded an outcome for", () => {
  const result = computeProgramProgress({
    program: { start_date: day(-14) },
    sessions: [{ id: "unrecorded", scheduled_date: day(-5), status: "not started" }],
    today: TODAY,
  });

  it("is still counted as late — the record is the only evidence there is", () => {
    expect(result.blocks.sessions).toEqual({ done: 0, due: 1, points: 5 });
    expect(result.late.sessions.map((entry) => entry.id)).toEqual(["unrecorded"]);
  });

  it("is flagged as unrecorded and counted in the new data-quality counter", () => {
    expect(result.late.sessions[0].unrecorded).toBe(true);
    expect(result.dataQuality.pastSessionsWithoutStatus).toBe(1);
  });
});

describe("a past session with an outcome someone recorded", () => {
  const withStatus = (status) =>
    computeProgramProgress({
      program: { start_date: day(-14) },
      sessions: [{ id: "s1", scheduled_date: day(-5), status }],
      today: TODAY,
    });

  it("is late but not flagged when the recorded outcome is not completed", () => {
    const result = withStatus("cancelled");
    expect(result.late.sessions[0].unrecorded).toBe(false);
    expect(result.dataQuality.pastSessionsWithoutStatus).toBe(0);
  });

  it("is flagged when no status field is present at all", () => {
    const result = computeProgramProgress({
      program: { start_date: day(-14) },
      sessions: [{ id: "s1", scheduled_date: day(-5) }],
      today: TODAY,
    });
    expect(result.late.sessions[0].unrecorded).toBe(true);
    expect(result.dataQuality.pastSessionsWithoutStatus).toBe(1);
  });

  it("is neither late nor flagged when it was held", () => {
    const result = withStatus("completed");
    expect(result.blocks.sessions).toEqual({ done: 1, due: 1, points: 5 });
    expect(result.late.sessions).toEqual([]);
    expect(result.dataQuality.pastSessionsWithoutStatus).toBe(0);
  });
});

describe("a future session still carrying the initial status", () => {
  it("is neither late nor flagged — nothing has happened yet", () => {
    const result = computeProgramProgress({
      program: { start_date: day(-14) },
      sessions: [{ id: "s1", scheduled_date: day(5), status: "not started" }],
      today: TODAY,
    });
    expect(result.blocks.sessions.due).toBe(0);
    expect(result.late.sessions).toEqual([]);
    expect(result.dataQuality.pastSessionsWithoutStatus).toBe(0);
  });
});

describe("the unrecorded counter across a mixed programme", () => {
  it("counts only the past sessions with no recorded outcome", () => {
    const result = computeProgramProgress({
      program: { start_date: day(-14) },
      sessions: [
        { id: "unrecorded", scheduled_date: day(-5), status: "not started" },
        { id: "cancelled", scheduled_date: day(-4), status: "cancelled" },
      ],
      today: TODAY,
    });
    expect(result.late.sessions).toHaveLength(2);
    expect(result.dataQuality.pastSessionsWithoutStatus).toBe(1);
  });
});
