/**
 * LMS — suspended enrollments must not reach the learner's course list.
 *
 * `learnerHasEnrollments` and the `learning_own` scope policy both exclude
 * suspended rows, and every enrollment-gated route (`learn`, `complete`,
 * `take`, `submit`) refuses them with 403. `getLearnerCourses` was the one
 * remaining read that did not filter, so a suspended learner saw a course in
 * "My Learning" that would 403 the moment it was opened.
 */

const enrolled = [];

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql, args = [] }) => {
      if (/FROM lms_enrollments/.test(sql)) {
        enrolled.push({ sql, args });
        const rows = [
          { id: 1, user_cid: "U1", course_id: "C1", status: "active", enrolled_at: "2026-01-01" },
          { id: 2, user_cid: "U1", course_id: "C2", status: "suspended", enrolled_at: "2026-01-02" },
        ].filter((enrollment) => !(sql.includes("status <> 'suspended'") && enrollment.status === "suspended"));
        return { rows };
      }
      return { rows: [] };
    }),
  },
  initDb: jest.fn(async () => {}),
}));

const db = require("@/lib/db").default;
const { getLearnerCourses } = require("@/models/lms/learning");

beforeEach(() => {
  enrolled.length = 0;
  db.execute.mockClear();
});

test("the enrollment lookup excludes suspended rows", async () => {
  await getLearnerCourses("U1");

  expect(enrolled).toHaveLength(1);
  expect(enrolled[0].sql).toMatch(/status <> 'suspended'/);
  expect(enrolled[0].args).toEqual(["U1"]);
});

test("the suspended course is never resolved (only the active one is looked up)", async () => {
  await getLearnerCourses("U1");

  const courseLookup = db.execute.mock.calls
    .map(([call]) => call)
    .find((call) => /FROM lms_courses/.test(call.sql));

  expect(courseLookup).toBeDefined();
  expect(courseLookup.args).toEqual(["C1"]);
  expect(courseLookup.args).not.toContain("C2");
});
