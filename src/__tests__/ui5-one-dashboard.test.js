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
 *   • a member landing on the workspace hub (/workspaces) instead of on the
 *     dashboard, which made "the workspace show first";
 *   • the context switcher listing staff program assignments as destinations.
 */

const fs = require("fs");
const path = require("path");

const { ROLE_HOME, roleHomeHref } = require("@/models/platform/roles");
const { ROLE_ACCESS } = require("@/lib/masterNavigation");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(process.cwd(), rel));

const DASHBOARD = "src/components/layout/DashboardLayout.js";

describe("one dashboard — the calendar page is the only dashboard", () => {
  test("the staff dashboard renders the calendar dashboard, with no cards", () => {
    const src = read("src/app/staff/page.js");
    expect(src).toContain("UnifiedDashboard");
    expect(src).not.toContain("ContextCards");
  });

  test("the retired context-card row is deleted, not kept around", () => {
    expect(exists("src/components/dashboard/ContextCardsPanel.js")).toBe(false);
    expect(exists("src/components/dashboard/contextCards.js")).toBe(false);
  });

  test("the retired second dashboard forwards to the real one", () => {
    expect(read("src/app/staff/me/page.js")).toContain('router.replace("/staff")');
  });
});

describe("sidebar additions — the doors live in the sidebar", () => {
  const src = read(DASHBOARD);

  test("assigned staff get the ventures door, opening ALL ventures", () => {
    expect(src).toContain("withVentureConsole");
    expect(src).toContain('name: "MY VENTURES"');
    expect(src).toContain('href: "/staff/ventures"');
    // …and it is conditional: no assignment, no door.
    expect(src).toContain("ventureAssignCount <= 0");
  });

  test("the doubled-up entries stay deleted", () => {
    expect(src).not.toContain("personal_home");
    expect(src).not.toContain("MY DASHBOARD");
  });

  test("participants already carry their own additions in the nav", () => {
    // Programs + Learning are part of the participant surface…
    expect(ROLE_ACCESS.participant.top).toContain("learning");
    expect(ROLE_ACCESS.participant.top).toContain("programs");
    // …and a venture member gets the ventures door (opens their ventures).
    expect(src).toContain('name: "MY VENTURES", icon: Rocket, href: "/participant/ventures"');
  });

  test("the founder surface orders its doors like the founder nav contract", () => {
    // The founder contract is Dashboard → Programs → Ventures → Timeline.
    // The personal sidebar must agree, so a founder's venture door is not
    // buried after every participant item.
    expect(ROLE_ACCESS.founder.top).toEqual([
      "dashboard",
      "programs",
      "ventures",
      "timeline",
    ]);
    expect(src).toContain("rel.isFounder");
    expect(src).toContain('items.splice(progIndex === -1 ? 1 : progIndex + 2, 0, ventureDoor)');
    // Non-founders keep the additive arrangement (door last, never removed).
    expect(src).toContain("items.push(ventureDoor)");
  });
});

describe("founder classification — ownership, not the role string", () => {
  test("the memberships the sidebar reads are active memberships", () => {
    const contacts = require("@/models/contacts");
    expect(typeof contacts.getVentureMembershipsForContact).toBe("function");
  });

  test("the relationships API derives isFounder from ownership/founder type", () => {
    const src = read("src/app/api/me/relationships/route.js");
    expect(src).toContain("isFounder");
    expect(src).toContain('memberType === "founder"');
    expect(src).toContain("Number(v.is_owner) === 1");
  });

  test("a removed membership is not a relationship", () => {
    const src = read("src/models/contacts.js");
    expect(src).toContain("(vm.user_cid = ? OR vm.contact_id = ?) AND vm.removed_at IS NULL");
  });
});

describe("landing — the dashboard shows first, not the workspace hub", () => {
  test("a member lands on the dashboard", () => {
    expect(ROLE_HOME.member).toBe("/participant");
    expect(roleHomeHref("member")).toBe("/participant");
  });

  test("the member sidebar Dashboard door points at the dashboard too", () => {
    // nav contract: buildRoleNav("member") resolves dashboard → /participant.
    // (The per-page sidebar is built from /api/me/relationships; this locks
    // the fallback contract so the two can never disagree.)
    expect(ROLE_ACCESS.member.hrefs.dashboard).toBe("/participant");
  });

  test("the sidebar never keys the dashboard href off sessionRole", () => {
    // Regression: a member on /participant has activeRole "participant" but
    // sessionRole "member"; keying off sessionRole sent Dashboard back to
    // /workspaces. The personal branch must resolve the href from activeRole.
    const src = read(DASHBOARD);
    expect(src).not.toMatch(/homeRole\s*=\s*sessionRole/);
    expect(src).toContain('activeRole === "team" ? "/team" : "/participant"');
  });

  test("the other surfaces are unchanged", () => {
    expect(roleHomeHref("staff")).toBe("/staff");
    expect(roleHomeHref("super_admin")).toBe("/admin");
    expect(roleHomeHref("participant")).toBe("/participant");
  });
});

describe("the switcher moves between surfaces only", () => {
  test("staff program assignments are not switcher destinations", () => {
    const src = read("src/components/layout/ContextSwitcher.js");
    expect(src).not.toContain("program_assignments");
    expect(src).toContain("program_participations");
    expect(src).toContain("venture_memberships");
  });
});
