/**
 * WHERE A PERSON LANDS — one rule, one member home.
 *
 * The product decision this locks:
 *
 *   every member-space identity opens THE SAME dashboard (`/dashboard`); what
 *   differs is which SECTIONS it shows, and that is decided from the
 *   relationships the person holds (see member-dashboard.test.js).
 *
 * A global identity (staff, program manager, platform owner) still lands in the
 * section it works in, and an entity account (team) keeps its own workspace.
 *
 * The callers (the login redirect, the workspaces hub's home button, the root
 * bounce) are pinned to that one rule, so they cannot answer differently again.
 */
const fs = require("fs");
const path = require("path");
const {
  MEMBER_HOME,
  ROLE_HOME,
  resolveLanding,
  resolveLandingFromAccess,
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

describe("the one member home", () => {
  test("it is /dashboard", () => {
    expect(MEMBER_HOME).toBe("/dashboard");
  });

  test.each(["member", "participant", "founder", "facilitator", "investor"])(
    "%s lands on the dashboard",
    (role) => {
      expect(resolveLanding({ role })).toBe("/dashboard");
    },
  );

  test("an identity the map does not know is a member too", () => {
    expect(resolveLanding({ role: "security_officer" })).toBe("/dashboard");
    expect(resolveLanding({ role: "" })).toBe("/dashboard");
  });

  test("NO relationship moves the landing any more", () => {
    // Every signal that used to choose a different page is now just content for
    // the same page: an owned venture, an investor profile, a program seat.
    expect(resolveLanding({ role: "member", ventures: [venture()] })).toBe("/dashboard");
    expect(
      resolveLanding({ role: "member", ventures: [venture(), venture({ venture_id: "VNT-2" })] }),
    ).toBe("/dashboard");
    expect(resolveLanding({ role: "member", isInvestor: true, isProgramParticipant: true })).toBe(
      "/dashboard",
    );
    expect(resolveLanding({ role: "member", profiles: ["investor", "founder"] })).toBe("/dashboard");
  });

  test("the retired context labels answer the same page", () => {
    expect(ROLE_HOME.participant).toBe("/dashboard");
    expect(ROLE_HOME.facilitator).toBe("/dashboard");
    expect(ROLE_HOME.investor).toBe("/dashboard");
  });
});

describe("global identities keep the section they work in", () => {
  test.each([
    ["super_admin", "/admin"],
    ["staff", "/staff"],
  ])("%s → %s", (role, home) => {
    expect(resolveLanding({ role })).toBe(home);
    expect(resolveLandingFromAccess({ role })).toBe(home);
  });

  test("a legacy finance label keeps its section", () => {
    // The access rule gates that section on the finance right (pinned in
    // landing-from-access.test.js); the relationship rule just answers the map.
    expect(resolveLanding({ role: "finance" })).toBe("/staff/finance");
  });

  test("a program manager works in the PM space", () => {
    expect(resolveLanding({ role: "program_manager" })).toBe("/staff/program-manager");
    expect(
      resolveLandingFromAccess({ role: "program_manager", profiles: ["program_manager"] }),
    ).toBe("/staff/program-manager");
    // Without the profile, the access rule keeps the staff space.
    expect(resolveLandingFromAccess({ role: "program_manager" })).toBe("/staff");
  });

  test("a staff member carrying the program-manager profile works in the PM space", () => {
    expect(resolveLanding({ role: "staff", profiles: ["program_manager"] })).toBe(
      "/staff/program-manager",
    );
  });

  test("owning a Venture does not move them: it is one of their doors, not their desk", () => {
    expect(resolveLanding({ role: "staff", ventures: [venture()] })).toBe("/staff");
    expect(
      resolveLandingFromAccess({ role: "super_admin", effective: {} }),
    ).toBe("/admin");
  });
});

describe("an entity login keeps its own space", () => {
  test("a team account receives its team workspace", () => {
    expect(resolveLanding({ role: "team", teamId: 7 })).toBe("/member/team/7");
    // No identifier is still a destination, never an undefined path.
    expect(resolveLanding({ role: "team" })).toBe("/member/team");
  });
});

describe("landing from access — the member rule does not depend on the matrix", () => {
  test("every member identity lands on the dashboard, with or without rights", () => {
    for (const role of ["member", "participant", "founder", "facilitator", "investor"]) {
      expect(resolveLandingFromAccess({ role })).toBe("/dashboard");
      expect(resolveLandingFromAccess({ role, effective: {} })).toBe("/dashboard");
      expect(
        resolveLandingFromAccess({ role, profiles: ["investor", "founder"], effective: null }),
      ).toBe("/dashboard");
    }
  });

  test("the entity account is still the one exception", () => {
    expect(resolveLandingFromAccess({ role: "team", teamId: 7 })).toBe("/member/team/7");
  });

  test("a program-manager profile without the program right falls back to staff", () => {
    expect(
      resolveLandingFromAccess({
        role: "staff",
        profiles: ["program_manager"],
        effective: {},
      }),
    ).toBe("/staff");
  });

  test("the finance right selects the finance home", () => {
    expect(
      resolveLandingFromAccess({
        role: "staff",
        effective: { finance: { view: 1 } },
      }),
    ).toBe("/staff/finance");
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
    expect(login).toContain("resolveLandingFromAccess(");
    expect(login).toContain("responseUser.home =");
  });

  test("the login no longer pays for the relationship reads the landing stopped using", () => {
    const login = src("src/app/api/auth/session-login/route.js");
    expect(login).not.toContain("resolveParticipantParticipation(");
    expect(login).not.toContain("getVentureMembershipsForContact(");
  });

  test("the hub's home button is that rule, not the badge alone", () => {
    const hub = src("src/app/api/workspaces/route.js");
    expect(hub).toContain("home: landingFromRightsEnabled()");
    expect(hub).toContain("resolveLandingFromAccess(");
    expect(hub).toContain(": resolveLanding(");
    expect(hub).not.toContain("home: roleHomeHref(");
  });

  test("the root bounce prefers the answer that travelled with the identity", () => {
    const root = src("src/app/page.js");
    expect(root).toContain("user.home || roleHomeHref(user.role)");
  });

  test("the login screen uses the answer rather than asking the Venture directory", () => {
    const screen = src("src/app/login/page.js");
    expect(screen).not.toContain("/api/ventures?contact_id");
    expect(screen).toContain("data.user.home ||");
  });

  test("the member sidebar's dashboard door is the one address", () => {
    const contexts = src("src/spaces/member/contexts.js");
    expect(contexts).toContain('"/dashboard"');
    expect(contexts).not.toContain('"/member/participant"');
    expect(contexts).not.toContain('"/member/founder"');
    // The navigation contract must agree with it.
    const access = src("src/lib/masterNavigation/access.js");
    expect(access).toContain('hrefs: { dashboard: "/dashboard" }');
  });

  test("the retired dashboards lead to the one dashboard instead of drawing their own", () => {
    const redirects = src("src/spaces/redirects.js");
    expect(redirects).toContain('source: "/member/participant", destination: "/dashboard"');
    expect(redirects).toContain('source: "/member/founder", destination: "/dashboard"');
    expect(redirects).toContain('source: "/member/facilitator", destination: "/dashboard"');
    expect(redirects).toContain('source: "/member/investor/dashboard", destination: "/dashboard"');
    const config = src("next.config.mjs");
    expect(config).toContain("retiredDashboardRedirects()");
    // …and the address itself is served by the member space's shell group.
    expect(config).toContain("spaceRewrites()");
    expect(config).not.toContain('source: "/dashboard"');
    const rewrites = src("src/spaces/redirects.js");
    expect(rewrites).toContain('{ source: "/dashboard", destination: "/member/dashboard" }');
  });
});
