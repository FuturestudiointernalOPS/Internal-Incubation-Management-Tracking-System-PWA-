/**
 * Tranche 6 — direct profile catalogue seed (docs/PROFILES_TAKEOVER_MIGRATION.md).
 *
 * A fresh database must get the profiles AND their capabilities without any
 * `access_profiles` row. The seed is insert-only, so an existing database keeps
 * every administrator edit.
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

const {
  PROFILE_CATALOGUE_SEED,
  ensureProfileCatalogueSeed,
  ensureDelegatedCapabilityDefaults,
} = require("@/models/authorization/profileCatalogueSeed");

beforeEach(() => {
  mockExecute.mockReset();
  mockExecute.mockResolvedValue({ rows: [], rowsAffected: 1 });
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("seeds one profiles row per catalogue entry, insert-only", async () => {
  await ensureProfileCatalogueSeed();
  const inserts = callsMatching(/INSERT INTO profiles/i);
  expect(inserts).toHaveLength(PROFILE_CATALOGUE_SEED.length);
  expect(inserts.every((call) => /ON CONFLICT \(key\) DO NOTHING/i.test(sqlOf(call)))).toBe(true);
  expect(inserts.map((call) => argsOf(call)[0]).sort()).toEqual(
    PROFILE_CATALOGUE_SEED.map((def) => def.key).sort(),
  );
});

test("seeds the capabilities with ON CONFLICT DO NOTHING", async () => {
  await ensureProfileCatalogueSeed();
  const caps = callsMatching(/INSERT INTO profile_capabilities/i);
  expect(caps.length).toBeGreaterThan(0);
  expect(caps.every((call) => /ON CONFLICT \(profile_key, module, capability\) DO NOTHING/i.test(sqlOf(call)))).toBe(true);
});

test("program_manager is PROGRAM-ONLY apart from the KPI catalogue", async () => {
  await ensureProfileCatalogueSeed();
  const pmRows = callsMatching(/INSERT INTO profile_capabilities/i)
    .map(argsOf)
    .filter((args) => args[0] === "program_manager");
  const pmModules = [...new Set(pmRows.map((args) => args[1]))].sort();
  // `ventures.kpis` is a CATALOGUE-CONFIGURATION right (business rule 49), not
  // portfolio access: it gates the reusable KPI definitions only, never a
  // Venture's own data. Every other venture capability stays out.
  expect(pmModules).toEqual(["programs", "ventures"]);
  expect(pmRows.filter((args) => args[1] === "ventures").map((args) => args[2])).toEqual(["kpis"]);
});

test("the catalogue carries the baseline and ad-hoc profiles, with labels", () => {
  const byKey = Object.fromEntries(PROFILE_CATALOGUE_SEED.map((def) => [def.key, def]));
  for (const key of ["staff_default", "super_admin_default", "venture_member", "project_owner", "operations_manager", "instructor", "finance_assistant"]) {
    expect(byKey[key]).toBeTruthy();
    expect(byKey[key].label.length).toBeGreaterThan(0);
    expect(byKey[key].context).toMatch(/^(global|staff|venture|program|lms|investor)$/);
  }
});

test("the delegated-capability backfill grants the profiles that already had the access", async () => {
  await ensureDelegatedCapabilityDefaults();
  const inserts = callsMatching(/INSERT INTO profile_capabilities/i);
  expect(inserts).toHaveLength(7);
  expect(
    inserts.every((call) =>
      /ON CONFLICT \(profile_key, module, capability\) DO NOTHING/i.test(sqlOf(call)),
    ),
  ).toBe(true);
  const rows = inserts.map(argsOf);
  expect(rows).toContainEqual(["staff_default", "ventures", "setup", 3]);
  expect(rows).toContainEqual(["staff_default", "ventures", "kpis", 3]);
  expect(rows).toContainEqual(["staff_default", "ventures", "permissions_view", 1]);
  expect(rows).toContainEqual(["staff_default", "programs", "groups", 2]);
  expect(rows).toContainEqual(["staff_default", "collections", "view", 1]);
  expect(rows).toContainEqual(["program_manager", "programs", "groups", 2]);
  expect(rows).toContainEqual(["program_manager", "ventures", "kpis", 3]);
});
