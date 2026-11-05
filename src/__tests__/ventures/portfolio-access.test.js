/**
 * THE VENTURE PORTFOLIO PERIMETER — a right, not a role.
 *
 * These tests pin the two properties the feature exists for:
 *
 *   1. `ventures.view_all` / `ventures.edit_all` decide who reaches every
 *      Venture. The right is read from the EFFECTIVE matrix (so a Super Admin's
 *      default profile can be edited, and a restriction removes it), never from
 *      the role name.
 *   2. Only an INTERNAL identity can hold the perimeter. A member with the
 *      right — however it got there — is still refused.
 */

jest.mock("@/models/authorization/index", () => ({
  getAuthorizationContext: jest.fn(async () => null),
}));

const {
  portfolioCapabilityFor,
  holdsExplicitCapability,
  holdsVenturePortfolioRight,
  resolveVenturePortfolioAccess,
} = require("@/services/ventures/portfolioAccess");
const { getAuthorizationContext } = require("@/models/authorization/index");

const ctx = ({ role = "staff", caps = {}, restrictions = {}, isSuperAdmin = false } = {}) => ({
  role,
  isSuperAdmin,
  effective: caps,
  restrictions,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("the action → perimeter mapping", () => {
  test("view asks for view_all, edit for edit_all", () => {
    expect(portfolioCapabilityFor("view")).toBe("view_all");
    expect(portfolioCapabilityFor("edit")).toBe("edit_all");
    expect(portfolioCapabilityFor("delete")).toBe(null);
  });
});

describe("holdsExplicitCapability", () => {
  test("reads the effective matrix, not the role", () => {
    expect(holdsExplicitCapability(ctx({ caps: { ventures: { view_all: 1 } } }), "ventures", "view_all")).toBe(true);
    expect(holdsExplicitCapability(ctx({ caps: { ventures: { view: 5 } } }), "ventures", "view_all")).toBe(false);
  });

  test("a restriction removes it even from a Super Admin's matrix", () => {
    expect(
      holdsExplicitCapability(
        ctx({
          isSuperAdmin: true,
          caps: { ventures: { view_all: 5 } },
          restrictions: { ventures: new Set(["view_all"]) },
        }),
        "ventures",
        "view_all",
      ),
    ).toBe(false);
  });
});

describe("holdsVenturePortfolioRight", () => {
  test("a staff member with view_all reaches the portfolio", () => {
    expect(
      holdsVenturePortfolioRight(ctx({ caps: { ventures: { view_all: 1 } } }), "view"),
    ).toBe(true);
  });

  test("view_all does not imply edit_all", () => {
    expect(
      holdsVenturePortfolioRight(ctx({ caps: { ventures: { view_all: 1 } } }), "edit"),
    ).toBe(false);
  });

  test("a member never holds the staff perimeter", () => {
    expect(
      holdsVenturePortfolioRight(
        ctx({ role: "member", caps: { ventures: { view_all: 5 } } }),
        "view",
      ),
    ).toBe(false);
  });
});

describe("resolveVenturePortfolioAccess", () => {
  test("an unauthenticated caller is refused before any read", async () => {
    const out = await resolveVenturePortfolioAccess({ session: null, action: "view" });
    expect(out.reason).toBe("unauthenticated");
    expect(getAuthorizationContext).not.toHaveBeenCalled();
  });

  test("an unknown action has no perimeter", async () => {
    const out = await resolveVenturePortfolioAccess({ session: { cid: "C1" }, action: "delete" });
    expect(out).toEqual({ allowed: false, capability: null, reason: "unknown-action" });
  });

  test("a staff member holding the right is allowed without a second read when the context is supplied", async () => {
    const resolved = ctx({ caps: { ventures: { view_all: 1 } } });
    const out = await resolveVenturePortfolioAccess({
      session: { cid: "C1", role: "staff" },
      action: "view",
      ctx: resolved,
    });
    expect(out).toEqual({ allowed: true, capability: "view_all", reason: "portfolio" });
    expect(getAuthorizationContext).not.toHaveBeenCalled();
  });

  test("the resolver's answer is used when no context is supplied", async () => {
    getAuthorizationContext.mockResolvedValue(ctx({ caps: { ventures: { edit_all: 3 } } }));
    const out = await resolveVenturePortfolioAccess({
      session: { cid: "C1", role: "staff" },
      action: "edit",
    });
    expect(out.allowed).toBe(true);
    expect(getAuthorizationContext).toHaveBeenCalledWith({ cid: "C1", role: "staff" });
  });

  test("a resolver failure fails closed", async () => {
    getAuthorizationContext.mockRejectedValue(new Error("down"));
    const out = await resolveVenturePortfolioAccess({
      session: { cid: "C1", role: "staff" },
      action: "view",
    });
    expect(out).toMatchObject({ allowed: false, reason: "system-failure" });
  });
});
