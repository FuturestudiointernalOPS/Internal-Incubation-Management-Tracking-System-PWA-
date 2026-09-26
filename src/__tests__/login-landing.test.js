/**
 * WHERE A PERSON LANDS — one rule, decided from the RELATIONSHIPS.
 *
 * The defect this locks shut: the destination after signing in was chosen from
 * the badge the account carries, and the badge no longer carries context by
 * design (joining a Venture must not rewrite the baseline identity). So the
 * founder shortcut — "exactly one Venture → go straight into it" — only fired
 * for accounts written before that change, and the most important person in the
 * product landed on a generic dashboard while the sidebar offered them a door
 * their landing page ignored.
 *
 * Two questions, asked in this order, because they are not the same question:
 *   1. a GLOBAL identity owns a section (the badge is the right answer, and a
 *      Venture they happen to own is one of their doors, not their desk);
 *   2. everyone else lives in the personal world, where the RELATIONSHIPS decide.
 *
 * The callers (the login redirect, the neutral hub's home button, the root
 * bounce) are pinned to that one rule, so they cannot answer differently again.
 */
const fs = require("fs");
const path = require("path");
const {
  resolveLanding,
  landingNeedsRelationships,
  isFounderMembership,
} = require("@/models/platform/roles");

const src = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

/** One Venture membership, as the reads hand them over. */
const venture = (overrides = {}) => ({
  venture_id: "VNT-1",
  status: "active",
  member_type: "founder",
  is_owner: true,
  ...overrides,
});

describe("global identities keep the section their badge owns", () => {
  // Deliberately NOT listing the role names being retired: a test that pins a
  // role on its way out freezes what the cleanup is removing. The rule below is
  // generic — it asks the shared map, whatever that map ends up containing.
  test.each([
    ["super_admin", "/admin"],
    ["staff", "/staff"],
    ["program_manager", "/pm"],
    ["facilitator", "/facilitator"],
    ["investor", "/investor/dashboard"],
  ])("%s → %s", (role, home) => {
    expect(resolveLanding({ role })).toBe(home);
  });

  test("owning a Venture does not move them: it is one of their doors, not their desk", () => {
    expect(resolveLanding({ role: "staff", ventures: [venture()] })).toBe("/staff");
    expect(
      resolveLanding({ role: "super_admin", ventures: [venture()] }),
    ).toBe("/admin");
  });
});

describe("an entity login keeps its own space", () => {
  test("a team account receives its team workspace", () => {
    expect(resolveLanding({ role: "team", teamId: 7 })).toBe("/team/7");
    // No identifier is still a destination, never an undefined path.
    expect(resolveLanding({ role: "team" })).toBe("/team");
  });
});

describe("the personal world follows what the person OWNS", () => {
  test("founding exactly one active Venture lands inside it", () => {
    expect(resolveLanding({ role: "member", ventures: [venture()] })).toBe(
      "/participant/ventures/VNT-1",
    );
    expect(resolveLanding({ role: "participant", ventures: [venture()] })).toBe(
      "/participant/ventures/VNT-1",
    );
  });

  test("the same is true for a legacy founder badge", () => {
    expect(resolveLanding({ role: "founder", ventures: [venture()] })).toBe(
      "/participant/ventures/VNT-1",
    );
  });

  test("an identity the map does not know still gets its Venture", () => {
    expect(resolveLanding({ role: "security_officer", ventures: [venture()] })).toBe(
      "/participant/ventures/VNT-1",
    );
  });

  test("with no Venture, everyone keeps the neutral home", () => {
    expect(resolveLanding({ role: "member", ventures: [] })).toBe("/participant");
    expect(resolveLanding({ role: "participant" })).toBe("/participant");
    // An identity with no section and no Venture has nowhere but the hub — the
    // one destination that refuses nobody.
    expect(resolveLanding({ role: "security_officer" })).toBe("/workspaces");
  });

  test("SEVERAL Ventures is not a decision the rule takes for the person", () => {
    expect(
      resolveLanding({ role: "member", ventures: [venture(), venture({ venture_id: "VNT-2" })] }),
    ).toBe("/participant");
  });

  test("a dormant Venture is not the one to land in", () => {
    expect(resolveLanding({ role: "member", ventures: [venture({ status: "archived" })] })).toBe(
      "/participant",
    );
    expect(resolveLanding({ role: "member", ventures: [venture({ status: "completed" })] })).toBe(
      "/participant",
    );
  });

  test("belonging to a Venture without founding it is NOT the shortcut", () => {
    const asTeamMember = venture({ member_type: "team_member", is_owner: false });
    expect(resolveLanding({ role: "member", ventures: [asTeamMember] })).toBe("/participant");
  });

  test("one active Venture AMONG dormant ones still lands inside it", () => {
    expect(
      resolveLanding({
        role: "member",
        ventures: [venture(), venture({ venture_id: "VNT-2", status: "archived" })],
      }),
    ).toBe("/participant/ventures/VNT-1");
  });
});

describe("an assigned investor context lands in the investor space", () => {
  test("a baseline member who was made an investor belongs in their investor space", () => {
    expect(resolveLanding({ role: "member", isInvestor: true })).toBe("/investor/dashboard");
    expect(resolveLanding({ role: "participant", isInvestor: true })).toBe("/investor/dashboard");
  });

  test("no investor context leaves the personal landing untouched", () => {
    expect(resolveLanding({ role: "member", isInvestor: false })).toBe("/participant");
    expect(resolveLanding({ role: "participant" })).toBe("/participant");
  });

  test("an owned Venture keeps the Venture landing — the investor door remains in the sidebar", () => {
    expect(
      resolveLanding({ role: "member", ventures: [venture()], isInvestor: true }),
    ).toBe("/participant/ventures/VNT-1");
  });

  test("a global identity is never moved by an investor context", () => {
    expect(resolveLanding({ role: "staff", isInvestor: true })).toBe("/staff");
    expect(resolveLanding({ role: "super_admin", isInvestor: true })).toBe("/admin");
  });
});

describe("landingNeedsRelationships — who pays for the read", () => {
  test("a global identity and an entity account never do", () => {
    for (const role of ["super_admin", "staff", "program_manager", "facilitator", "investor", "team"]) {
      expect(landingNeedsRelationships(role)).toBe(false);
    }
  });

  test("the personal identities and unknown ones do", () => {
    for (const role of ["member", "participant", "founder", "security_officer", ""]) {
      expect(landingNeedsRelationships(role)).toBe(true);
    }
  });
});

describe("isFounderMembership — ONE definition of founding a Venture", () => {
  test("accepts an owning membership, however the flag arrives", () => {
    expect(isFounderMembership({ is_owner: true })).toBe(true);
    expect(isFounderMembership({ is_owner: 1 })).toBe(true);
  });

  test("accepts a membership typed as founder", () => {
    expect(isFounderMembership({ member_type: "founder" })).toBe(true);
  });

  test("refuses a team member of the Venture", () => {
    expect(isFounderMembership({ member_type: "team_member", is_owner: false })).toBe(false);
    expect(isFounderMembership({})).toBe(false);
  });
});

describe("every caller uses that one rule", () => {
  test("the login decides the destination and sends it with the identity", () => {
    const login = src("src/app/api/auth/session-login/route.js");
    expect(login).toContain("resolveLanding(");
    expect(login).toContain("responseUser.home =");
  });

  test("the hub's home button is that rule, not the badge alone", () => {
    const hub = src("src/app/api/workspaces/route.js");
    expect(hub).toContain("home: resolveLanding(");
    expect(hub).not.toContain("home: roleHomeHref(");
  });

  test("the login reads the investor context from the PROFILE and sends it with the identity", () => {
    const login = src("src/app/api/auth/session-login/route.js");
    expect(login).toContain("getApprovedInvestorProfileIdByUserId");
    expect(login).toContain("isInvestor,");
  });

  test("the hub reads the same context, so its button cannot drift from the login", () => {
    const hub = src("src/app/api/workspaces/route.js");
    expect(hub).toContain("getApprovedInvestorProfileIdByUserId");
    expect(hub).toContain("isInvestor,");
  });

  test("the personal sidebar offers the investor door from the profile, not the badge", () => {
    const shell = src("src/components/layout/DashboardLayout.js");
    expect(shell).toContain("rel.isInvestor");
    expect(shell).toContain('href: "/investor/dashboard"');
  });

  test("the relationships read exposes the investor context the sidebar consumes", () => {
    const relationships = src("src/app/api/me/relationships/route.js");
    expect(relationships).toContain("getApprovedInvestorProfileIdByUserId");
    expect(relationships).toContain("isInvestor,");
  });

  test("the root bounce prefers the answer that travelled with the identity", () => {
    const root = src("src/app/page.js");
    expect(root).toContain("user.home || roleHomeHref(user.role)");
  });

  test("the login screen no longer asks the Venture directory itself", () => {
    // The browser used to resolve a founder's Venture with its own request,
    // which is exactly the kind of second decision this consolidates away.
    const screen = src("src/app/login/page.js");
    expect(screen).not.toContain("/api/ventures?contact_id");
    expect(screen).toContain("data.user.home ||");
  });
});
