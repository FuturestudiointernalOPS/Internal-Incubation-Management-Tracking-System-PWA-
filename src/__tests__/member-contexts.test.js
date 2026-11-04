/**
 * The member contexts — detection and the sidebar they compose.
 *
 * These fixtures pin the behaviour that used to live inline in the navigation
 * hook. If they change, a member's sidebar changed: either intentionally (update
 * the fixture) or by accident (fix the composition).
 */

const {
  MEMBER_CONTEXTS,
  EMPTY_RELATIONSHIPS,
  activeMemberContexts,
  composeMemberNav,
} = require("@/spaces/member/contexts");

const rel = (overrides = {}) => ({ ...EMPTY_RELATIONSHIPS, ...overrides });
const ids = (items) => items.map((item) => item.id);
const href = (items, id) => items.find((item) => item.id === id)?.href;

describe("which contexts are active", () => {
  test("a person with no relationship holds none", () => {
    expect(activeMemberContexts({ role: "member", rel: rel() })).toEqual([]);
  });

  test("each relationship opens its own context", () => {
    const learner = activeMemberContexts({ role: "member", hasCourse: true });
    expect(learner.map((c) => c.key)).toEqual(["learner"]);

    const participant = activeMemberContexts({
      role: "member",
      rel: rel({ isProgramParticipant: true }),
    });
    expect(participant.map((c) => c.key)).toEqual(["program-participant"]);

    const venture = activeMemberContexts({
      role: "member",
      rel: rel({ isVentureMember: true }),
    });
    expect(venture.map((c) => c.key)).toEqual(["venture-member"]);

    const investor = activeMemberContexts({
      role: "member",
      rel: rel({ isInvestor: true }),
    });
    expect(investor.map((c) => c.key)).toEqual(["investor"]);
  });

  test("contexts are cumulative, never exclusive", () => {
    const contexts = activeMemberContexts({
      role: "member",
      hasCourse: true,
      rel: rel({ isProgramParticipant: true, isVentureMember: true, isFounder: true }),
    });
    expect(contexts.map((c) => c.key).sort()).toEqual([
      "learner",
      "program-participant",
      "venture-member",
    ]);
  });

  test("the investor label alone is enough, even without the profile", () => {
    const contexts = activeMemberContexts({ role: "investor", rel: rel() });
    expect(contexts.map((c) => c.key)).toEqual(["investor"]);
  });

  test("every context declares a translation key and at least one door", () => {
    for (const context of MEMBER_CONTEXTS) {
      expect(typeof context.labelKey).toBe("string");
      expect(context.doors.length).toBeGreaterThan(0);
      for (const door of context.doors) {
        expect(door.href.startsWith("/member/")).toBe(true);
      }
    }
  });
});

describe("the sidebar they compose", () => {
  test("no relationship at all — dashboard only", () => {
    expect(ids(composeMemberNav({ role: "member", rel: rel() }))).toEqual([
      "dashboard",
    ]);
  });

  test("team accounts keep their own home", () => {
    const items = composeMemberNav({ role: "team", rel: rel() });
    expect(ids(items)).toEqual(["dashboard"]);
    expect(href(items, "dashboard")).toBe("/member/team");
  });

  test("a founder lands on the founder home", () => {
    const items = composeMemberNav({
      role: "member",
      rel: rel({ isFounder: true, isProgramParticipant: true }),
    });
    expect(href(items, "dashboard")).toBe("/member/founder");
  });

  test("the learner door follows the dashboard", () => {
    expect(
      ids(composeMemberNav({ role: "member", hasCourse: true, rel: rel() })),
    ).toEqual(["dashboard", "learning"]);
  });

  test("programme doors follow in order", () => {
    const items = composeMemberNav({
      role: "member",
      rel: rel({ isProgramParticipant: true }),
    });
    expect(ids(items)).toEqual(["dashboard", "programs", "certificates"]);
    expect(href(items, "programs")).toBe("/member/participant/dashboard");
  });

  test("messages sit before the venture door when allowed", () => {
    const items = composeMemberNav({
      role: "member",
      rel: rel({ isVentureMember: true }),
      canReadMessages: true,
    });
    expect(ids(items)).toEqual(["dashboard", "messages", "ventures"]);
  });

  test("a team account never gets the participant messages door", () => {
    expect(
      ids(composeMemberNav({ role: "team", rel: rel(), canReadMessages: true })),
    ).toEqual(["dashboard"]);
  });

  test("a FOUNDER's ventures door sits with the programme doors", () => {
    const items = composeMemberNav({
      role: "member",
      rel: rel({
        isFounder: true,
        isProgramParticipant: true,
        isVentureMember: true,
      }),
    });
    expect(ids(items)).toEqual([
      "dashboard",
      "programs",
      "certificates",
      "ventures",
    ]);
  });

  test("a founder without a programme still gets ventures right after the home", () => {
    const items = composeMemberNav({
      role: "member",
      rel: rel({ isFounder: true, isVentureMember: true }),
    });
    expect(ids(items)).toEqual(["dashboard", "ventures"]);
  });

  test("an investor's space owns the home — no generic dashboard", () => {
    const items = composeMemberNav({
      role: "member",
      rel: rel({ isInvestor: true }),
    });
    expect(ids(items)).toEqual(["investor"]);
    expect(href(items, "investor")).toBe("/member/investor/dashboard");
  });

  test("an investor who also participates keeps both, investor first", () => {
    const items = composeMemberNav({
      role: "member",
      rel: rel({ isInvestor: true, isProgramParticipant: true }),
    });
    expect(ids(items)).toEqual(["investor", "programs", "certificates"]);
  });
});
