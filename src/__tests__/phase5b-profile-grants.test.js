/**
 * PHASE 5b — venture capability grants in the default profile seeds.
 *
 * The pilot's canonical gate requires `ventures.view`; the grant must reach
 * Staff Default + Program Manager (the roles the navigation projection already
 * intends to manage ventures). Guard against write expansion: NO non-Super-Admin
 * profile may receive `ventures.edit` — that capability alone guards the two
 * capability-only venture routes (PUT /api/ventures, PATCH /api/ventures/[id]).
 */

const mockProfileIds = {
  "Super Admin Default": 1,
  "Staff Default": 2,
  "Participant Default": 3,
  Developer: 4,
  "Program Manager": 5,
  Instructor: 6,
  Mentor: 7,
  Founder: 8,
};
const mockCapabilityInserts = [];

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async (queryObj) => {
      const sql = typeof queryObj === "string" ? queryObj : queryObj?.sql;
      const args = typeof queryObj === "string" ? [] : queryObj?.args || [];
      if (String(sql).includes("INSERT INTO access_profile_capabilities")) {
        mockCapabilityInserts.push({
          profileId: args[0],
          module: args[1],
          capability: args[2],
          level: args[3],
        });
      }
      if (String(sql).includes("FROM access_profiles WHERE name =")) {
        const id = mockProfileIds[args[0]];
        return { rows: id ? [{ id }] : [] };
      }
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

const { seedDefaultAccessProfiles } = require("@/lib/auth");

beforeEach(() => {
  mockCapabilityInserts.length = 0;
  jest.clearAllMocks();
});

describe("Phase 5b — ventures capability grants", () => {
  test("Staff Default, Program Manager and Founder receive ventures.view", async () => {
    const res = await seedDefaultAccessProfiles();
    expect(res.success).toBe(true);

    const ventureCaps = mockCapabilityInserts.filter((c) => c.module === "ventures");
    const viewHolders = ventureCaps
      .filter((c) => c.capability === "view")
      .map((c) => c.profileId);

    expect(viewHolders).toContain(mockProfileIds["Staff Default"]);
    expect(viewHolders).toContain(mockProfileIds["Program Manager"]);
    // Phase 5b founder gap fill — minimal (view only; scope does the rest).
    expect(viewHolders).toContain(mockProfileIds["Founder"]);
  });

  test("the Founder profile holds ONLY ventures.view (no scope-free write surface)", async () => {
    await seedDefaultAccessProfiles();
    const founderCaps = mockCapabilityInserts.filter(
      (c) => c.profileId === mockProfileIds["Founder"],
    );
    expect(founderCaps).toEqual([
      { profileId: mockProfileIds["Founder"], module: "ventures", capability: "view", level: 1 },
    ]);
  });

  test("no non-SA profile receives ventures.edit (write expansion guard)", async () => {
    await seedDefaultAccessProfiles();
    const editHolders = mockCapabilityInserts
      .filter((c) => c.module === "ventures" && c.capability === "edit")
      .map((c) => c.profileId);
    expect(editHolders).toEqual([mockProfileIds["Super Admin Default"]]);
  });
});
