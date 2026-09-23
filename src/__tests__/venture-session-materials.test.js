/**
 * SESSION MATERIALS + WHO MAY BOOK — the two rules added with session documents.
 *
 * 1. A session may carry documents the participants need. The row stores
 *    storage paths issued by the Venture's own upload route; the read layer
 *    signs them, so a material is never world-readable and a path that did not
 *    come from that route is refused at booking time.
 *
 * 2. WHO is booking decides WHERE: the Venture books strictly against the ONE
 *    milestone its chain has released; Future Studio staff plan ahead and may
 *    book against any milestone. A refusal carries the REASON, because "you
 *    cannot book" without a why is the kind of dead end that generates support
 *    tickets.
 */
const {
  SESSION_MATERIALS_MAX,
  SESSION_MATERIALS_PREFIX,
  isSessionMaterialPath,
  normalizeSessionMaterials,
} = require("@/lib/ventureSessionRules");
const { assertBookableMilestone } = require("@/lib/ventureMilestoneEngine");
const { signSessionMaterials } = require("@/lib/ventureEvidence");

/** A db stub keyed on the DISTINCTIVE clause of each query the engine runs. */
function makeDb({ milestone = null, stage = null, list = [] } = {}) {
  return {
    execute: jest.fn(async ({ sql }) => {
      if (String(sql).includes("ORDER BY COALESCE(display_order")) return { rows: list };
      if (String(sql).includes("FROM venture_journey_stages")) return { rows: stage ? [stage] : [] };
      if (String(sql).includes("FROM venture_milestones")) return { rows: milestone ? [milestone] : [] };
      return { rows: [] };
    }),
  };
}

const MILESTONE = { id: "MS-1", title: "Pitch Deck", status: "not_started", journey_stage_id: "ST-1" };
const STAGE = { id: "ST-1", name: "Family & Friends", status: "active" };

describe("session material paths", () => {
  test("only paths issued by the session upload route are accepted", () => {
    expect(SESSION_MATERIALS_PREFIX).toBe("sessions/");
    expect(isSessionMaterialPath("sessions/VNT-1/MS-1/123_deck.pdf")).toBe(true);
    // Deliverable evidence shares the bucket but not the prefix.
    expect(isSessionMaterialPath("deliverables/VNT-1/DV-1/123_proof.pdf")).toBe(false);
    expect(isSessionMaterialPath("")).toBe(false);
    expect(isSessionMaterialPath("sessions/../secrets.pdf")).toBe(false);
    expect(isSessionMaterialPath("sessions/")).toBe(false);
  });
});

describe("normalizeSessionMaterials", () => {
  test("no materials is a valid booking", () => {
    expect(normalizeSessionMaterials(undefined)).toEqual([]);
    expect(normalizeSessionMaterials(null)).toEqual([]);
    expect(normalizeSessionMaterials([])).toEqual([]);
  });

  test("keeps the path, the name and the size", () => {
    expect(
      normalizeSessionMaterials([{ path: "sessions/VNT-1/MS-1/deck.pdf", name: "deck.pdf", size: 2048 }]),
    ).toEqual([{ path: "sessions/VNT-1/MS-1/deck.pdf", name: "deck.pdf", size: 2048 }]);
  });

  test("a missing name falls back to the file name in the path", () => {
    const [only] = normalizeSessionMaterials([{ path: "sessions/VNT-1/MS-1/deck.pdf" }]);
    expect(only.name).toBe("deck.pdf");
  });

  test("rejects a payload the read layer could not sign", () => {
    // Anything that is not a list, a foreign path, or more than the cap: the
    // caller answers 400 instead of storing a link nobody can open.
    expect(normalizeSessionMaterials("sessions/x.pdf")).toBeNull();
    expect(normalizeSessionMaterials([{ path: "deliverables/VNT-1/x.pdf" }])).toBeNull();
    expect(normalizeSessionMaterials([{ path: "" }])).toBeNull();
    expect(normalizeSessionMaterials([null])).toBeNull();
    const tooMany = Array.from({ length: SESSION_MATERIALS_MAX + 1 }, (_, materialIndex) => ({
      path: `sessions/VNT-1/MS-1/${materialIndex}.pdf`,
    }));
    expect(normalizeSessionMaterials(tooMany)).toBeNull();
  });
});

describe("assertBookableMilestone — strictly the current milestone", () => {
  test("allows the milestone the chain has released", async () => {
    const out = await assertBookableMilestone(makeDb({ milestone: MILESTONE, stage: STAGE, list: [MILESTONE] }), {
      dbId: 7,
      milestoneId: "MS-1",
    });
    expect(out.ok).toBe(true);
  });

  test("refuses a locked milestone and says it is locked", async () => {
    const out = await assertBookableMilestone(
      makeDb({ milestone: { ...MILESTONE, status: "locked" }, stage: STAGE }),
      { dbId: 7, milestoneId: "MS-1" },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/locked/i);
  });

  test("refuses a completed milestone and says it is completed", async () => {
    const out = await assertBookableMilestone(
      makeDb({ milestone: { ...MILESTONE, status: "completed" }, stage: STAGE }),
      { dbId: 7, milestoneId: "MS-1" },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/already completed/i);
  });

  test("refuses a milestone in a Journey that has not started", async () => {
    const out = await assertBookableMilestone(
      makeDb({ milestone: MILESTONE, stage: { ...STAGE, status: "locked" } }),
      { dbId: 7, milestoneId: "MS-1" },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/not started/i);
  });

  test("refuses a milestone in a finished Journey", async () => {
    const out = await assertBookableMilestone(
      makeDb({ milestone: MILESTONE, stage: { ...STAGE, status: "completed" } }),
      { dbId: 7, milestoneId: "MS-1" },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/finished/i);
  });

  test("refuses a later milestone and NAMES the one that is actually current", async () => {
    const later = { id: "MS-2", title: "Business Plan", status: "locked", journey_stage_id: "ST-1" };
    const out = await assertBookableMilestone(
      makeDb({
        // The list is what the chain says is open; the milestone asked for is
        // later in the same Journey.
        milestone: later,
        stage: STAGE,
        list: [MILESTONE, later],
      }),
      { dbId: 7, milestoneId: "MS-2" },
    );
    // Locked is refused first, and that reason is the most specific one.
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/locked/i);
  });

  test("a released-but-not-first milestone is refused with the current one named", async () => {
    const second = { id: "MS-2", title: "Business Plan", status: "not_started", journey_stage_id: "ST-1" };
    const out = await assertBookableMilestone(
      makeDb({ milestone: second, stage: STAGE, list: [MILESTONE, second] }),
      { dbId: 7, milestoneId: "MS-2" },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("Pitch Deck");
  });

  test("an archived milestone is refused", async () => {
    const out = await assertBookableMilestone(
      makeDb({ milestone: { ...MILESTONE, is_archived: true }, stage: STAGE }),
      { dbId: 7, milestoneId: "MS-1" },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/archived/i);
  });

  test("an unknown milestone is refused", async () => {
    const out = await assertBookableMilestone(makeDb({}), { dbId: 7, milestoneId: "MS-9" });
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/no longer exists/i);
  });
});

describe("signSessionMaterials", () => {
  test("maps stored paths to linkable materials", async () => {
    const out = await signSessionMaterials([
      { path: "sessions/VNT-1/MS-1/deck.pdf", name: "deck.pdf", size: 2048 },
    ]);
    expect(out).toEqual([{ name: "deck.pdf", size: 2048, url: null }]);
  });

  test("tolerates the JSON-string form and junk", async () => {
    expect(await signSessionMaterials('{"not":"an array"}')).toEqual([]);
    expect(await signSessionMaterials("not json")).toEqual([]);
    expect(await signSessionMaterials(null)).toEqual([]);
    expect(await signSessionMaterials([])).toEqual([]);
  });
});
