/**
 * Tasks — the sub-resource access rule is a RIGHT.
 *
 * `canAccessTask` used to ask `seesWholePortfolio(role)`: the staff-side cohort
 * could touch anyone's task. It now asks the engine for `tasks.act_any`, and the
 * moderation powers (another person's comment or blocker) ask for
 * `tasks.moderate`. The pure rule and its resolution are pinned separately.
 */

jest.mock("@/models/authorization/index", () => ({
  getAuthorizationContext: jest.fn(async () => ({})),
  authorize: jest.fn(),
}));

const {
  getAuthorizationContext,
  authorize,
} = require("@/models/authorization/index");
const {
  ownsTask,
  canAccessTask,
  resolveTaskActAny,
  resolveTaskModerate,
  canAccessTaskFor,
} = require("@/services/tasks/access");

const TASK = { user_id: "u1", assigned_to: "u2", supervisor_id: "u3" };
const STRANGER = "u9";

beforeEach(() => {
  jest.clearAllMocks();
  authorize.mockReturnValue(false);
});

describe("ownsTask — the three relationships", () => {
  test("owner, assignee and supervisor own the task", () => {
    expect(ownsTask(TASK, "u1")).toBe(true);
    expect(ownsTask(TASK, "u2")).toBe(true);
    expect(ownsTask(TASK, "u3")).toBe(true);
  });

  test("anybody else does not", () => {
    expect(ownsTask(TASK, STRANGER)).toBe(false);
    expect(ownsTask({}, STRANGER)).toBe(false);
  });
});

describe("canAccessTask — the right OR the relationship", () => {
  test("the right opens any task", () => {
    expect(canAccessTask({ task: TASK, cid: STRANGER, canActAny: true })).toBe(true);
  });

  test("without the right, only the relationship opens it", () => {
    expect(canAccessTask({ task: TASK, cid: "u2", canActAny: false })).toBe(true);
    expect(canAccessTask({ task: TASK, cid: STRANGER, canActAny: false })).toBe(false);
  });
});

describe("resolveTaskActAny / resolveTaskModerate — the engine decides", () => {
  test("act_any is asked for, and its answer is returned", async () => {
    authorize.mockReturnValue(true);
    await expect(resolveTaskActAny({ role: "staff", cid: "u1" })).resolves.toBe(true);
    expect(getAuthorizationContext).toHaveBeenCalledWith({ cid: "u1", role: "staff" });
    expect(authorize).toHaveBeenCalledWith(expect.anything(), "tasks", "act_any");
  });

  test("moderate is a different question", async () => {
    authorize.mockReturnValue(true);
    await resolveTaskModerate({ role: "staff", cid: "u1" });
    expect(authorize).toHaveBeenCalledWith(expect.anything(), "tasks", "moderate");
  });

  test("a caller without an identity holds nothing", async () => {
    await expect(resolveTaskActAny({ role: "staff", cid: null })).resolves.toBe(false);
    expect(getAuthorizationContext).not.toHaveBeenCalled();
  });

  test("a resolution failure is a closed door", async () => {
    getAuthorizationContext.mockRejectedValueOnce(new Error("db down"));
    await expect(resolveTaskActAny({ role: "staff", cid: "u1" })).resolves.toBe(false);
  });
});

describe("canAccessTaskFor — the whole rule", () => {
  test("the right is resolved before the decision", async () => {
    authorize.mockReturnValue(true);
    await expect(
      canAccessTaskFor({ task: TASK, role: "staff", cid: STRANGER }),
    ).resolves.toBe(true);
  });

  test("without the right, the relationship still decides", async () => {
    authorize.mockReturnValue(false);
    await expect(
      canAccessTaskFor({ task: TASK, role: "member", cid: "u1" }),
    ).resolves.toBe(true);
    await expect(
      canAccessTaskFor({ task: TASK, role: "member", cid: STRANGER }),
    ).resolves.toBe(false);
  });
});
