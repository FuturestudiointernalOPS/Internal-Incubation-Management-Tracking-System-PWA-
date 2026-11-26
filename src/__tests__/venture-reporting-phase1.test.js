/**
 * PHASE 1 — Venture reporting foundation.
 *
 * The pure rules (validation, thresholds, bands, shares) and the versioning
 * behaviour of the static profile.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(), transaction: jest.fn() },
}));

jest.mock("@/services/ventures/schema", () => ({
  ensureVentureSchema: jest.fn(async () => {}),
}));

jest.mock("@/models/ventureReportingStore", () => ({
  runInTransaction: jest.fn(async (fn) => fn(jest.fn())),
  selectNextProfileVersion: jest.fn(),
  supersedeCurrentProfile: jest.fn(),
  insertProfileVersion: jest.fn(),
  selectCurrentProfile: jest.fn(),
  selectProfileHistory: jest.fn(),
  selectTeamSnapshot: jest.fn(),
  upsertTeamSnapshot: jest.fn(),
  selectActiveBaseline: jest.fn(),
  insertBaseline: jest.fn(),
  setBaselineFteIfNull: jest.fn(),
  supersedeBaseline: jest.fn(),
  selectCurrentFounders: jest.fn(),
  deactivateFounders: jest.fn(),
  insertFounder: jest.fn(),
}));

const {
  validateStaticProfile,
  validateFounder,
  resolveSetting,
  buildSettingsMap,
  bandMidpoint,
  topBandHigh,
  groupBands,
  computeTeamShares,
  canCaptureBaseline,
  validateSupersedeReason,
  snapshotFte,
  toCount,
  toAmount,
} = require("@/services/ventures/reporting/rules");

const { normalizePeriod } = require("@/services/ventures/reporting/team");

const store = require("@/models/ventureReportingStore");
const { saveProfile } = require("@/services/ventures/reporting/staticProfile");

const VALID = {
  legalName: "PSPLYTICS SARL",
  foundingDate: "2026-09-01",
  businessModel: "subscription",
  sector: "Fintech",
  problemStatement: "SMEs cannot reconcile payments.",
  idealCustomerProfile: "Small merchants in Cotonou.",
  northStarName: "Active paying merchants",
  northStarDefinition: "Merchants with at least one payment in the month.",
  northStarUnit: "merchants",
};

describe("static profile validation", () => {
  test("a complete profile has no errors", () => {
    expect(validateStaticProfile(VALID)).toEqual([]);
  });

  test("only the registration essentials are required", () => {
    const errors = validateStaticProfile({});
    expect(errors).toEqual(
      expect.arrayContaining([
        "venture.reporting.validation.legalName",
        "venture.reporting.validation.foundingDate",
        "venture.reporting.validation.businessModel",
      ]),
    );
    // Everything the founder may not know yet is optional at registration —
    // these must not block the save.
    for (const key of [
      "sector",
      "northStarDefinition",
      "problemStatement",
      "idealCustomerProfile",
      "northStarName",
      "northStarUnit",
    ]) {
      expect(errors).not.toContain(`venture.reporting.validation.${key}`);
    }
  });

  test("a future founding date is refused", () => {
    const future = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect(validateStaticProfile({ ...VALID, foundingDate: future })).toContain(
      "venture.reporting.validation.futureDate",
    );
  });

  test("an invalid accounting basis is refused", () => {
    expect(validateStaticProfile({ ...VALID, accountingBasis: "cash-ish" })).toContain(
      "venture.reporting.validation.accountingBasis",
    );
  });

  test("a founder needs a name", () => {
    expect(validateFounder({})).toContain("venture.reporting.validation.founderName");
    expect(validateFounder({ name: "Amina" })).toEqual([]);
  });
});

describe("settings resolution", () => {
  const rows = [
    { setting_key: "growth_min_paying_customers", business_model: "default", setting_value: 15 },
    { setting_key: "growth_min_paying_customers", business_model: "large_accounts", setting_value: 5 },
    { setting_key: "min_ltv_cac", business_model: "default", setting_value: 3 },
  ];

  test("a business-model override wins", () => {
    expect(resolveSetting(rows, "growth_min_paying_customers", "large_accounts")).toBe(5);
  });

  test("the default applies when no override exists", () => {
    expect(resolveSetting(rows, "growth_min_paying_customers", "subscription")).toBe(15);
    expect(resolveSetting(rows, "min_ltv_cac", "large_accounts")).toBe(3);
  });

  test("an unknown setting is null, never zero", () => {
    expect(resolveSetting(rows, "nope", "default")).toBeNull();
  });

  test("the map applies overrides per key", () => {
    expect(buildSettingsMap(rows, "large_accounts")).toEqual({
      growth_min_paying_customers: 5,
      min_ltv_cac: 3,
    });
  });
});

describe("bands", () => {
  test("midpoint is the arithmetic middle", () => {
    expect(bandMidpoint(1, 50000)).toBe(25000.5);
  });

  test("the open top band high is low × 1.25", () => {
    expect(topBandHigh(5000001)).toBe(6250001.25);
  });

  test("bands group by kind in order", () => {
    const grouped = groupBands([
      { band_kind: "flow", band_code: "F1", low: 1, high: 50000, midpoint: 25000.5 },
      { band_kind: "cash", band_code: "C1", low: 1, high: 500000, midpoint: 250000.5 },
    ]);
    expect(grouped.flow).toHaveLength(1);
    expect(grouped.cash).toHaveLength(1);
  });
});

describe("team shares", () => {
  test("a zero denominator is not applicable, not zero", () => {
    expect(computeTeamShares({ women_employees: 0, men_employees: 0 })).toMatchObject({
      womenShare: null,
      youthShare: null,
      // No founder records means UNKNOWN, not a confident "not women-led".
      womenLed: null,
    });
  });

  test("women share and youth share are computed", () => {
    expect(
      computeTeamShares({
        women_employees: 2,
        men_employees: 2,
        under35_women: 1,
        under35_men: 1,
      }),
    ).toMatchObject({ womenShare: 50, youthShare: 50 });
  });

  test("women-led is a founding fact, not a headcount fact", () => {
    const team = { women_employees: 1, men_employees: 39 };
    // One woman among forty employees used to mark the Venture women-led.
    expect(
      computeTeamShares(team, [{ gender: "male" }, { gender: "male" }]).womenLed,
    ).toBe(false);
    // A woman founder, and women at least half of the founding team.
    expect(computeTeamShares(team, [{ gender: "female" }, { gender: "male" }]).womenLed).toBe(true);
    // A minority woman founder is not "women-led" under this rule.
    expect(
      computeTeamShares(team, [{ gender: "female" }, { gender: "male" }, { gender: "male" }]).womenLed,
    ).toBe(false);
  });
});

describe("baseline rules", () => {
  test("a baseline can be captured only once", () => {
    expect(canCaptureBaseline(null)).toBe(true);
    expect(canCaptureBaseline({ id: "b1" })).toBe(false);
  });

  test("superseding always requires a reason", () => {
    expect(validateSupersedeReason("")).toContain("venture.reporting.validation.supersedeReason");
    expect(validateSupersedeReason("Wrong opening cash")).toEqual([]);
  });
});

describe("the baseline FTE comes from the workforce", () => {
  test("full-timers + part-time days ÷ 20 + full-time founders", () => {
    expect(snapshotFte({ fullTime: 3, partTimeDays: 40, fullTimeFounders: 2 })).toBe(7);
    expect(snapshotFte({ fullTime: 0, partTimeDays: 10, fullTimeFounders: 1 })).toBe(1.5);
  });

  test("an untouched snapshot is not reported, not a measured zero", () => {
    // `toCount` turns a cleared field into 0, so a saved blank form would
    // otherwise become a 0-FTE baseline that every later job is measured from.
    expect(snapshotFte({ fullTime: 0, partTimeDays: 0, fullTimeFounders: 0 })).toBeNull();
    expect(snapshotFte({})).toBeNull();
  });
});

describe("numeric normalisation", () => {
  test("counts are non-negative integers", () => {
    expect(toCount("-3")).toBe(0);
    expect(toCount("4.9")).toBe(4);
    expect(toCount(undefined)).toBe(0);
  });

  test("amounts are non-negative numbers or null", () => {
    expect(toAmount("125000")).toBe(125000);
    expect(toAmount("")).toBeNull();
    expect(toAmount("-1")).toBeNull();
  });
});

describe("reporting period", () => {
  test("YYYY-MM and YYYY-MM-DD both normalise to the first of the month", () => {
    expect(normalizePeriod("2026-09")).toBe("2026-09-01");
    expect(normalizePeriod("2026-09-17")).toBe("2026-09-01");
  });

  test("an invalid period is refused", () => {
    expect(normalizePeriod("09/2026")).toBeNull();
    expect(normalizePeriod("2026-13")).toBeNull();
  });
});

describe("static profile versioning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.insertProfileVersion.mockResolvedValue({ rows: [{ version: 2, is_current: true }] });
  });

  test("the first save is version 1 and supersedes nothing", async () => {
    store.selectNextProfileVersion.mockResolvedValue({ rows: [{ next_version: 1 }] });
    const result = await saveProfile({ ventureUuid: "uuid-1", ventureCode: "VNT-1", actorCid: "c1", input: VALID });
    expect(store.supersedeCurrentProfile).not.toHaveBeenCalled();
    expect(result.profile.version).toBe(2); // mocked insert row
  });

  test("a later save supersedes the current version", async () => {
    store.selectNextProfileVersion.mockResolvedValue({ rows: [{ next_version: 2 }] });
    await saveProfile({ ventureUuid: "uuid-1", ventureCode: "VNT-1", actorCid: "c1", input: VALID });
    expect(store.supersedeCurrentProfile).toHaveBeenCalled();
  });

  test("an invalid profile writes nothing", async () => {
    const result = await saveProfile({ ventureUuid: "uuid-1", ventureCode: "VNT-1", actorCid: "c1", input: {} });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(store.insertProfileVersion).not.toHaveBeenCalled();
  });
});
