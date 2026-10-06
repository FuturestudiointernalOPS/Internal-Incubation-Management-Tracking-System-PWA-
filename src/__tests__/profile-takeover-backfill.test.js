/**
 * Tranche 2 — profiles-takeover data migration
 * (docs/PROFILES_TAKEOVER_MIGRATION.md).
 *
 * Locks the conversion decisions: program_manager is PROGRAM-ONLY (the portfolio
 * "Program Manager" capabilities are NOT copied), the ad-hoc and baseline
 * templates become profiles, and the three bridges are moved to PROFILE KEYS —
 * insert-only / NULL-only so an administrator's later choice is never overwritten.
 */

const mockExecute = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn(async () => {}),
}));

const sqlOf = (call) => {
  const first = call[0];
  return typeof first === "string" ? first : String(first?.sql || "");
};
const argsOf = (call) => (typeof call[0] === "string" ? [] : call[0].args || []);
const callsMatching = (pattern) =>
  mockExecute.mock.calls.filter((call) => pattern.test(sqlOf(call)));

const ACCESS_PROFILES = [
  { id: 1, name: "Super Admin Default" },
  { id: 2, name: "Staff Default" },
  { id: 3, name: "Assigned Program Manager" },
  { id: 4, name: "Program Manager" },
  { id: 5, name: "Project Owner" },
  { id: 6, name: "Venture Member" },
];
const CAPS_BY_PROFILE = {
  3: [{ module: "programs", capability: "view", access_level: 1 }],
  4: [
    { module: "programs", capability: "view", access_level: 1 },
    { module: "ventures", capability: "edit", access_level: 3 },
  ],
  5: [{ module: "projects", capability: "view", access_level: 1 }],
};

beforeEach(() => {
  mockExecute.mockReset();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  mockExecute.mockImplementation(async (arg) => {
    const sql = typeof arg === "string" ? arg : String(arg?.sql || "");
    const args = typeof arg === "string" ? [] : arg?.args || [];
    if (/^\s*(CREATE|ALTER|CREATE INDEX|CREATE TABLE|CREATE UNIQUE INDEX)/i.test(sql)) {
      return { rows: [], rowsAffected: 1 };
    }
    if (/FROM access_profiles/i.test(sql)) return { rows: ACCESS_PROFILES };
    if (/FROM access_profile_capabilities WHERE profile_id/i.test(sql)) {
      return { rows: CAPS_BY_PROFILE[Number(args[0])] || [] };
    }
    if (/FROM role_access_profile_defaults/i.test(sql)) {
      return {
        rows: [
          { role_name: "staff", access_profile_id: 2 },
          { role_name: "program_manager", access_profile_id: 4 },
          { role_name: "custom_role", access_profile_id: 999 },
        ],
      };
    }
    if (/FROM context_role_profiles WHERE profile_id IS NOT NULL/i.test(sql)) {
      return { rows: [{ id: 11, profile_id: 3 }] };
    }
    return { rows: [], rowsAffected: 1 };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const load = () => {
  jest.resetModules();
  return require("@/models/authorization/profileTakeoverBackfill");
};

test("program_manager is PROGRAM-ONLY — the portfolio caps are not copied", async () => {
  const { ensureProfileTakeover } = load();
  await ensureProfileTakeover();

  const inserts = callsMatching(/INSERT INTO profile_capabilities/i).map(argsOf);
  const capsForProgramManager = inserts.filter((args) => args[0] === "program_manager");
  expect(capsForProgramManager).toEqual([["program_manager", "programs", "view", 1]]);
  // ventures.edit (from the portfolio "Program Manager") never lands.
  expect(inserts.some((args) => args[1] === "ventures")).toBe(false);
});

test("every mapped template becomes a profile (baseline + ad-hoc included)", async () => {
  const { ensureProfileTakeover } = load();
  await ensureProfileTakeover();

  const profileInserts = callsMatching(/INSERT INTO profiles/i).map(argsOf);
  const keys = profileInserts.map((args) => args[0]).sort();
  expect(keys).toEqual([
    "program_manager",
    "program_manager", // the merged-away portfolio template, same key
    "project_owner",
    "staff_default",
    "super_admin_default",
    "venture_member",
  ]);
});

test("inserts are ON CONFLICT DO NOTHING (an admin edit wins)", async () => {
  const { ensureProfileTakeover } = load();
  await ensureProfileTakeover();
  for (const pattern of [/INSERT INTO profiles/i, /INSERT INTO profile_capabilities/i, /INSERT INTO role_profile_defaults/i]) {
    const call = callsMatching(pattern)[0];
    expect(sqlOf(call)).toMatch(/ON CONFLICT/i);
    expect(sqlOf(call)).toMatch(/DO NOTHING/i);
  }
});

test("role defaults move to profile keys (unmapped templates are skipped)", async () => {
  const { ensureProfileTakeover } = load();
  const report = await ensureProfileTakeover();

  const roleInserts = callsMatching(/INSERT INTO role_profile_defaults/i).map(argsOf);
  expect(roleInserts).toEqual([
    ["staff", "staff_default"],
    ["program_manager", "program_manager"],
  ]);
  // the "custom_role" default points at an unmapped template → untouched
  expect(roleInserts.some((args) => args[0] === "custom_role")).toBe(false);
  expect(report.roleDefaults).toBe(2);
});

test("context registry rows and per-person overrides move to profile keys (NULL-only)", async () => {
  const { ensureProfileTakeover } = load();
  await ensureProfileTakeover();

  const ctxUpdate = callsMatching(/UPDATE context_role_profiles SET profile_key/i)[0];
  expect(sqlOf(ctxUpdate)).toMatch(/profile_key IS NULL/i);
  expect(argsOf(ctxUpdate)).toEqual(["program_manager", 11]);

  const contactUpdates = callsMatching(/UPDATE contacts SET profile_key/i);
  // id 3 → program_manager, id 4 → program_manager, id 6 → venture_member; the
  // unmapped ids (1, 2, 5) produce no contact update only when the id is absent —
  // here every id is mapped, so four distinct keys exist (two share program_manager).
  expect(contactUpdates.map(argsOf)).toEqual([
    ["super_admin_default", 1],
    ["staff_default", 2],
    ["program_manager", 3],
    ["program_manager", 4],
    ["project_owner", 5],
    ["venture_member", 6],
  ]);
});
