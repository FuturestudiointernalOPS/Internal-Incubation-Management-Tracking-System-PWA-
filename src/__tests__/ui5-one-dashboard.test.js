/**
 * ONE DASHBOARD + SIDEBAR ADDITIONS — contracts.
 *
 * The rule this locks: there is ONE dashboard per surface — the page that owns
 * the calendar — and contexts are SIDEBAR ADDITIONS. A context that appears for
 * someone (ventures, programs, learning) becomes a door in the sidebar that
 * opens its full page (ALL ventures, ALL programs); it never becomes a second
 * dashboard and never a list on the dashboard itself.
 *
 * Defects being prevented from coming back:
 *   • "My Dashboard" (/staff/me) — a second dashboard with its own calendar;
 *   • the dashboard carrying a row of context cards instead of the sidebar
 *     carrying the doors;
 *   • a member WITH A PROGRAM landing on the workspace hub (/workspaces) instead
 *     of on the dashboard, which made "the workspace show first";
 *   • the context switcher listing staff program assignments as destinations.
 */

const fs = require("fs");
const path = require("path");

const { ROLE_HOME, roleHomeHref, resolveLanding } = require("@/models/platform/roles");
const { ROLE_ACCESS } = require("@/lib/masterNavigation");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(process.cwd(), rel));

const DASHBOARD = "src/components/layout/DashboardLayout.js";
const NAV_HOOK = "src/components/layout/shell/useDashboardNavigation.js";
const MEMBER_CONTEXTS = "src/spaces/member/contexts.js";
const STAFF_CONTEXTS = "src/spaces/staff/contexts.js";

describe("one dashboard — the calendar page is the only dashboard", () => {
  test("the staff dashboard renders the calendar dashboard, with no cards", () => {
    // The page renders the staff dashboard, whose centrepiece is the calendar;
    // contexts stay out of it (they are doors in the sidebar).
    const page = read("src/app/staff/page.js");
    const dashboard = read("src/spaces/staff/core/components/StaffDashboard.js");
    expect(page).toContain("StaffDashboard");
    expect(dashboard).toContain("StaffCalendar");
    expect(page).not.toContain("ContextCards");
    expect(dashboard).not.toContain("ContextCards");
  });

  test("the retired context-card row is deleted, not kept around", () => {
    expect(exists("src/components/shared/dashboard/ContextCardsPanel.js")).toBe(false);
    expect(exists("src/components/shared/dashboard/contextCards.js")).toBe(false);
  });

  test("the retired second dashboard forwards to the real one", () => {
    expect(read("src/app/staff/me/page.js")).toContain('router.replace("/staff")');
  });
});

describe("sidebar additions — the doors live in the sidebar", () => {
  // The rules of each context live in its space; the hook composes them. Both
  // sides are read so the contract still covers the door the person sees.
  const src =
    read(DASHBOARD) + read(NAV_HOOK) + read(MEMBER_CONTEXTS) + read(STAFF_CONTEXTS);

  test("assigned staff get the ventures door, opening ALL ventures", () => {
    expect(src).toContain("withVentureConsole");
    expect(src).toContain('name: "MY VENTURES"');
    expect(src).toContain('href: "/staff/ventures"');
    // …and it is conditional: no assignment, no door. The condition lives in
    // the staff context that owns it.
    expect(read(STAFF_CONTEXTS)).toContain("ventureAssignCount > 0");
  });

  test("the doubled-up entries stay deleted", () => {
    expect(src).not.toContain("personal_home");
    expect(src).not.toContain("MY DASHBOARD");
  });

  test("participants already carry their own additions in the nav", () => {
    // The participant surface is relationship-driven: the doors live in the
    // personal sidebar branch, not in a role mask (Phase H removed the mask).
    expect(src).toContain('name: "MY PROGRAMS"');
    expect(src).toContain('href: "/member/participant/dashboard"');
    // …and a venture member gets the ventures door (opens their ventures).
    expect(src).toContain('name: "MY VENTURES"');
    expect(src).toContain('href: "/member/participant/ventures"');
  });

  test("the learning door opens for anyone who actually holds a course", () => {
    // A course subscriber (self-enrollment from the website) belongs to no
    // program and no venture, so the door cannot hang off isProgramParticipant:
    // it is added inside the personal branch from a CONFIRMED enrollment, so a
    // learner is never left with a dashboard-only sidebar.
    expect(src).toContain("hasLmsEnrollments === true");
    expect(src).toContain('id: "learning"');
    expect(src).toContain('href: "/member/participant/learning"');
    // The enrollment check runs on every PERSONAL surface — keying it off one
    // role label is what hid the door from every learner.
    expect(src).toContain("PERSONAL_ROLES.includes(sessionRole)");
    expect(src).not.toContain('sessionRole === "participant"');
  });

  test("the founder surface orders its doors like the founder nav contract", () => {
    // The founder contract is Dashboard → Programs → Ventures → Timeline. The
    // personal branch enforces it by splicing the venture door after the program
    // doors; Phase H removed the founder role mask, so this branch is the ONLY
    // source of that ordering.
    expect(ROLE_ACCESS.founder).toBeUndefined();
    expect(src).toContain("rel.isFounder");
    expect(src).toContain(
      "items.splice(programIndex === -1 ? 1 : programIndex + 2, 0, ...ventureDoors)",
    );
    // Non-founders keep the additive arrangement (door last, never removed).
    expect(src).toContain("items.push(...ventureDoors)");
  });
});

describe("founder classification — ownership, not the role string", () => {
  test("the memberships the sidebar reads are active memberships", () => {
    const { getVentureMembershipsForContact } = require("@/models/contacts/programMembership");
    expect(typeof getVentureMembershipsForContact).toBe("function");
  });

  test("the relationships API derives isFounder from ownership/founder type", () => {
    const src = read("src/app/api/me/relationships/route.js");
    expect(src).toContain("isFounder");
    // The classification itself lives in ONE place now (the same one the landing
    // rule asks), which is what this test was protecting: ownership and the
    // founder type, never the role string. platform/roles.js owns it, and
    // login-landing.test.js pins its answers.
    expect(src).toContain("isFounderMembership");
    const shared = read("src/models/platform/roles.js");
    expect(shared).toContain('=== "founder"');
    expect(shared).toContain("Number(row?.is_owner) === 1");
  });

  test("a removed membership is not a relationship", () => {
    const src = read("src/models/contacts/programMembership.js");
    expect(src).toContain("(vm.user_cid = ? OR vm.contact_id = ?) AND vm.removed_at IS NULL");
  });
});

describe("landing — the participant page follows a program, not the bare badge", () => {
  test("a member has no section of its own in the map", () => {
    // "member" is what anyone without a role resolves to, so the map cannot
    // hand out the Participant page as a default. The enrollment does.
    expect(ROLE_HOME.member).toBeUndefined();
    expect(roleHomeHref("member")).toBeNull();
    expect(resolveLanding({ role: "member" })).toBe("/member");
    expect(resolveLanding({ role: "member", isProgramParticipant: true })).toBe("/member/participant");
  });

  test("the member sidebar Dashboard door points at the dashboard once they have one", () => {
    // nav contract: buildRoleNav("member") resolves dashboard → /participant.
    // (The per-page sidebar is built from /api/me/relationships; this locks
    // the fallback contract so the two can never disagree.)
    expect(ROLE_ACCESS.member.hrefs.dashboard).toBe("/member/participant");
  });

  test("the sidebar never keys the dashboard href off sessionRole", () => {
    // Regression: a member on /participant has activeRole "participant" but
    // sessionRole "member"; keying off sessionRole sent Dashboard back to
    // /workspaces. The personal branch must resolve the href from activeRole.
    const src = read(DASHBOARD) + read(NAV_HOOK) + read(MEMBER_CONTEXTS);
    expect(src).not.toMatch(/homeRole\s*=\s*sessionRole/);
    // The home is resolved from the CONNECTED role (activeRole), never from the
    // session badge; the branches live in the member context module.
    expect(src).toContain('normalizeRole(role) === "team"');
    expect(src).toContain('"/member/team"');
    expect(src).toContain('"/member/participant"');
  });

  test("the other surfaces are unchanged", () => {
    expect(roleHomeHref("staff")).toBe("/staff");
    expect(roleHomeHref("super_admin")).toBe("/admin");
    expect(roleHomeHref("participant")).toBe("/member/participant");
  });
});

describe("the switcher moves between surfaces only", () => {
  test("staff program assignments are not switcher destinations", () => {
    const src = read("src/components/layout/ContextSwitcher.js");
    expect(src).not.toContain("program_assignments");
    expect(src).toContain("program_participations");
    expect(src).toContain("venture_memberships");
  });

  test("the dashboard entry is a real way back, not just a label", () => {
    const src = read("src/components/layout/ContextSwitcher.js");
    // Localized label (never a hardcoded "Dashboard" string)…
    expect(src).toContain('t("common.workspaces.myDashboard")');
    expect(src).not.toContain('"Dashboard", "home", null');
    // …an active marker so you can see you are already home…
    expect(src).toContain("onDashboard");
    expect(src).toContain('aria-current={onDashboard ? "page" : undefined}');
    // …and returning home drops the context marker instead of leaving it behind.
    expect(src).toContain('localStorage.removeItem("impactos_active_context")');
  });
});
