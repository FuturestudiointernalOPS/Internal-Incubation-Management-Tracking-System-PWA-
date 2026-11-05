/**
 * Program-sourced learning access (src/services/lms/learning/programAccess.js).
 *
 * Pins the two use cases behind "My Learning must not outlive the seat":
 *   - releasing the learning after a membership change (suspended, not deleted,
 *     and never a course another seat still requires);
 *   - the orphan control: list the leftovers, suspend the selected ones.
 *
 * Also pins that every membership-removal flow actually calls the release, so
 * a future removal path cannot forget it silently.
 */

const fs = require("node:fs");
const path = require("node:path");

jest.mock("@/models/lms/learningStore", () => ({
  suspendStaleProgramEnrollments: jest.fn(),
  listOrphanProgramEnrollments: jest.fn(),
  suspendProgramEnrollmentsByIds: jest.fn(),
}));

const store = require("@/models/lms/learningStore");
const {
  releaseProgramLearning,
  listOrphanProgramEnrollments,
  suspendOrphanProgramEnrollments,
} = require("@/services/lms/learning/programAccess");

beforeEach(() => {
  jest.clearAllMocks();
  store.suspendStaleProgramEnrollments.mockResolvedValue({ rowsAffected: 1 });
  store.suspendProgramEnrollmentsByIds.mockResolvedValue({ rowsAffected: 2 });
});

describe("releaseProgramLearning", () => {
  test("reconciles one person's program learning", async () => {
    await expect(releaseProgramLearning({ cid: "user-1" })).resolves.toEqual({
      released: 1,
      failed: false,
    });
    expect(store.suspendStaleProgramEnrollments).toHaveBeenCalledWith(["user-1"]);
  });

  test("accepts a whole chunk for the bulk removal", async () => {
    store.suspendStaleProgramEnrollments.mockResolvedValue({ rowsAffected: 7 });
    await expect(releaseProgramLearning({ cids: ["a", "b", ""] })).resolves.toEqual({
      released: 7,
      failed: false,
    });
    expect(store.suspendStaleProgramEnrollments).toHaveBeenCalledWith(["a", "b"]);
  });

  test("never breaks the membership change it follows", async () => {
    store.suspendStaleProgramEnrollments.mockRejectedValue(new Error("db down"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(releaseProgramLearning({ cid: "user-1" })).resolves.toEqual({
      released: 0,
      failed: true,
    });
  });

  test("does nothing without a person", async () => {
    await expect(releaseProgramLearning({})).resolves.toEqual({ released: 0, failed: false });
    expect(store.suspendStaleProgramEnrollments).not.toHaveBeenCalled();
  });
});

describe("the orphan control", () => {
  test("lists the leftovers with a shape the screen can render", async () => {
    store.listOrphanProgramEnrollments.mockResolvedValue({
      rows: [
        {
          id: "e1",
          user_cid: "user-1",
          user_name: "Ada",
          user_email: "ada@example.com",
          course_id: "c1",
          course_title: "Fundraising",
          program_id: "P-1",
          status: "active",
          enrolled_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    await expect(listOrphanProgramEnrollments()).resolves.toEqual([
      expect.objectContaining({
        id: "e1",
        user_name: "Ada",
        course_title: "Fundraising",
        program_id: "P-1",
      }),
    ]);
  });

  test("suspends the selected enrollments, and refuses an empty selection", async () => {
    await expect(suspendOrphanProgramEnrollments(["e1", "e2"])).resolves.toEqual({
      suspended: 2,
    });
    expect(store.suspendProgramEnrollmentsByIds).toHaveBeenCalledWith(["e1", "e2"]);

    await expect(suspendOrphanProgramEnrollments([])).resolves.toEqual({ suspended: 0 });
  });
});

describe("every membership removal releases the learning", () => {
  const ROOT = path.join(__dirname, "..", "..");
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

  test.each([
    "src/services/programs/participantPrograms.js",
    "src/app/api/participant-programs/bulk/route.js",
    "src/services/contacts/update.js",
    "src/app/api/contacts/route.js",
  ])("%s", (file) => {
    expect(read(file)).toContain("releaseProgramLearning(");
  });
});
