/**
 * PARTICIPANT-PROGRAMS BULK — the queue, measured.
 *
 * A bulk assign/remove used to issue, PER PERSON, a conflict check, the
 * assignment, an audit entry and one enrolment statement per required course -
 * all in series. On a few hundred people that is a request that cannot finish.
 *
 * This measures the shape after the change: the work goes out in CHUNKS of 30,
 * so the number of statements follows the number of chunks rather than the
 * number of people. The REAL route runs against the shared fake LMS DB, which
 * records every statement it is asked to execute.
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");
const mockFake = createFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
}));

jest.mock("@/lib/programScopedAccess", () => ({
  requireProgramScope: jest.fn(async () => null),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { attachCourseToProgram } = require("@/lib/lms/programRequirements");
const { POST } = require("@/app/api/participant-programs/bulk/route");

const PROGRAM = "P-2026-001";

const post = (body) =>
  POST(
    new Request("http://localhost/api/participant-programs/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const people = (n) => Array.from({ length: n }, (_, i) => `U-${i + 1}`);

beforeEach(async () => {
  mockFake.reset();
  mockFake.seed("v2_programs", [{ id: PROGRAM, name: "Cohort 1" }]);
  mockFake.seed("lms_courses", [
    {
      id: "crs-1",
      slug: "customer-discovery",
      title: "Customer Discovery",
      description: "Interview your customers.",
      thumbnail_url: null,
      status: "published",
      visibility: "public",
      is_free: true,
      price: null,
      created_by: "U-ADMIN",
    },
  ]);
  // One PUBLISHED required course, so each chunk's enrolment is one statement.
  await attachCourseToProgram({ programId: PROGRAM, courseId: "crs-1" });
});

describe("POST /api/participant-programs/bulk", () => {
  test("assigns a chunk of 30 people with a handful of statements, not sixty", async () => {
    const cids = people(30);
    mockFake.executed.length = 0;

    const res = await post({
      participant_ids: cids,
      program_id: PROGRAM,
      action: "add",
      assigned_by: "U-ADMIN",
    });
    const body = await res.json();

    const statements = mockFake.executed;
    console.log(
      `bulk add: ${cids.length} people -> ${statements.length} statement(s)`,
    );

    expect(body.success).toBe(true);
    expect(body.processed).toHaveLength(30);
    expect(body.errors).toHaveLength(0);
    // ONE programme check for the request, then per chunk: the conflict check,
    // the assignment, the audit entry, and the enrolment's own two reads and one
    // grouped insert. The PEOPLE count does not appear in this number — before
    // the change it was 30 x (3 + 1 per required course).
    expect(statements.length).toBeLessThanOrEqual(8);
    expect(
      statements.filter((s) => /insert into participant_programs/i.test(s.sql)),
    ).toHaveLength(1);
    expect(
      statements.filter((s) => /insert into participant_program_audit/i.test(s.sql)),
    ).toHaveLength(1);
    // Every person is assigned and enrolled exactly once.
    expect(mockFake.state.participant_programs).toHaveLength(30);
    expect(mockFake.state.lms_enrollments).toHaveLength(30);
  });

  test("sixty-five people go out as three chunks… and the tail chunk is not lost", async () => {
    const cids = people(65);
    mockFake.executed.length = 0;

    const body = await (
      await post({
        participant_ids: cids,
        program_id: PROGRAM,
        action: "add",
        assigned_by: "U-ADMIN",
      })
    ).json();

    const statements = mockFake.executed;
    console.log(
      `bulk add: ${cids.length} people -> ${statements.length} statement(s)`,
    );

    expect(body.success).toBe(true);
    expect(body.processed).toHaveLength(65);
    // 65 is 30 + 30 + 5: three assignments, three audits and three enrolments -
    // a number that follows the CHUNKS, not the people.
    expect(
      statements.filter((s) => /insert into participant_programs/i.test(s.sql)),
    ).toHaveLength(3);
    expect(mockFake.state.participant_programs).toHaveLength(65);
    expect(mockFake.state.lms_enrollments).toHaveLength(65);
  });

  test("a facilitator is still refused, and does not hold up their chunk", async () => {
    const cids = people(3);
    // U-2 already facilitates this programme.
    mockFake.seed("v2_program_staff", [
      { id: 1, program_id: PROGRAM, staff_id: "U-2", role: "facilitator" },
    ]);

    const body = await (
      await post({
        participant_ids: cids,
        program_id: PROGRAM,
        action: "add",
      })
    ).json();

    expect(body.success).toBe(true);
    expect(body.processed).toEqual(["U-1", "U-3"]);
    expect(body.errors).toEqual([
      { participant_id: "U-2", error: "errors.roleConflictFacilitatorParticipant" },
    ]);
    // The refused person is neither assigned nor enrolled.
    expect(mockFake.state.participant_programs.map((r) => r.participant_id)).toEqual([
      "U-1",
      "U-3",
    ]);
    expect(mockFake.state.lms_enrollments.map((r) => r.user_cid)).toEqual([
      "U-1",
      "U-3",
    ]);
  });

  test("remove takes the whole chunk out in one statement, with one audit entry", async () => {
    const cids = people(40);
    await post({
      participant_ids: cids,
      program_id: PROGRAM,
      action: "add",
      assigned_by: "U-ADMIN",
    });
    mockFake.executed.length = 0;

    const body = await (
      await post({
        participant_ids: cids,
        program_id: PROGRAM,
        action: "remove",
        assigned_by: "U-ADMIN",
      })
    ).json();

    const statements = mockFake.executed;
    console.log(
      `bulk remove: ${cids.length} people -> ${statements.length} statement(s)`,
    );

    expect(body.success).toBe(true);
    expect(body.processed).toHaveLength(40);
    // 40 is 30 + 10: two deletes and two audit entries.
    expect(
      statements.filter((s) => /delete from participant_programs/i.test(s.sql)),
    ).toHaveLength(2);
    expect(mockFake.state.participant_programs).toHaveLength(0);
    // Removing a person never revokes the learning already granted (Phase 6).
    expect(mockFake.state.lms_enrollments).toHaveLength(40);
  });
});
