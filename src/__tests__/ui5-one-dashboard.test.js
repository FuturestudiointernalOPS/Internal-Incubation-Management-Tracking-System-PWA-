/**
 * ONE DASHBOARD — contracts.
 *
 * The rule this locks: there is ONE dashboard per surface, and the contexts a
 * person holds are added to it as STAT CARDS — never as extra dashboards, never
 * as injected sidebar entries, never as contexts listed in the switcher.
 *
 * Defects being prevented from coming back:
 *   • "My Dashboard" (/staff/me) was a second dashboard with its own calendar,
 *     notifications and ventures list;
 *   • the sidebar injected "MY DASHBOARD" and "MY VENTURES" above the real one;
 *   • the context switcher listed staff program assignments as destinations.
 */

const fs = require("fs");
const path = require("path");

const { buildContextCards, MAX_NAMES_PER_CARD } = require("@/components/dashboard/contextCards");

const EN = require("@/locales/en/common.json");
const FR = require("@/locales/fr/common.json");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

describe("one dashboard — context cards", () => {
  test("no context means no cards at all", () => {
    expect(buildContextCards()).toEqual([]);
    expect(buildContextCards({})).toEqual([]);
    expect(buildContextCards({ contexts: {}, assignedVentures: [] })).toEqual([]);
  });

  test("a program manager gets a programs card, named and counted", () => {
    const cards = buildContextCards({
      contexts: {
        program_assignments: [
          { program_id: "1", program_name: "Founders 2026", href: "/pm/programs" },
          { program_id: "2", program_name: "Incubator 5", href: "/pm/programs" },
        ],
      },
    });
    expect(cards).toEqual([
      {
        key: "programsManaged",
        count: 2,
        names: ["Founders 2026", "Incubator 5"],
        href: "/pm/programs",
      },
    ]);
  });

  test("a venture manager gets a ventures card from the delegations", () => {
    const cards = buildContextCards({
      assignedVentures: [
        { venture_id: "VNT-1", company_name: "Acme" },
        { venture_id: "VNT-2", name: "Beta Co" },
        { venture_id: "VNT-3" },
        { venture_id: "VNT-4" },
      ],
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].key).toBe("venturesAssigned");
    expect(cards[0].count).toBe(4);
    // Four ventures must not become four names — the count carries the volume.
    expect(cards[0].names).toHaveLength(MAX_NAMES_PER_CARD);
    expect(cards[0].names[2]).toBe("VNT-3");
    expect(cards[0].href).toBe("/staff/ventures");
  });

  test("completed participations do not count as active programs", () => {
    const cards = buildContextCards({
      contexts: {
        program_participations: [
          { program_id: "1", program_name: "Done", completed: true },
          { program_id: "2", program_name: "Running", completed: false },
        ],
      },
    });
    expect(cards).toEqual([
      {
        key: "programsParticipating",
        count: 1,
        names: ["Running"],
        href: "/participant/dashboard",
      },
    ]);
  });

  test("an LMS enrollment adds the learning card without a count", () => {
    const cards = buildContextCards({ contexts: { learning: { enrolled: true } } });
    expect(cards).toEqual([
      { key: "learning", count: null, names: [], href: "/participant/learning" },
    ]);
    expect(buildContextCards({ contexts: { learning: { enrolled: false } } })).toEqual([]);
  });

  test("every held context becomes its own card, in a stable order", () => {
    const cards = buildContextCards({
      contexts: {
        program_assignments: [{ program_id: "1", program_name: "P1" }],
        program_participations: [{ program_id: "2", program_name: "P2" }],
        venture_memberships: [{ venture_id: "VNT-9", venture_name: "Nine" }],
        learning: { enrolled: true },
      },
      assignedVentures: [{ venture_id: "VNT-1", company_name: "Acme" }],
    });
    expect(cards.map((c) => c.key)).toEqual([
      "programsManaged",
      "programsParticipating",
      "venturesAssigned",
      "venturesMember",
      "learning",
    ]);
  });

  test("malformed input never throws and never invents a card", () => {
    expect(buildContextCards({ contexts: { program_assignments: null } })).toEqual([]);
    expect(buildContextCards({ contexts: { program_assignments: "nope" } })).toEqual([]);
    expect(buildContextCards({ assignedVentures: null })).toEqual([]);
    expect(buildContextCards({ contexts: { learning: "yes" } })).toEqual([]);
  });
});

describe("one dashboard — the screens", () => {
  test("the staff dashboard composes the context cards with the calendar dashboard", () => {
    const src = read("src/app/staff/page.js");
    expect(src).toContain("ContextCardsPanel");
    expect(src).toContain("UnifiedDashboard");
  });

  test("the retired second dashboard forwards to the real one", () => {
    const src = read("src/app/staff/me/page.js");
    expect(src).toContain('router.replace("/staff")');
  });

  test("the sidebar injects no second dashboard and no injected ventures entry", () => {
    const src = read("src/components/layout/DashboardLayout.js");
    expect(src).not.toContain("personal_home");
    expect(src).not.toContain("MY DASHBOARD");
    // No nav item is injected any more (the old blocks spliced entries in at
    // `insertAt`); the founder surface keeps its own legitimate ventures item.
    expect(src).not.toContain("insertAt");
    expect(src).not.toContain('"MY VENTURES", icon: Rocket, href: "/staff/ventures"');
    expect(src).not.toContain('"/staff/me"');
  });

  test("the switcher no longer lists staff program assignments as destinations", () => {
    const src = read("src/components/layout/ContextSwitcher.js");
    expect(src).not.toContain("program_assignments");
    // Participations and memberships are still legitimate surface moves.
    expect(src).toContain("program_participations");
    expect(src).toContain("venture_memberships");
  });

  test("every card label exists in English and French", () => {
    for (const key of [
      "common.dashboardContexts.title",
      "common.dashboardContexts.count",
      "common.dashboardContexts.enrolled",
      "common.dashboardContexts.open",
      "common.dashboardContexts.programsManaged",
      "common.dashboardContexts.programsParticipating",
      "common.dashboardContexts.venturesAssigned",
      "common.dashboardContexts.venturesMember",
      "common.dashboardContexts.learning",
    ]) {
      expect(typeof resolveKey(EN, key)).toBe("string");
      expect(typeof resolveKey(FR, key)).toBe("string");
    }
  });
});
