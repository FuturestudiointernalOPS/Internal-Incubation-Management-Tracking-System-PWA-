/**
 * Projects — the portfolio scope is a RIGHT.
 *
 * `seesWholeProjectPortfolio(role)` decided who may look at a project they do
 * not belong to, and who must pass the per-project object check. It now asks
 * the engine for `projects.view_all`. The shared listing-scope helper takes the
 * verdict and fails CLOSED when it is absent.
 */

jest.mock("@/models/authorization/index", () => ({
  getAuthorizationContext: jest.fn(async () => ({})),
  authorize: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

const {
  getAuthorizationContext,
  authorize,
} = require("@/models/authorization/index");
const { resolveProjectPortfolio, resolveProjectModerate, resolveProjectListFilter } = require(
  "@/services/projects/workspace",
);
const { needsProjectObjectCheck } = require("@/services/projects/access");
const { resolveListingScope } = require("@/services/authorization/listingScope");

beforeEach(() => {
  jest.clearAllMocks();
  authorize.mockReturnValue(false);
});

describe("resolveProjectPortfolio — the engine decides", () => {
  test("asks for projects.view_all and returns its answer", async () => {
    authorize.mockReturnValue(true);
    await expect(resolveProjectPortfolio({ role: "staff", cid: "u1" })).resolves.toBe(true);
    expect(getAuthorizationContext).toHaveBeenCalledWith({ cid: "u1", role: "staff" });
    expect(authorize).toHaveBeenCalledWith(expect.anything(), "projects", "view_all");
  });

  test("a caller without an identity holds nothing", async () => {
    await expect(resolveProjectPortfolio({ role: "staff", cid: null })).resolves.toBe(false);
    expect(getAuthorizationContext).not.toHaveBeenCalled();
  });

  test("a resolution failure is a closed door", async () => {
    getAuthorizationContext.mockRejectedValueOnce(new Error("db down"));
    await expect(resolveProjectPortfolio({ role: "staff", cid: "u1" })).resolves.toBe(false);
  });

  test("moderation is a different question (projects.moderate)", async () => {
    authorize.mockReturnValue(true);
    await expect(resolveProjectModerate({ role: "staff", cid: "u1" })).resolves.toBe(true);
    expect(authorize).toHaveBeenCalledWith(expect.anything(), "projects", "moderate");
  });
});

describe("needsProjectObjectCheck — the safe answer", () => {
  test("a caller without the right must pass the object check", async () => {
    authorize.mockReturnValue(false);
    await expect(
      needsProjectObjectCheck({ role: "member", cid: "u1" }),
    ).resolves.toBe(true);
  });

  test("a holder of the right skips it", async () => {
    authorize.mockReturnValue(true);
    await expect(
      needsProjectObjectCheck({ role: "staff", cid: "u1" }),
    ).resolves.toBe(false);
  });
});

describe("resolveListingScope — the verdict, never a role", () => {
  test("without the right, a foreign id is refused", () => {
    expect(
      resolveListingScope({
        role: "staff",
        sessionCid: "u1",
        requestedCid: "u2",
        denialMessage: "errors.ownProjectsViewOnly",
        seesAll: false,
      }),
    ).toEqual({ denied: "errors.ownProjectsViewOnly" });
  });

  test("with the right, the requested id is kept (or none)", () => {
    expect(
      resolveListingScope({
        role: "staff",
        sessionCid: "u1",
        requestedCid: "u2",
        denialMessage: "errors.ownProjectsViewOnly",
        seesAll: true,
      }),
    ).toEqual({ cid: "u2" });
  });

  test("an ABSENT verdict is a closed scope (fail closed)", () => {
    expect(
      resolveListingScope({
        role: "staff",
        sessionCid: "u1",
        requestedCid: "u2",
        denialMessage: "errors.ownProjectsViewOnly",
      }),
    ).toEqual({ denied: "errors.ownProjectsViewOnly" });
  });
});

describe("resolveProjectListFilter — the same rule for the list", () => {
  test("a caller without the right is pinned to their own id", () => {
    expect(
      resolveProjectListFilter({ sessionCid: "u1", requestedCid: null, seesAll: false }),
    ).toEqual({ filterCid: "u1" });
  });

  test("a holder may filter by whatever they passed", () => {
    expect(
      resolveProjectListFilter({ sessionCid: "u1", requestedCid: "u2", seesAll: true }),
    ).toEqual({ filterCid: "u2" });
    expect(
      resolveProjectListFilter({ sessionCid: "u1", requestedCid: null, seesAll: true }),
    ).toEqual({ filterCid: null });
  });
});
